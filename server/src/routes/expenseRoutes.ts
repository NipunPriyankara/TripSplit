import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireTripMember, TripRequest } from '../middleware/tripAuth.js';
import { calculateSplits, MemberSplitInput } from '../services/expenseMath.js';
import { Expense, ExpenseCategory, SplitType } from '../types/shared.js';

const router = Router();
router.use(authenticateToken);

const ExpenseSplitInputSchema = z.object({
  user_id: z.string().min(1),
  amount_cents: z.number().int().nonnegative().optional(),
  percentage: z.number().nonnegative().optional(),
  shares: z.number().positive().optional(),
});

const CreateExpenseSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  amount_cents: z.number().int().positive('Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional().nullable(),
  paid_by: z.string().min(1, 'Payer is required'),
  split_type: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES']),
  expense_date: z.string().min(1, 'Date is required'),
  notes: z.string().optional().nullable(),
  receipt_image: z.string().optional().nullable(),
  splits: z.array(ExpenseSplitInputSchema).min(1, 'At least one participant required'),
});

const UpdateExpenseSchema = CreateExpenseSchema.partial();

const DEFAULT_CATEGORIES = [
  { name: 'Food', icon: '🍛', subcategories: ['Rice & Curry', 'Kottu', 'Breakfast', 'Lunch', 'Dinner', 'Shorties', 'Snacks'] },
  { name: 'Drinks', icon: '🍻', subcategories: ['Soft Drinks', 'Beer', 'Coffee / Tea', 'Bottled Water', 'Liquor'] },
  { name: 'Hotel', icon: '🏨', subcategories: ['Room Charges', 'Villa Booking', 'Service Fee', 'Camping'] },
  { name: 'Transport', icon: '🚕', subcategories: ['Van / Car Hire', 'Highway Toll', 'Train Tickets', 'Tuk-Tuk', 'Bus'] },
  { name: 'Fuel', icon: '⛽', subcategories: ['Petrol', 'Diesel'] },
  { name: 'Tickets', icon: '🎟️', subcategories: ['Entrance Fees', 'Safari Jeep', 'Boat Ride', 'Activity Pass'] },
  { name: 'Shopping', icon: '🛍️', subcategories: ['Groceries', 'Souvenirs', 'Clothing'] },
  { name: 'Other', icon: '🧾', subcategories: ['Tips', 'Emergency', 'Miscellaneous'] },
];

// Get or seed trip categories
router.get('/trips/:id/categories', requireTripMember, (req: TripRequest, res: Response): void => {
  try {
    const tripId = req.trip!.id;
    let categories = db.prepare('SELECT * FROM trip_categories WHERE trip_id = ? ORDER BY created_at ASC').all(tripId) as any[];

    if (categories.length === 0) {
      // Seed default categories for this trip
      const insert = db.prepare(`
        INSERT OR IGNORE INTO trip_categories (id, trip_id, name, icon, subcategories, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `);
      const tx = db.transaction(() => {
        for (const cat of DEFAULT_CATEGORIES) {
          insert.run(uuidv4(), tripId, cat.name, cat.icon, JSON.stringify(cat.subcategories));
        }
      });
      tx();
      categories = db.prepare('SELECT * FROM trip_categories WHERE trip_id = ? ORDER BY created_at ASC').all(tripId) as any[];
    }

    const formatted = categories.map(c => ({
      id: c.id,
      trip_id: c.trip_id,
      name: c.name,
      icon: c.icon,
      subcategories: JSON.parse(c.subcategories || '[]'),
      created_at: c.created_at,
    }));

    res.json({ categories: formatted });
  } catch (err: any) {
    console.error('Fetch categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Add a new custom category or add a subcategory
router.post('/trips/:id/categories', requireTripMember, (req: TripRequest, res: Response): void => {
  try {
    const tripId = req.trip!.id;
    const { name, icon, subcategory, subcategories } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Category name is required' });
      return;
    }

    const trimmedName = name.trim();
    const existing = db.prepare('SELECT * FROM trip_categories WHERE trip_id = ? AND name = ?').get(tripId, trimmedName) as any;

    if (existing) {
      // If adding a subcategory to an existing category
      let existingSubs: string[] = JSON.parse(existing.subcategories || '[]');
      const newSubs = Array.isArray(subcategories)
        ? subcategories
        : subcategory
        ? [subcategory.trim()]
        : [];

      for (const s of newSubs) {
        if (s && !existingSubs.includes(s)) {
          existingSubs.push(s);
        }
      }

      db.prepare('UPDATE trip_categories SET subcategories = ? WHERE id = ?')
        .run(JSON.stringify(existingSubs), existing.id);

      res.json({
        category: {
          id: existing.id,
          trip_id: tripId,
          name: existing.name,
          icon: existing.icon,
          subcategories: existingSubs,
        },
      });
      return;
    }

    // Creating new category
    const id = uuidv4();
    const initialSubs = Array.isArray(subcategories)
      ? subcategories
      : subcategory
      ? [subcategory.trim()]
      : [];

    db.prepare(`
      INSERT INTO trip_categories (id, trip_id, name, icon, subcategories, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(id, tripId, trimmedName, icon || '🏷️', JSON.stringify(initialSubs));

    res.status(201).json({
      category: {
        id,
        trip_id: tripId,
        name: trimmedName,
        icon: icon || '🏷️',
        subcategories: initialSubs,
      },
    });
  } catch (err: any) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Failed to create or update category' });
  }
});

// 1. List expenses for a trip
router.get('/trips/:id/expenses', requireTripMember, (req: TripRequest, res: Response): void => {
  try {
    const tripId = req.trip!.id;
    const { category, paid_by, search } = req.query;

    let query = `
      SELECT 
        e.*,
        json_object('id', u.id, 'name', u.name, 'email', u.email, 'avatar', u.avatar) as payer_json
      FROM expenses e
      JOIN users u ON u.id = e.paid_by
      WHERE e.trip_id = ? AND e.deleted_at IS NULL
    `;
    const params: any[] = [tripId];

    if (category && typeof category === 'string' && category !== 'ALL') {
      query += ` AND e.category = ?`;
      params.push(category);
    }
    if (paid_by && typeof paid_by === 'string') {
      query += ` AND e.paid_by = ?`;
      params.push(paid_by);
    }
    if (search && typeof search === 'string') {
      query += ` AND (e.title LIKE ? OR e.notes LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY e.expense_date DESC, e.created_at DESC`;

    const expensesRaw = db.prepare(query).all(...params) as any[];

    // Fetch splits for all matching expenses
    const expenseIds = expensesRaw.map(e => e.id);
    let splitsMap: Record<string, any[]> = {};

    if (expenseIds.length > 0) {
      const placeholders = expenseIds.map(() => '?').join(',');
      const splitsRaw = db.prepare(`
        SELECT 
          es.*,
          json_object('id', u.id, 'name', u.name, 'email', u.email, 'avatar', u.avatar) as user_json
        FROM expense_splits es
        JOIN users u ON u.id = es.user_id
        WHERE es.expense_id IN (${placeholders})
      `).all(...expenseIds) as any[];

      for (const s of splitsRaw) {
        if (!splitsMap[s.expense_id]) splitsMap[s.expense_id] = [];
        splitsMap[s.expense_id].push({
          id: s.id,
          expense_id: s.expense_id,
          user_id: s.user_id,
          amount_cents: s.amount_cents,
          percentage: s.percentage,
          shares: s.shares,
          user: JSON.parse(s.user_json),
        });
      }
    }

    const expenses: Expense[] = expensesRaw.map(e => ({
      id: e.id,
      trip_id: e.trip_id,
      created_by: e.created_by,
      title: e.title,
      amount_cents: e.amount_cents,
      category: e.category,
      paid_by: e.paid_by,
      split_type: e.split_type,
      expense_date: e.expense_date,
      notes: e.notes,
      receipt_image: e.receipt_image,
      created_at: e.created_at,
      updated_at: e.updated_at,
      deleted_at: e.deleted_at,
      payer: JSON.parse(e.payer_json),
      splits: splitsMap[e.id] || [],
    }));

    res.json({ expenses });
  } catch (err: any) {
    console.error('List expenses error:', err);
    res.status(500).json({ error: 'Failed to list expenses' });
  }
});

// 2. Create expense
router.post('/trips/:id/expenses', requireTripMember, (req: TripRequest, res: Response): void => {
  try {
    const parse = CreateExpenseSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const tripId = req.trip!.id;
    const currentUserId = req.user!.id;
    const { id, title, amount_cents, category, paid_by, split_type, expense_date, notes, receipt_image, splits } = parse.data;

    // Verify payer is an active member
    const payerMember = db.prepare(
      'SELECT id FROM trip_members WHERE trip_id = ? AND user_id = ? AND status = ?'
    ).get(tripId, paid_by, 'ACTIVE');

    if (!payerMember) {
      res.status(400).json({ error: 'The payer must be an active member of this trip.' });
      return;
    }

    // Verify all split participants are active members
    for (const p of splits) {
      const member = db.prepare(
        'SELECT id FROM trip_members WHERE trip_id = ? AND user_id = ? AND status = ?'
      ).get(tripId, p.user_id, 'ACTIVE');

      if (!member) {
        res.status(400).json({ error: `Participant with user ID ${p.user_id} is not an active member of this trip.` });
        return;
      }
    }

    // Calculate splits with exact penny accuracy
    const calculatedSplits = calculateSplits(split_type, amount_cents, splits);

    const expenseId = id || uuidv4();
    const now = new Date().toISOString();

    const insertExpense = db.prepare(`
      INSERT INTO expenses (
        id, trip_id, created_by, title, amount_cents, category, subcategory,
        paid_by, split_type, expense_date, notes, receipt_image,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSplit = db.prepare(`
      INSERT INTO expense_splits (
        id, expense_id, user_id, amount_cents, percentage, shares, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      insertExpense.run(
        expenseId,
        tripId,
        currentUserId,
        title.trim(),
        amount_cents,
        category,
        parse.data.subcategory || null,
        paid_by,
        split_type,
        expense_date,
        notes || null,
        receipt_image || null,
        now,
        now
      );

      for (const s of calculatedSplits) {
        insertSplit.run(
          uuidv4(),
          expenseId,
          s.user_id,
          s.amount_cents,
          s.percentage || null,
          s.shares || null,
          now
        );
      }
    });

    tx();

    res.status(201).json({
      expense: {
        id: expenseId,
        trip_id: tripId,
        created_by: currentUserId,
        title: title.trim(),
        amount_cents,
        category,
        subcategory: parse.data.subcategory || null,
        paid_by,
        split_type,
        expense_date,
        notes: notes || null,
        receipt_image: receipt_image || null,
        created_at: now,
        updated_at: now,
        splits: calculatedSplits,
      },
    });
  } catch (err: any) {
    console.error('Create expense error:', err);
    res.status(400).json({ error: err.message || 'Failed to create expense' });
  }
});

// 2b. Batch Expense Creation (Add multiple expenses in one go)
const BatchExpenseItemSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  amount_cents: z.number().int().positive('Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const CreateBatchExpensesSchema = z.object({
  paid_by: z.string().min(1, 'Payer is required'),
  split_type: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES']).default('EQUAL'),
  expense_date: z.string().min(1, 'Date is required'),
  participant_ids: z.array(z.string().min(1)).min(1, 'At least one participant required'),
  items: z.array(BatchExpenseItemSchema).min(1, 'At least one item is required'),
});

router.post('/trips/:id/expenses/batch', requireTripMember, (req: TripRequest, res: Response): void => {
  try {
    const parse = CreateBatchExpensesSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const tripId = req.trip!.id;
    const currentUserId = req.user!.id;
    const { paid_by, split_type, expense_date, participant_ids, items } = parse.data;

    // Verify payer is active member
    const payerMember = db.prepare(
      'SELECT id FROM trip_members WHERE trip_id = ? AND user_id = ? AND status = ?'
    ).get(tripId, paid_by, 'ACTIVE');

    if (!payerMember) {
      res.status(400).json({ error: 'The payer must be an active member of this trip.' });
      return;
    }

    // Verify participants
    for (const uid of participant_ids) {
      const mem = db.prepare(
        'SELECT id FROM trip_members WHERE trip_id = ? AND user_id = ? AND status = ?'
      ).get(tripId, uid, 'ACTIVE');
      if (!mem) {
        res.status(400).json({ error: `Participant ${uid} is not an active member.` });
        return;
      }
    }

    const now = new Date().toISOString();
    const createdExpenses: any[] = [];

    const insertExpense = db.prepare(`
      INSERT INTO expenses (
        id, trip_id, created_by, title, amount_cents, category, subcategory,
        paid_by, split_type, expense_date, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSplit = db.prepare(`
      INSERT INTO expense_splits (
        id, expense_id, user_id, amount_cents, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      for (const item of items) {
        const expenseId = item.id || uuidv4();
        const splits = calculateSplits(
          split_type,
          item.amount_cents,
          participant_ids.map(uid => ({ user_id: uid }))
        );

        insertExpense.run(
          expenseId,
          tripId,
          currentUserId,
          item.title.trim(),
          item.amount_cents,
          item.category,
          item.subcategory || null,
          paid_by,
          split_type,
          expense_date,
          item.notes || null,
          now,
          now
        );

        for (const s of splits) {
          insertSplit.run(uuidv4(), expenseId, s.user_id, s.amount_cents, now);
        }

        createdExpenses.push({
          id: expenseId,
          title: item.title.trim(),
          amount_cents: item.amount_cents,
          category: item.category,
          subcategory: item.subcategory,
          splits,
        });
      }
    });

    tx();

    res.status(201).json({
      message: `Successfully created ${items.length} expenses`,
      expenses: createdExpenses,
    });
  } catch (err: any) {
    console.error('Batch expense error:', err);
    res.status(400).json({ error: err.message || 'Failed to create batch expenses' });
  }
});

// 3. Edit expense (Owner or Expense Creator only)
router.put('/trips/:id/expenses/:expenseId', requireTripMember, (req: TripRequest, res: Response): void => {
  try {
    const { expenseId } = req.params;
    const tripId = req.trip!.id;
    const currentUserId = req.user!.id;
    const isTripOwner = req.tripRole === 'OWNER';

    const existing = db.prepare(
      'SELECT * FROM expenses WHERE id = ? AND trip_id = ? AND deleted_at IS NULL'
    ).get(expenseId, tripId) as any;

    if (!existing) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }

    if (!isTripOwner && existing.created_by !== currentUserId) {
      res.status(403).json({ error: 'Forbidden: You can only edit expenses you created, unless you are Trip Owner.' });
      return;
    }

    const parse = UpdateExpenseSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const { title, amount_cents, category, subcategory, paid_by, split_type, expense_date, notes, receipt_image, splits } = parse.data;

    const newAmount = amount_cents !== undefined ? amount_cents : existing.amount_cents;
    const newSplitType = split_type !== undefined ? split_type : existing.split_type;
    const newPaidBy = paid_by !== undefined ? paid_by : existing.paid_by;
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE expenses
        SET 
          title = COALESCE(?, title),
          amount_cents = COALESCE(?, amount_cents),
          category = COALESCE(?, category),
          subcategory = COALESCE(?, subcategory),
          paid_by = COALESCE(?, paid_by),
          split_type = COALESCE(?, split_type),
          expense_date = COALESCE(?, expense_date),
          notes = COALESCE(?, notes),
          receipt_image = COALESCE(?, receipt_image),
          updated_at = ?
        WHERE id = ?
      `).run(
        title !== undefined ? title : null,
        amount_cents !== undefined ? amount_cents : null,
        category !== undefined ? category : null,
        subcategory !== undefined ? subcategory : null,
        paid_by !== undefined ? paid_by : null,
        split_type !== undefined ? split_type : null,
        expense_date !== undefined ? expense_date : null,
        notes !== undefined ? notes : null,
        receipt_image !== undefined ? receipt_image : null,
        now,
        expenseId
      );

      // If splits were provided, recalculate and replace them
      if (splits && splits.length > 0) {
        const calculatedSplits = calculateSplits(newSplitType, newAmount, splits);
        db.prepare('DELETE FROM expense_splits WHERE expense_id = ?').run(expenseId);

        const insertSplit = db.prepare(`
          INSERT INTO expense_splits (
            id, expense_id, user_id, amount_cents, percentage, shares, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const s of calculatedSplits) {
          insertSplit.run(
            uuidv4(),
            expenseId,
            s.user_id,
            s.amount_cents,
            s.percentage || null,
            s.shares || null,
            now
          );
        }
      }
    });

    tx();

    res.json({ success: true, message: 'Expense updated successfully.' });
  } catch (err: any) {
    console.error('Update expense error:', err);
    res.status(400).json({ error: err.message || 'Failed to update expense' });
  }
});

// 4. Delete expense (Soft delete)
router.delete('/trips/:id/expenses/:expenseId', requireTripMember, (req: TripRequest, res: Response): void => {
  try {
    const { expenseId } = req.params;
    const tripId = req.trip!.id;
    const currentUserId = req.user!.id;
    const isTripOwner = req.tripRole === 'OWNER';

    const existing = db.prepare(
      'SELECT * FROM expenses WHERE id = ? AND trip_id = ? AND deleted_at IS NULL'
    ).get(expenseId, tripId) as any;

    if (!existing) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }

    if (!isTripOwner && existing.created_by !== currentUserId) {
      res.status(403).json({ error: 'Forbidden: You can only delete expenses you created, unless you are Trip Owner.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE expenses SET deleted_at = ? WHERE id = ?').run(now, expenseId);

    res.json({ success: true, message: 'Expense deleted successfully.' });
  } catch (err: any) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;
