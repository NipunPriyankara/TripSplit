import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:5000/api';

describe('End-to-End Group Trip API Lifecycle', () => {
  let nimalToken: string;
  let nimalUser: any;
  let kasunToken: string;
  let kasunUser: any;
  let tripId: string;
  let inviteToken: string;
  let requestId: string;

  it('1. Registers Nimal (Owner) and Kasun (Member)', async () => {
    // Register Nimal
    const nimalRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nimal Perera',
        email: `nimal_${Date.now()}@example.com`,
        password: 'password123',
      }),
    });
    const nimalJson = await nimalRes.json();
    assert.equal(nimalRes.status, 201);
    nimalToken = nimalJson.token;
    nimalUser = nimalJson.user;
    assert.ok(nimalToken);

    // Register Kasun
    const kasunRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Kasun Perera',
        email: `kasun_${Date.now()}@example.com`,
        password: 'password123',
      }),
    });
    const kasunJson = await kasunRes.json();
    assert.equal(kasunRes.status, 201);
    kasunToken = kasunJson.token;
    kasunUser = kasunJson.user;
    assert.ok(kasunToken);
  });

  it('2. Nimal creates Trip "2026 Ella Trip"', async () => {
    const res = await fetch(`${BASE_URL}/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nimalToken}`,
      },
      body: JSON.stringify({
        name: '2026 Ella Trip',
        description: 'Weekend getaway with friends',
        start_date: '2026-10-10',
        end_date: '2026-10-12',
        currency: 'LKR',
      }),
    });
    const json = await res.json();
    assert.equal(res.status, 201);
    tripId = json.trip.id;
    assert.equal(json.trip.name, '2026 Ella Trip');
    assert.equal(json.trip.role, 'OWNER');
  });

  it('3. Kasun is blocked from accessing private trip room before approval', async () => {
    const res = await fetch(`${BASE_URL}/trips/${tripId}`, {
      headers: { Authorization: `Bearer ${kasunToken}` },
    });
    assert.equal(res.status, 403);
  });

  it('4. Nimal generates Invitation Link token', async () => {
    const res = await fetch(`${BASE_URL}/trips/${tripId}/invitations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${nimalToken}` },
    });
    const json = await res.json();
    assert.equal(res.status, 201);
    inviteToken = json.invitation.token;
    assert.ok(inviteToken);
  });

  it('5. Public preview of invitation does not expose private room data', async () => {
    const res = await fetch(`${BASE_URL}/join/${inviteToken}`);
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.invitation.trip_name, '2026 Ella Trip');
    assert.equal(json.invitation.owner_name, 'Nimal Perera');
    // Ensure expenses or members are NOT leaked
    assert.equal(json.invitation.expenses, undefined);
    assert.equal(json.invitation.members, undefined);
  });

  it('6. Kasun submits a Join Request', async () => {
    const res = await fetch(`${BASE_URL}/join/${inviteToken}/request`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kasunToken}` },
    });
    const json = await res.json();
    assert.equal(res.status, 201);
    assert.equal(json.status, 'PENDING');
  });

  it('7. Nimal sees pending Join Request and approves Kasun', async () => {
    const listRes = await fetch(`${BASE_URL}/trips/${tripId}/join-requests`, {
      headers: { Authorization: `Bearer ${nimalToken}` },
    });
    const listJson = await listRes.json();
    assert.equal(listJson.requests.length, 1);
    requestId = listJson.requests[0].id;

    // Approve
    const approveRes = await fetch(`${BASE_URL}/trips/${tripId}/join-requests/${requestId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${nimalToken}` },
    });
    const approveJson = await approveRes.json();
    assert.equal(approveJson.success, true);
  });

  it('8. Kasun now has access to the private trip room', async () => {
    const res = await fetch(`${BASE_URL}/trips/${tripId}`, {
      headers: { Authorization: `Bearer ${kasunToken}` },
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.trip.name, '2026 Ella Trip');
    assert.equal(json.trip.role, 'MEMBER');
  });

  it('9. Nimal logs an expense: "Dinner" Rs. 8,500 split equally with Kasun', async () => {
    const res = await fetch(`${BASE_URL}/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nimalToken}`,
      },
      body: JSON.stringify({
        title: 'Dinner at Cafe Chill',
        amount_cents: 850000, // Rs. 8,500.00
        category: 'Food',
        paid_by: nimalUser.id,
        split_type: 'EQUAL',
        expense_date: '2026-10-10',
        splits: [{ user_id: nimalUser.id }, { user_id: kasunUser.id }],
      }),
    });
    const json = await res.json();
    assert.equal(res.status, 201);
    assert.equal(json.expense.amount_cents, 850000);
  });

  it('10. Balance and Minimized Settlement verification', async () => {
    const res = await fetch(`${BASE_URL}/trips/${tripId}/balances`, {
      headers: { Authorization: `Bearer ${kasunToken}` },
    });
    const json = await res.json();
    assert.equal(res.status, 200);

    const nimalBalance = json.balances.find((b: any) => b.user_id === nimalUser.id);
    const kasunBalance = json.balances.find((b: any) => b.user_id === kasunUser.id);

    // Nimal paid 8,500, share is 4,250 -> Net = +4,250
    assert.equal(nimalBalance.net_balance_cents, 425000);
    // Kasun paid 0, share is 4,250 -> Net = -4,250
    assert.equal(kasunBalance.net_balance_cents, -425000);

    // Optimized settlement recommendation: Kasun -> Nimal Rs. 4,250
    assert.equal(json.recommendations.length, 1);
    assert.equal(json.recommendations[0].from_user_id, kasunUser.id);
    assert.equal(json.recommendations[0].to_user_id, nimalUser.id);
    assert.equal(json.recommendations[0].amount_cents, 425000);
  });

  it('11. Kasun records settlement payment of Rs. 4,250 to Nimal', async () => {
    const res = await fetch(`${BASE_URL}/trips/${tripId}/settlements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kasunToken}`,
      },
      body: JSON.stringify({
        from_user_id: kasunUser.id,
        to_user_id: nimalUser.id,
        amount_cents: 425000,
        status: 'CONFIRMED',
        notes: 'Commercial Bank transfer',
      }),
    });
    const json = await res.json();
    assert.equal(res.status, 201);

    // Re-check balances
    const balRes = await fetch(`${BASE_URL}/trips/${tripId}/balances`, {
      headers: { Authorization: `Bearer ${nimalToken}` },
    });
    const balJson = await balRes.json();

    const nimalBalance = balJson.balances.find((b: any) => b.user_id === nimalUser.id);
    const kasunBalance = balJson.balances.find((b: any) => b.user_id === kasunUser.id);

    // Both should now be exactly 0 (fully settled up)
    assert.equal(nimalBalance.net_balance_cents, 0);
    assert.equal(kasunBalance.net_balance_cents, 0);
    // Recommendations should now be empty
    assert.equal(balJson.recommendations.length, 0);
  });
});
