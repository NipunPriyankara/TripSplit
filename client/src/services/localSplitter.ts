import { MemberBalance, SettlementTransaction, User, UserRole, Expense, Settlement, TripMember } from '../types/index.js';

export function calculateLocalBalances(
  members: TripMember[],
  expenses: Expense[],
  settlements: Settlement[] = []
): MemberBalance[] {
  const memberMap = new Map<string, MemberBalance>();

  for (const m of members) {
    if (m.status !== 'ACTIVE' || !m.user) continue;
    memberMap.set(m.user_id, {
      user_id: m.user_id,
      user: m.user,
      role: m.role,
      total_paid_cents: 0,
      total_share_cents: 0,
      net_balance_cents: 0,
    });
  }

  for (const exp of expenses) {
    if (exp.deleted_at) continue;

    // Credit payer
    const payer = memberMap.get(exp.paid_by);
    if (payer) {
      payer.total_paid_cents += exp.amount_cents;
    }

    // Debit split participants
    if (exp.splits) {
      for (const split of exp.splits) {
        const participant = memberMap.get(split.user_id);
        if (participant) {
          participant.total_share_cents += split.amount_cents;
        }
      }
    }
  }

  for (const s of settlements) {
    if (s.status === 'PAID' || s.status === 'CONFIRMED') {
      const fromMember = memberMap.get(s.from_user_id);
      const toMember = memberMap.get(s.to_user_id);
      if (fromMember) {
        fromMember.total_paid_cents += s.amount_cents;
      }
      if (toMember) {
        toMember.total_share_cents += s.amount_cents;
      }
    }
  }

  for (const b of memberMap.values()) {
    b.net_balance_cents = b.total_paid_cents - b.total_share_cents;
  }

  return Array.from(memberMap.values());
}

export function calculateLocalOptimalSettlements(
  balances: MemberBalance[]
): SettlementTransaction[] {
  const debtors: { user_id: string; user: User; balance: number }[] = [];
  const creditors: { user_id: string; user: User; balance: number }[] = [];

  for (const b of balances) {
    if (b.net_balance_cents < 0) {
      debtors.push({ user_id: b.user_id, user: b.user, balance: b.net_balance_cents });
    } else if (b.net_balance_cents > 0) {
      creditors.push({ user_id: b.user_id, user: b.user, balance: b.net_balance_cents });
    }
  }

  debtors.sort((a, b) => a.balance - b.balance);
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

    if (Math.abs(debtor.balance) === 0) dIdx++;
    if (creditor.balance === 0) cIdx++;
  }

  return transactions;
}
