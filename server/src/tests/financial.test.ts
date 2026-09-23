import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSplits } from '../services/expenseMath.js';
import { calculateMemberBalances, calculateOptimalSettlements } from '../services/settlementEngine.js';

describe('Financial Split Calculations', () => {
  it('splits equally with exact penny distribution (no fractional cents lost)', () => {
    // 100.00 LKR across 3 people = 33.34, 33.33, 33.33
    const splits = calculateSplits('EQUAL', 10000, [
      { user_id: 'user-1' },
      { user_id: 'user-2' },
      { user_id: 'user-3' },
    ]);

    assert.equal(splits.length, 3);
    const sum = splits.reduce((acc, s) => acc + s.amount_cents, 0);
    assert.equal(sum, 10000);
    assert.equal(splits[0].amount_cents, 3334);
    assert.equal(splits[1].amount_cents, 3333);
    assert.equal(splits[2].amount_cents, 3333);
  });

  it('splits exactly and validates strict sum equality', () => {
    const splits = calculateSplits('EXACT', 850000, [
      { user_id: 'user-1', amount_cents: 400000 },
      { user_id: 'user-2', amount_cents: 200000 },
      { user_id: 'user-3', amount_cents: 250000 },
    ]);

    assert.equal(splits.length, 3);
    const sum = splits.reduce((acc, s) => acc + s.amount_cents, 0);
    assert.equal(sum, 850000);
  });

  it('throws error if exact split sum does not match total amount', () => {
    assert.throws(() => {
      calculateSplits('EXACT', 850000, [
        { user_id: 'user-1', amount_cents: 400000 },
        { user_id: 'user-2', amount_cents: 200000 },
        { user_id: 'user-3', amount_cents: 200000 }, // sum 800,000 != 850,000
      ]);
    }, /does not equal/);
  });

  it('splits by percentage and assigns remainder to highest percentage', () => {
    // 100.00 LKR: 40%, 30%, 30%
    const splits = calculateSplits('PERCENTAGE', 10000, [
      { user_id: 'user-1', percentage: 40 },
      { user_id: 'user-2', percentage: 30 },
      { user_id: 'user-3', percentage: 30 },
    ]);

    const sum = splits.reduce((acc, s) => acc + s.amount_cents, 0);
    assert.equal(sum, 10000);
    assert.equal(splits.find(s => s.user_id === 'user-1')?.amount_cents, 4000);
    assert.equal(splits.find(s => s.user_id === 'user-2')?.amount_cents, 3000);
    assert.equal(splits.find(s => s.user_id === 'user-3')?.amount_cents, 3000);
  });

  it('splits by shares proportionally', () => {
    // Total 10,000: Nimal has 2 shares, Kasun has 1 share, Amal has 1 share (Total = 4 shares)
    const splits = calculateSplits('SHARES', 10000, [
      { user_id: 'nimal', shares: 2 },
      { user_id: 'kasun', shares: 1 },
      { user_id: 'amal', shares: 1 },
    ]);

    const sum = splits.reduce((acc, s) => acc + s.amount_cents, 0);
    assert.equal(sum, 10000);
    assert.equal(splits.find(s => s.user_id === 'nimal')?.amount_cents, 5000);
    assert.equal(splits.find(s => s.user_id === 'kasun')?.amount_cents, 2500);
    assert.equal(splits.find(s => s.user_id === 'amal')?.amount_cents, 2500);
  });
});

describe('Balance & Minimized Settlement Engine', () => {
  const members = [
    { user_id: 'nimal', role: 'OWNER' as const, user: { id: 'nimal', name: 'Nimal', email: 'nimal@test.com' } },
    { user_id: 'kasun', role: 'MEMBER' as const, user: { id: 'kasun', name: 'Kasun', email: 'kasun@test.com' } },
    { user_id: 'amal', role: 'MEMBER' as const, user: { id: 'amal', name: 'Amal', email: 'amal@test.com' } },
  ];

  it('correctly calculates member net balances from expenses', () => {
    // Nimal pays 9,000 split equally among all 3 (3,000 each)
    const expenses = [
      {
        id: 'exp-1',
        amount_cents: 9000,
        paid_by: 'nimal',
        splits: [
          { user_id: 'nimal', amount_cents: 3000 },
          { user_id: 'kasun', amount_cents: 3000 },
          { user_id: 'amal', amount_cents: 3000 },
        ],
      },
    ];

    const balances = calculateMemberBalances(members, expenses);
    const nimal = balances.find(b => b.user_id === 'nimal')!;
    const kasun = balances.find(b => b.user_id === 'kasun')!;
    const amal = balances.find(b => b.user_id === 'amal')!;

    assert.equal(nimal.net_balance_cents, 6000); // 9000 - 3000 = +6000 (Receives)
    assert.equal(kasun.net_balance_cents, -3000); // 0 - 3000 = -3000 (Owes)
    assert.equal(amal.net_balance_cents, -3000); // 0 - 3000 = -3000 (Owes)

    const settlements = calculateOptimalSettlements(balances);
    // Minimized transactions: Kasun -> Nimal (3000), Amal -> Nimal (3000)
    assert.equal(settlements.length, 2);
    assert.equal(settlements.every(s => s.to_user_id === 'nimal'), true);
  });

  it('minimizes cyclic or multi-party debts to <= N-1 transactions', () => {
    const m4 = [
      { user_id: 'A', role: 'OWNER' as const, user: { id: 'A', name: 'A', email: 'a@test.com' } },
      { user_id: 'B', role: 'MEMBER' as const, user: { id: 'B', name: 'B', email: 'b@test.com' } },
      { user_id: 'C', role: 'MEMBER' as const, user: { id: 'C', name: 'C', email: 'c@test.com' } },
      { user_id: 'D', role: 'MEMBER' as const, user: { id: 'D', name: 'D', email: 'd@test.com' } },
    ];

    const balances = [
      { user_id: 'A', role: 'OWNER' as const, user: m4[0].user, total_paid_cents: 100, total_share_cents: 40, net_balance_cents: 60 },
      { user_id: 'B', role: 'MEMBER' as const, user: m4[1].user, total_paid_cents: 60, total_share_cents: 40, net_balance_cents: 20 },
      { user_id: 'C', role: 'MEMBER' as const, user: m4[2].user, total_paid_cents: 0, total_share_cents: 40, net_balance_cents: -40 },
      { user_id: 'D', role: 'MEMBER' as const, user: m4[3].user, total_paid_cents: 0, total_share_cents: 40, net_balance_cents: -40 },
    ];

    const settlements = calculateOptimalSettlements(balances);
    assert.ok(settlements.length <= 3, `Expected <= 3 transactions, got ${settlements.length}`);

    // Sum of settlements must equal total net credits (+80)
    const totalSettled = settlements.reduce((acc, s) => acc + s.amount_cents, 0);
    assert.equal(totalSettled, 80);
  });
});
