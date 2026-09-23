import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:5000/api';

describe('Batch / Multi-Item Expense Splitting', () => {
  let token: string;
  let user: any;
  let tripId: string;

  it('Setup: creates trip with members', async () => {
    // Register
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Batch Organizer',
        email: `batch_${Date.now()}@example.com`,
        password: 'password123',
      }),
    });
    const regJson = await regRes.json();
    token = regJson.token;
    user = regJson.user;

    // Create Trip
    const tripRes = await fetch(`${BASE_URL}/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Batch Test Trip',
        currency: 'LKR',
      }),
    });
    const tripJson = await tripRes.json();
    tripId = tripJson.trip.id;
    assert.ok(tripId);
  });

  it('Creates 3 expenses in a single batch request', async () => {
    const res = await fetch(`${BASE_URL}/trips/${tripId}/expenses/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        paid_by: user.id,
        split_type: 'EQUAL',
        expense_date: '2026-10-10',
        participant_ids: [user.id],
        items: [
          { title: 'Lunch at Cafe', amount_cents: 450000, category: 'Food', subcategory: 'Rice & Curry' },
          { title: 'Highway Toll', amount_cents: 100000, category: 'Transport', subcategory: 'Toll' },
          { title: 'Snacks & Drinks', amount_cents: 320000, category: 'Food', subcategory: 'Shorties' },
        ],
      }),
    });
    const json = await res.json();
    assert.equal(res.status, 201);
    assert.equal(json.expenses.length, 3);
    assert.equal(json.expenses[0].title, 'Lunch at Cafe');
    assert.equal(json.expenses[1].title, 'Highway Toll');
    assert.equal(json.expenses[2].title, 'Snacks & Drinks');
  });

  it('Verifies all 3 expenses are listed in trip expenses and total updated', async () => {
    const res = await fetch(`${BASE_URL}/trips/${tripId}/expenses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.expenses.length, 3);

    const totalCents = json.expenses.reduce((acc: number, e: any) => acc + e.amount_cents, 0);
    assert.equal(totalCents, 870000); // 4500 + 1000 + 3200 = 8700 LKR
  });
});
