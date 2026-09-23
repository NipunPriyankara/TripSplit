import { User, UserRole, MemberBalance, SettlementTransaction, Settlement } from '../types/shared.js';

export interface ExpenseRecord {
  id: string;
  amount_cents: number;
  paid_by: string;
  deleted_at?: string | null;
  splits: {
    user_id: string;
    amount_cents: number;
  }[];
}

export interface SettlementRecord {
  id: string;
  from_user_id: string;
  to_user_id: string;
  amount_cents: number;
  status: 'PENDING' | 'PAID' | 'CONFIRMED';
}

export interface MemberRecord {
  user_id: string;
  role: UserRole;
  user: User;
}

export function calculateMemberBalances(
  members: MemberRecord[],
  expenses: ExpenseRecord[],
  settlements: SettlementRecord[] = []
): MemberBalance[] {
  const memberMap = new Map<string, MemberBalance>();

  for (const m of members) {
    memberMap.set(m.user_id, {
      user_id: m.user_id,
      user: m.user,
      role: m.role,
      total_paid_cents: 0,
      total_share_cents: 0,
      net_balance_cents: 0,
    });
  }

  // Aggregate active expenses
  for (const exp of expenses) {
    if (exp.deleted_at) continue;

    // Credit payer
    const payer = memberMap.get(exp.paid_by);
    if (payer) {
      payer.total_paid_cents += exp.amount_cents;
    }

    // Debit split participants
    for (const split of exp.splits) {
      const participant = memberMap.get(split.user_id);
      if (participant) {
        participant.total_share_cents += split.amount_cents;
      }
    }
  }

  // Aggregate confirmed or paid settlements
  for (const s of settlements) {
    if (s.status === 'PAID' || s.status === 'CONFIRMED') {
      const fromMember = memberMap.get(s.from_user_id);
      const toMember = memberMap.get(s.to_user_id);

      // Paying a settlement reduces the payer's debt (or increases their credit)
      if (fromMember) {
        fromMember.total_paid_cents += s.amount_cents;
      }
      // Receiving a settlement reduces the recipient's credit (or acts as their share)
      if (toMember) {
        toMember.total_share_cents += s.amount_cents;
      }
    }
  }

  // Compute net balance: Positive means group owes member (receives money),
  // Negative means member owes group (needs to pay money)
  for (const balance of memberMap.values()) {
    balance.net_balance_cents = balance.total_paid_cents - balance.total_share_cents;
  }

  return Array.from(memberMap.values());
}

/**
 * Greedy debt simplification algorithm minimizing total transaction count to at most N-1.
 */
export function calculateOptimalSettlements(
  balances: MemberBalance[]
): SettlementTransaction[] {
  // Filter into debtors and creditors with non-zero balances (tolerance of 1 cent)
  const debtors: { user_id: string; user: User; balance: number }[] = [];
  const creditors: { user_id: string; user: User; balance: number }[] = [];

  for (const b of balances) {
    if (b.net_balance_cents < 0) {
      debtors.push({ user_id: b.user_id, user: b.user, balance: b.net_balance_cents });
    } else if (b.net_balance_cents > 0) {
      creditors.push({ user_id: b.user_id, user: b.user, balance: b.net_balance_cents });
    }
  }

  // Sort debtors: deepest debt first (most negative)
  debtors.sort((a, b) => a.balance - b.balance);
  // Sort creditors: highest credit first (most positive)
  creditors.sort((a, b) => b.balance - a.balance);

  const transactions: SettlementTransaction[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const debtRemaining = Math.abs(debtor.balance);
    const creditRemaining = creditor.balance;

    const amount = Math.min(debtRemaining, creditRemaining);

    if (amount > 0) {
      transactions.push({
        from_user_id: debtor.user_id,
        from_user: debtor.user,
        to_user_id: creditor.user_id,
        to_user: creditor.user,
        amount_cents: amount,
        status: 'PENDING',
      });
    }

    debtor.balance += amount;
    creditor.balance -= amount;

    if (Math.abs(debtor.balance) === 0) {
      dIdx++;
    }
    if (creditor.balance === 0) {
      cIdx++;
    }
  }

  return transactions;
}
