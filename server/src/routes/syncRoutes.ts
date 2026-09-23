import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { calculateSplits } from '../services/expenseMath.js';
import { SyncQueueItem } from '../types/shared.js';

const router = Router();
router.use(authenticateToken);

router.post('/', (req: AuthenticatedRequest, res: Response): void => {
  const currentUserId = req.user!.id;
  const items: SyncQueueItem[] = req.body.items || [];

  if (!Array.isArray(items) || items.length === 0) {
    res.json({ processedIds: [], errors: [] });
    return;
  }

  const processedIds: string[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const item of items) {
    try {
      if (item.entity === 'expense') {
        const payload = item.payload;
        const expenseId = item.entityId || payload.id;
        const tripId = payload.trip_id;

        // Check if user is active member of this trip
        const member = db.prepare(
          'SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ? AND status = ?'
        ).get(tripId, currentUserId, 'ACTIVE') as any;

        if (!member) {
          throw new Error('User is not an active member of this trip.');
        }

        if (item.action === 'CREATE') {
          // Idempotency: check if expense already exists
          const existing = db.prepare('SELECT id FROM expenses WHERE id = ?').get(expenseId);
          if (!existing) {
            const calculatedSplits = calculateSplits(payload.split_type, payload.amount_cents, payload.splits);
            const now = new Date().toISOString();

            const tx = db.transaction(() => {
              db.prepare(`
                INSERT INTO expenses (
                  id, trip_id, created_by, title, amount_cents, category,
                  paid_by, split_type, expense_date, notes, receipt_image,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                expenseId,
                tripId,
                currentUserId,
                payload.title,
                payload.amount_cents,
                payload.category,
                payload.paid_by,
                payload.split_type,
                payload.expense_date,
                payload.notes || null,
                payload.receipt_image || null,
                item.timestamp || now,
                item.timestamp || now
              );

              for (const s of calculatedSplits) {
                db.prepare(`
                  INSERT INTO expense_splits (id, expense_id, user_id, amount_cents, percentage, shares, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                  uuidv4(),
                  expenseId,
                  s.user_id,
                  s.amount_cents,
                  s.percentage || null,
                  s.shares || null,
                  item.timestamp || now
                );
              }
            });

            tx();
          }
        } else if (item.action === 'UPDATE') {
          const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId) as any;
          if (existing) {
            // LWW Conflict Resolution: check timestamp
            if (!existing.updated_at || new Date(item.timestamp) >= new Date(existing.updated_at)) {
              const calculatedSplits = calculateSplits(payload.split_type, payload.amount_cents, payload.splits);
              const tx = db.transaction(() => {
                db.prepare(`
                  UPDATE expenses
                  SET title = ?, amount_cents = ?, category = ?, paid_by = ?, split_type = ?,
                      expense_date = ?, notes = ?, updated_at = ?
                  WHERE id = ?
                `).run(
                  payload.title,
                  payload.amount_cents,
                  payload.category,
                  payload.paid_by,
                  payload.split_type,
                  payload.expense_date,
                  payload.notes || null,
                  item.timestamp,
                  expenseId
                );

                db.prepare('DELETE FROM expense_splits WHERE expense_id = ?').run(expenseId);
                for (const s of calculatedSplits) {
                  db.prepare(`
                    INSERT INTO expense_splits (id, expense_id, user_id, amount_cents, percentage, shares, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                  `).run(
                    uuidv4(),
                    expenseId,
                    s.user_id,
                    s.amount_cents,
                    s.percentage || null,
                    s.shares || null,
                    item.timestamp
                  );
                }
              });
              tx();
            }
          }
        } else if (item.action === 'DELETE') {
          const now = new Date().toISOString();
          db.prepare('UPDATE expenses SET deleted_at = ? WHERE id = ?').run(now, expenseId);
        }
      } else if (item.entity === 'settlement' && item.action === 'CREATE') {
        const payload = item.payload;
        const settlementId = item.entityId || payload.id;
        const existing = db.prepare('SELECT id FROM settlements WHERE id = ?').get(settlementId);
        if (!existing) {
          const now = new Date().toISOString();
          db.prepare(`
            INSERT INTO settlements (id, trip_id, from_user_id, to_user_id, amount_cents, status, created_at, confirmed_at, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            settlementId,
            payload.trip_id,
            payload.from_user_id,
            payload.to_user_id,
            payload.amount_cents,
            payload.status || 'PAID',
            item.timestamp || now,
            payload.status === 'CONFIRMED' ? now : null,
            payload.notes || null
          );
        }
      }

      processedIds.push(item.id);
    } catch (err: any) {
      console.error(`Sync error on item ${item.id}:`, err);
      errors.push({ id: item.id, error: err.message || 'Processing failed' });
    }
  }

  res.json({ processedIds, errors });
});

export default router;
