import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:5000/api';

describe('User Profile & Password Management', () => {
  let token: string;
  let user: any;

  it('Registers a test user for profile updates', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Profile Tester',
        email: `tester_${Date.now()}@example.com`,
        password: 'initialPassword123',
      }),
    });
    const json = await res.json();
    assert.equal(res.status, 201);
    token = json.token;
    user = json.user;
    assert.ok(token);
  });

  it('Updates username, email, and avatar', async () => {
    const newEmail = `updated_${Date.now()}@example.com`;
    const res = await fetch(`${BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Updated Name',
        email: newEmail,
        avatar: '🏄',
      }),
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.user.name, 'Updated Name');
    assert.equal(json.user.email, newEmail);
    assert.equal(json.user.avatar, '🏄');
    assert.ok(json.token);
    token = json.token;
  });

  it('Changes password with valid current password', async () => {
    const res = await fetch(`${BASE_URL}/auth/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        current_password: 'initialPassword123',
        new_password: 'newSecretPassword123',
      }),
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
  });

  it('Fails password change when current password is wrong', async () => {
    const res = await fetch(`${BASE_URL}/auth/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        current_password: 'wrongPassword123',
        new_password: 'anotherNewPassword123',
      }),
    });
    const json = await res.json();
    assert.equal(res.status, 400);
    assert.match(json.error, /Current password is incorrect/i);
  });
});
