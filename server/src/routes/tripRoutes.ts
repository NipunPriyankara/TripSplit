import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { requireTripMember, requireTripOwner, TripRequest } from '../middleware/tripAuth.js';
import { Trip, TripMember } from '../types/shared.js';

const router = Router();

// Apply auth to all trip routes
router.use(authenticateToken);

const CreateTripSchema = z.object({
  name: z.string().min(1, 'Trip name is required'),
  description: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  currency: z.string().min(1).default('LKR'),
  cover_image: z.string().optional().nullable(),
});

const UpdateTripSchema = CreateTripSchema.partial();

// List trips for current user
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const userId = req.user!.id;
  try {
    const stmt = db.prepare(`
      SELECT 
        t.*,
        tm.role,
        (SELECT COUNT(*) FROM trip_members WHERE trip_id = t.id AND status = 'ACTIVE') as member_count,
        COALESCE((SELECT SUM(amount_cents) FROM expenses WHERE trip_id = t.id AND deleted_at IS NULL), 0) as total_expenses_cents
      FROM trips t
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE tm.user_id = ? AND tm.status = 'ACTIVE' AND t.deleted_at IS NULL
      ORDER BY t.created_at DESC
    `);

    const trips = stmt.all(userId) as Trip[];
    res.json({ trips });
  } catch (err: any) {
    console.error('Fetch trips error:', err);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// Create new trip
router.post('/', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const parse = CreateTripSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const { name, description, start_date, end_date, currency, cover_image } = parse.data;
    const userId = req.user!.id;
    const tripId = uuidv4();
    const memberId = uuidv4();
    const now = new Date().toISOString();

    const insertTrip = db.prepare(`
      INSERT INTO trips (id, owner_id, name, description, start_date, end_date, currency, cover_image, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMember = db.prepare(`
      INSERT INTO trip_members (id, trip_id, user_id, role, status, joined_at)
      VALUES (?, ?, ?, 'OWNER', 'ACTIVE', ?)
    `);

    const transaction = db.transaction(() => {
      insertTrip.run(tripId, userId, name.trim(), description || null, start_date || null, end_date || null, currency, cover_image || null, now, now);
      insertMember.run(memberId, tripId, userId, now);
    });

    transaction();

    const createdTrip: Trip = {
      id: tripId,
      owner_id: userId,
      name: name.trim(),
      description: description || null,
      start_date: start_date || null,
      end_date: end_date || null,
      currency,
      cover_image: cover_image || null,
      created_at: now,
      updated_at: now,
      role: 'OWNER',
      member_count: 1,
      total_expenses_cents: 0,
    };

    res.status(201).json({ trip: createdTrip });
  } catch (err: any) {
    console.error('Create trip error:', err);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

// Get single trip room details
router.get('/:id', requireTripMember, (req: TripRequest, res: Response): void => {
  const trip = req.trip!;
  const role = req.tripRole!;

  const stats = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM trip_members WHERE trip_id = ? AND status = 'ACTIVE') as member_count,
      COALESCE((SELECT SUM(amount_cents) FROM expenses WHERE trip_id = ? AND deleted_at IS NULL), 0) as total_expenses_cents
  `).get(trip.id, trip.id) as { member_count: number; total_expenses_cents: number };

  res.json({
    trip: {
      ...trip,
      role,
      member_count: stats.member_count,
      total_expenses_cents: stats.total_expenses_cents,
    },
  });
});

// Update trip (Owner only)
router.put('/:id', requireTripOwner, (req: TripRequest, res: Response): void => {
  try {
    const parse = UpdateTripSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const { name, description, start_date, end_date, currency, cover_image } = parse.data;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE trips
      SET 
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        currency = COALESCE(?, currency),
        cover_image = COALESCE(?, cover_image),
        updated_at = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name : null,
      description !== undefined ? description : null,
      start_date !== undefined ? start_date : null,
      end_date !== undefined ? end_date : null,
      currency !== undefined ? currency : null,
      cover_image !== undefined ? cover_image : null,
      now,
      req.trip!.id
    );

    const updated = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.trip!.id) as Trip;
    res.json({ trip: updated });
  } catch (err: any) {
    console.error('Update trip error:', err);
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

// Delete trip (Owner only - soft delete)
router.delete('/:id', requireTripOwner, (req: TripRequest, res: Response): void => {
  try {
    const now = new Date().toISOString();
    db.prepare("UPDATE trips SET deleted_at = ? WHERE id = ?").run(now, req.trip!.id);
    res.json({ success: true, message: 'Trip deleted successfully' });
  } catch (err: any) {
    console.error('Delete trip error:', err);
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

// List members of a trip
router.get('/:id/members', requireTripMember, (req: TripRequest, res: Response): void => {
  try {
    const members = db.prepare(`
      SELECT 
        tm.id,
        tm.trip_id,
        tm.user_id,
        tm.role,
        tm.status,
        tm.joined_at,
        json_object('id', u.id, 'name', u.name, 'email', u.email, 'avatar', u.avatar) as user_json
      FROM trip_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.trip_id = ? AND tm.status = 'ACTIVE'
      ORDER BY tm.role DESC, tm.joined_at ASC
    `).all(req.trip!.id) as any[];

    const formattedMembers: TripMember[] = members.map(m => ({
      id: m.id,
      trip_id: m.trip_id,
      user_id: m.user_id,
      role: m.role,
      status: m.status,
      joined_at: m.joined_at,
      user: JSON.parse(m.user_json),
    }));

    res.json({ members: formattedMembers });
  } catch (err: any) {
    console.error('Get members error:', err);
    res.status(500).json({ error: 'Failed to get members' });
  }
});

// Remove member (Owner only, cannot remove self) or Leave trip (Member only)
router.delete('/:id/members/:memberUserId', requireTripMember, (req: TripRequest, res: Response): void => {
  const currentUserId = req.user!.id;
  const targetUserId = req.params.memberUserId;
  const isOwner = req.tripRole === 'OWNER';

  if (targetUserId === currentUserId) {
    // User is leaving
    if (isOwner) {
      res.status(400).json({ error: 'As the Trip Owner, you cannot leave your own trip. You must delete it or transfer ownership.' });
      return;
    }
    db.prepare("UPDATE trip_members SET status = 'LEFT' WHERE trip_id = ? AND user_id = ?").run(req.trip!.id, currentUserId);
    res.json({ success: true, message: 'You have left the trip.' });
    return;
  }

  // Removing another member - must be Owner
  if (!isOwner) {
    res.status(403).json({ error: 'Only the Trip Owner can remove other members.' });
    return;
  }

  db.prepare("UPDATE trip_members SET status = 'REMOVED' WHERE trip_id = ? AND user_id = ?").run(req.trip!.id, targetUserId);
  res.json({ success: true, message: 'Member removed from trip.' });
});

export default router;
