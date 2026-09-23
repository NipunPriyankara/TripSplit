import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { requireTripOwner, requireTripMember, TripRequest } from '../middleware/tripAuth.js';
import { Invitation, JoinRequest } from '../types/shared.js';

const router = Router();

// Generate secure unguessable invitation token
function generateInviteToken(): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase(); // e.g. "9F4A8B2C7E1D0F3B"
}

// 1. Generate invitation link (Owner only)
router.post('/trips/:id/invitations', authenticateToken, requireTripOwner, (req: TripRequest, res: Response): void => {
  try {
    const tripId = req.trip!.id;
    const userId = req.user!.id;
    const token = generateInviteToken();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO invitations (id, trip_id, token, created_by, status, created_at)
      VALUES (?, ?, ?, ?, 'ACTIVE', ?)
    `).run(id, tripId, token, userId, now);

    const invite: Invitation = {
      id,
      trip_id: tripId,
      token,
      created_by: userId,
      usage_count: 0,
      status: 'ACTIVE',
      created_at: now,
    };

    res.status(201).json({ invitation: invite });
  } catch (err: any) {
    console.error('Generate invitation error:', err);
    res.status(500).json({ error: 'Failed to generate invitation link' });
  }
});

// 2. List invitations for a trip (Owner only)
router.get('/trips/:id/invitations', authenticateToken, requireTripOwner, (req: TripRequest, res: Response): void => {
  try {
    const invites = db.prepare(`
      SELECT * FROM invitations WHERE trip_id = ? AND status = 'ACTIVE' ORDER BY created_at DESC
    `).all(req.trip!.id) as Invitation[];

    res.json({ invitations: invites });
  } catch (err: any) {
    console.error('Get invitations error:', err);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// 3. Revoke invitation token (Owner only)
router.delete('/trips/:id/invitations/:token', authenticateToken, requireTripOwner, (req: TripRequest, res: Response): void => {
  try {
    db.prepare("UPDATE invitations SET status = 'REVOKED' WHERE trip_id = ? AND token = ?")
      .run(req.trip!.id, req.params.token);
    res.json({ success: true, message: 'Invitation revoked successfully' });
  } catch (err: any) {
    console.error('Revoke invitation error:', err);
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
});

// 4. Public preview of trip invitation (NO private data exposed!)
router.get('/join/:token', (req: Request, res: Response): void => {
  try {
    const { token } = req.params;
    const invite = db.prepare(`
      SELECT i.*, t.name as trip_name, t.description, t.start_date, t.end_date, t.currency,
             u.name as owner_name, u.avatar as owner_avatar
      FROM invitations i
      JOIN trips t ON t.id = i.trip_id
      JOIN users u ON u.id = t.owner_id
      WHERE i.token = ? AND i.status = 'ACTIVE' AND t.deleted_at IS NULL
    `).get(token) as any;

    if (!invite) {
      res.status(404).json({ error: 'Invitation link is invalid or has expired.' });
      return;
    }

    res.json({
      invitation: {
        token: invite.token,
        trip_name: invite.trip_name,
        description: invite.description,
        start_date: invite.start_date,
        end_date: invite.end_date,
        currency: invite.currency,
        owner_name: invite.owner_name,
        owner_avatar: invite.owner_avatar,
      },
    });
  } catch (err: any) {
    console.error('Preview invitation error:', err);
    res.status(500).json({ error: 'Failed to preview invitation' });
  }
});

// 5. Submit join request
router.post('/join/:token/request', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { token } = req.params;
    const userId = req.user!.id;

    const invite = db.prepare(`
      SELECT i.*, t.id as trip_id, t.name as trip_name, t.owner_id
      FROM invitations i
      JOIN trips t ON t.id = i.trip_id
      WHERE i.token = ? AND i.status = 'ACTIVE' AND t.deleted_at IS NULL
    `).get(token) as any;

    if (!invite) {
      res.status(404).json({ error: 'Invalid or expired invitation link.' });
      return;
    }

    // Check if user is already a member
    const existingMember = db.prepare(
      'SELECT id, role, status FROM trip_members WHERE trip_id = ? AND user_id = ?'
    ).get(invite.trip_id, userId) as any;

    if (existingMember && existingMember.status === 'ACTIVE') {
      res.status(400).json({ error: 'You are already a member of this trip.', trip_id: invite.trip_id });
      return;
    }

    // Check if request already exists
    const existingRequest = db.prepare(
      'SELECT * FROM join_requests WHERE trip_id = ? AND user_id = ?'
    ).get(invite.trip_id, userId) as any;

    const now = new Date().toISOString();

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        res.json({ message: 'Your join request is already pending approval by the trip owner.', status: 'PENDING' });
        return;
      }
      // Re-request if previously rejected or cancelled
      db.prepare(`
        UPDATE join_requests 
        SET status = 'PENDING', requested_at = ?, reviewed_at = NULL, reviewed_by = NULL
        WHERE id = ?
      `).run(now, existingRequest.id);

      res.json({ message: 'Join request re-submitted successfully.', status: 'PENDING' });
      return;
    }

    const requestId = uuidv4();
    db.prepare(`
      INSERT INTO join_requests (id, trip_id, user_id, status, requested_at)
      VALUES (?, ?, ?, 'PENDING', ?)
    `).run(requestId, invite.trip_id, userId, now);

    // Notify owner
    const notifId = uuidv4();
    db.prepare(`
      INSERT INTO notifications (id, user_id, trip_id, type, title, message, created_at)
      VALUES (?, ?, ?, 'JOIN_REQUEST', ?, ?, ?)
    `).run(
      notifId,
      invite.owner_id,
      invite.trip_id,
      'New Join Request',
      `${req.user!.name} requested to join ${invite.trip_name}`,
      now
    );

    res.status(201).json({
      message: 'Join request submitted! The trip owner must approve your request before you can access the room.',
      status: 'PENDING',
    });
  } catch (err: any) {
    console.error('Submit join request error:', err);
    res.status(500).json({ error: 'Failed to submit join request' });
  }
});

// 6. View pending join requests (Owner only)
router.get('/trips/:id/join-requests', authenticateToken, requireTripOwner, (req: TripRequest, res: Response): void => {
  try {
    const requests = db.prepare(`
      SELECT 
        jr.id,
        jr.trip_id,
        jr.user_id,
        jr.status,
        jr.requested_at,
        json_object('id', u.id, 'name', u.name, 'email', u.email, 'avatar', u.avatar) as user_json
      FROM join_requests jr
      JOIN users u ON u.id = jr.user_id
      WHERE jr.trip_id = ? AND jr.status = 'PENDING'
      ORDER BY jr.requested_at ASC
    `).all(req.trip!.id) as any[];

    const formatted: JoinRequest[] = requests.map(r => ({
      id: r.id,
      trip_id: r.trip_id,
      user_id: r.user_id,
      status: r.status,
      requested_at: r.requested_at,
      user: JSON.parse(r.user_json),
    }));

    res.json({ requests: formatted });
  } catch (err: any) {
    console.error('Get join requests error:', err);
    res.status(500).json({ error: 'Failed to fetch join requests' });
  }
});

// 7. Accept join request (Owner only)
router.post('/trips/:id/join-requests/:requestId/accept', authenticateToken, requireTripOwner, (req: TripRequest, res: Response): void => {
  try {
    const { requestId } = req.params;
    const tripId = req.trip!.id;
    const ownerId = req.user!.id;
    const now = new Date().toISOString();

    const request = db.prepare(`
      SELECT * FROM join_requests WHERE id = ? AND trip_id = ? AND status = 'PENDING'
    `).get(requestId, tripId) as any;

    if (!request) {
      res.status(404).json({ error: 'Join request not found or already processed.' });
      return;
    }

    const tx = db.transaction(() => {
      // 1. Update request to ACCEPTED
      db.prepare(`
        UPDATE join_requests
        SET status = 'ACCEPTED', reviewed_at = ?, reviewed_by = ?
        WHERE id = ?
      `).run(now, ownerId, requestId);

      // 2. Add or update member to ACTIVE
      const existingMember = db.prepare(
        'SELECT id FROM trip_members WHERE trip_id = ? AND user_id = ?'
      ).get(tripId, request.user_id);

      if (existingMember) {
        db.prepare(`
          UPDATE trip_members
          SET status = 'ACTIVE', role = 'MEMBER', joined_at = ?
          WHERE trip_id = ? AND user_id = ?
        `).run(now, tripId, request.user_id);
      } else {
        const memberId = uuidv4();
        db.prepare(`
          INSERT INTO trip_members (id, trip_id, user_id, role, status, joined_at)
          VALUES (?, ?, ?, 'MEMBER', 'ACTIVE', ?)
        `).run(memberId, tripId, request.user_id, now);
      }

      // 3. Notify the approved user
      const notifId = uuidv4();
      db.prepare(`
        INSERT INTO notifications (id, user_id, trip_id, type, title, message, created_at)
        VALUES (?, ?, ?, 'REQUEST_ACCEPTED', ?, ?, ?)
      `).run(
        notifId,
        request.user_id,
        tripId,
        'Join Request Approved!',
        `You have been accepted into "${req.trip!.name}". You can now access the trip room.`,
        now
      );
    });

    tx();

    res.json({ success: true, message: 'Join request approved. Member has joined the trip.' });
  } catch (err: any) {
    console.error('Accept join request error:', err);
    res.status(500).json({ error: 'Failed to accept join request' });
  }
});

// 8. Reject join request (Owner only)
router.post('/trips/:id/join-requests/:requestId/reject', authenticateToken, requireTripOwner, (req: TripRequest, res: Response): void => {
  try {
    const { requestId } = req.params;
    const tripId = req.trip!.id;
    const ownerId = req.user!.id;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE join_requests
      SET status = 'REJECTED', reviewed_at = ?, reviewed_by = ?
      WHERE id = ? AND trip_id = ? AND status = 'PENDING'
    `).run(now, ownerId, requestId, tripId);

    res.json({ success: true, message: 'Join request rejected.' });
  } catch (err: any) {
    console.error('Reject join request error:', err);
    res.status(500).json({ error: 'Failed to reject join request' });
  }
});

export default router;
