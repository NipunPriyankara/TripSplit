import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Master Admin Claim Passkey (convenient for server owners)
const ADMIN_CLAIM_PASSKEY = process.env.ADMIN_CLAIM_KEY || 'tripsplit@admin2026';

// 1. Claim Admin Role (for current authenticated user using passkey)
router.post('/claim', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { passkey } = req.body;
    if (!passkey || passkey !== ADMIN_CLAIM_PASSKEY) {
      res.status(403).json({ error: 'Invalid admin claim passkey.' });
      return;
    }

    const userId = req.user!.id;
    db.prepare('UPDATE users SET is_admin = 1, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), userId);

    res.json({ success: true, message: 'You have been granted Administrator privileges!' });
  } catch (err: any) {
    console.error('Claim admin error:', err);
    res.status(500).json({ error: 'Failed to claim admin privileges.' });
  }
});

// All following routes require authenticateToken + requireAdmin
router.use(authenticateToken);
router.use(requireAdmin);

// 2. Overview Stats
router.get('/stats', (_req: AuthenticatedRequest, res: Response): void => {
  try {
    const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0;
    const totalTrips = (db.prepare('SELECT COUNT(*) as count FROM trips WHERE deleted_at IS NULL').get() as any)?.count || 0;
    const totalExpenses = (db.prepare('SELECT COUNT(*) as count FROM expenses WHERE deleted_at IS NULL').get() as any)?.count || 0;
    const totalVolume = (db.prepare('SELECT COALESCE(SUM(amount_cents), 0) as total FROM expenses WHERE deleted_at IS NULL').get() as any)?.total || 0;
    const totalSettlements = (db.prepare('SELECT COUNT(*) as count FROM settlements').get() as any)?.count || 0;

    res.json({
      stats: {
        total_users: totalUsers,
        total_trips: totalTrips,
        total_expenses: totalExpenses,
        total_volume_cents: totalVolume,
        total_settlements: totalSettlements,
      },
    });
  } catch (err: any) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch admin stats.' });
  }
});

// 3. Get All Users
router.get('/users', (_req: AuthenticatedRequest, res: Response): void => {
  try {
    const users = db.prepare(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.avatar, 
        u.is_admin, 
        u.created_at,
        u.updated_at,
        (SELECT COUNT(*) FROM trips t WHERE t.owner_id = u.id AND t.deleted_at IS NULL) as owned_trips_count,
        (SELECT COUNT(*) FROM trip_members tm JOIN trips t ON tm.trip_id = t.id WHERE tm.user_id = u.id AND t.deleted_at IS NULL) as member_trips_count
      FROM users u
      ORDER BY u.created_at DESC
    `).all();

    res.json({ users });
  } catch (err: any) {
    console.error('Admin get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// 4. Reset User Password
const ResetPasswordSchema = z.object({
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
});

router.post('/users/:id/reset-password', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.id;
    const parse = ResetPasswordSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: (parse.error as any).errors?.[0]?.message || 'Invalid password' });
      return;
    }

    const existingUser = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(targetUserId);
    if (!existingUser) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(parse.data.new_password, salt);
    const now = new Date().toISOString();

    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(passwordHash, now, targetUserId);

    res.json({ success: true, message: `Password for user reset successfully!` });
  } catch (err: any) {
    console.error('Admin reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// 5. Toggle Admin Status
router.post('/users/:id/toggle-admin', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user!.id;

    if (targetUserId === currentUserId) {
      res.status(400).json({ error: 'You cannot change your own admin status.' });
      return;
    }

    const user = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(targetUserId) as any;
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const newStatus = user.is_admin ? 0 : 1;
    db.prepare('UPDATE users SET is_admin = ?, updated_at = ? WHERE id = ?')
      .run(newStatus, new Date().toISOString(), targetUserId);

    res.json({ success: true, is_admin: newStatus, message: `Admin privileges ${newStatus ? 'granted' : 'revoked'}.` });
  } catch (err: any) {
    console.error('Admin toggle error:', err);
    res.status(500).json({ error: 'Failed to change admin role.' });
  }
});

// 6. Delete User
router.delete('/users/:id', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user!.id;

    if (targetUserId === currentUserId) {
      res.status(400).json({ error: 'You cannot delete your own account from the admin panel.' });
      return;
    }

    const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(targetUserId) as any;
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // SQLite foreign keys ON DELETE CASCADE will clean up memberships, owned trips, etc.
    db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);

    res.json({ success: true, message: `User "${user.name}" deleted successfully.` });
  } catch (err: any) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// 7. Get All Trips & Room Members
router.get('/trips', (_req: AuthenticatedRequest, res: Response): void => {
  try {
    const trips = db.prepare(`
      SELECT 
        t.id, 
        t.name, 
        t.description, 
        t.currency, 
        t.created_at, 
        t.owner_id,
        u.name as owner_name, 
        u.email as owner_email,
        (SELECT COUNT(*) FROM trip_members tm WHERE tm.trip_id = t.id AND tm.status = 'ACTIVE') as member_count,
        (SELECT COUNT(*) FROM expenses e WHERE e.trip_id = t.id AND e.deleted_at IS NULL) as expense_count,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM expenses e WHERE e.trip_id = t.id AND e.deleted_at IS NULL) as total_expense_cents
      FROM trips t
      JOIN users u ON t.owner_id = u.id
      WHERE t.deleted_at IS NULL
      ORDER BY t.created_at DESC
    `).all() as any[];

    // Fetch members for each trip
    const getMembersStmt = db.prepare(`
      SELECT 
        tm.id, 
        tm.user_id, 
        u.name, 
        u.email, 
        u.avatar, 
        tm.role, 
        tm.joined_at
      FROM trip_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.trip_id = ? AND tm.status = 'ACTIVE'
      ORDER BY tm.role DESC, tm.joined_at ASC
    `);

    const result = trips.map(trip => ({
      ...trip,
      members: getMembersStmt.all(trip.id),
    }));

    res.json({ trips: result });
  } catch (err: any) {
    console.error('Admin get trips error:', err);
    res.status(500).json({ error: 'Failed to fetch trips.' });
  }
});

// 8. Delete Trip Room
router.delete('/trips/:id', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const tripId = req.params.id;
    const trip = db.prepare('SELECT id, name FROM trips WHERE id = ?').get(tripId) as any;
    if (!trip) {
      res.status(404).json({ error: 'Trip not found.' });
      return;
    }

    // Soft delete or hard delete
    db.prepare('DELETE FROM trips WHERE id = ?').run(tripId);

    res.json({ success: true, message: `Trip room "${trip.name}" deleted successfully.` });
  } catch (err: any) {
    console.error('Admin delete trip error:', err);
    res.status(500).json({ error: 'Failed to delete trip room.' });
  }
});

export default router;
