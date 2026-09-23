import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireTripMember, TripRequest } from '../middleware/tripAuth.js';
import { calculateMemberBalances, calculateOptimalSettlements } from '../services/settlementEngine.js';
import { Settlement, User } from '../types/shared.js';

const router = Router();
router.use(authenticateToken);

const CreateSettlementSchema = z.object({
  from_user_id: z.string().min(1),
  to_user_id: z.string().min(1),
  amount_cents: z.number().int().positive(),
  status: z.enum(['PENDING', 'PAID', 'CONFIRMED']).default('PAID'),
  notes: z.string().optional().nullable(),
});

// 1. Get balances and optimized settlements
router.get('/trips/:id/balances', requireTripMember, (req: TripRequest, res: Response): void => {
  try {
    const tripId = req.trip!.id;

    // Fetch members
    const membersRaw = db.prepare(`
      SELECT 
        tm.user_id,
        tm.role,
        json_object('id', u.id, 'name', u.name, 'email', u.email, 'avatar', u.avatar) as user_json
      FROM trip_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.trip_id = ? AND tm.status = 'ACTIVE'
    `).all(tripId) as any[];

    const members = membersRaw.map(m => ({
      user_id: m.user_id,
      role: m.role,
      user: JSON.parse(m.user_json) as User,
    }));

    // Fetch expenses and splits
    const expensesRaw = db.prepare(`
      SELECT id, amount_cents, paid_by, deleted_at
      FROM expenses
      WHERE trip_id = ? AND deleted_at IS NULL
    `).all(tripId) as any[];

    const expenseIds = expensesRaw.map(e => e.id);
    const splitsMap: Record<string, { user_id: string; amount_cents: number }[]> = {};

    if (expenseIds.length > 0) {
      const placeholders = expenseIds.map(() => '?').join(',');
      const splitsRaw = db.prepare(`
        SELECT expense_id, user_id, amount_cents
        FROM expense_splits
        WHERE expense_id IN (${placeholders})
      `).all(...expenseIds) as any[];

      for (const s of splitsRaw) {
        if (!splitsMap[s.expense_id]) splitsMap[s.expense_id] = [];
        splitsMap[s.expense_id].push({
          user_id: s.user_id,
          amount_cents: s.amount_cents,
        });
      }
    }

    const expenses = expensesRaw.map(e => ({
      id: e.id,
      amount_cents: e.amount_cents,
      paid_by: e.paid_by,
      deleted_at: e.deleted_at,
      splits: splitsMap[e.id] || [],
    }));

    // Fetch settlements
    const settlementsRaw = db.prepare(`
      SELECT 
        s.*,
        json_object('id', uf.id, 'name', uf.name, 'email', uf.email, 'avatar', uf.avatar) as from_user_json,
        json_object('id', ut.id, 'name', ut.name, 'email', ut.email, 'avatar', ut.avatar) as to_user_json
      FROM settlements s
      JOIN users uf ON uf.id = s.from_user_id
      JOIN users ut ON ut.id = s.to_user_id
      WHERE s.trip_id = ?
      ORDER BY s.created_at DESC
    `).all(tripId) as any[];

    const settlements: Settlement[] = settlementsRaw.map(s => ({
      id: s.id,
      trip_id: s.trip_id,
      from_user_id: s.from_user_id,
      to_user_id: s.to_user_id,
      amount_cents: s.amount_cents,
      status: s.status,
      created_at: s.created_at,
      confirmed_at: s.confirmed_at,
      notes: s.notes,
      from_user: JSON.parse(s.from_user_json),
      to_user: JSON.parse(s.to_user_json),
    }));

    // Calculate balances
    const balances = calculateMemberBalances(members, expenses, settlements);

    // Calculate recommended optimized settlement transactions
    const recommendations = calculateOptimalSettlements(balances);

    res.json({
      balances,
      recommendations,
      settlements,
    });
  } catch (err: any) {
    console.error('Calculate balances error:', err);
    res.status(500).json({ error: 'Failed to calculate balances' });
  }
});

// 2. Record a settlement payment
router.post('/trips/:id/settlements', requireTripMember, (req: TripRequest, res: Response): void => {
  try {
    const parse = CreateSettlementSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const tripId = req.trip!.id;
    const { from_user_id, to_user_id, amount_cents, status, notes } = parse.data;
    const settlementId = uuidv4();
    const now = new Date().toISOString();
    const confirmedAt = status === 'CONFIRMED' ? now : null;

    db.prepare(`
      INSERT INTO settlements (id, trip_id, from_user_id, to_user_id, amount_cents, status, created_at, confirmed_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(settlementId, tripId, from_user_id, to_user_id, amount_cents, status, now, confirmedAt, notes || null);

    res.status(201).json({
      settlement: {
        id: settlementId,
        trip_id: tripId,
        from_user_id,
        to_user_id,
        amount_cents,
        status,
        created_at: now,
        confirmed_at: confirmedAt,
        notes: notes || null,
      },
    });
  } catch (err: any) {
    console.error('Record settlement error:', err);
    res.status(500).json({ error: 'Failed to record settlement' });
  }
});

// 3. Update settlement status (e.g. mark as PAID or CONFIRMED)
router.put('/trips/:id/settlements/:settlementId', requireTripMember, (req: TripRequest, res: Response): void => {
  try {
    const { settlementId } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'PAID', 'CONFIRMED'].includes(status)) {
      res.status(400).json({ error: 'Invalid settlement status' });
      return;
    }

    const now = new Date().toISOString();
    const confirmedAt = status === 'CONFIRMED' ? now : null;

    db.prepare(`
      UPDATE settlements
      SET status = ?, confirmed_at = COALESCE(?, confirmed_at)
      WHERE id = ? AND trip_id = ?
    `).run(status, confirmedAt, settlementId, req.trip!.id);

    res.json({ success: true, message: 'Settlement status updated successfully' });
  } catch (err: any) {
    console.error('Update settlement error:', err);
    res.status(500).json({ error: 'Failed to update settlement' });
  }
});

export default router;
