import { localDb } from '../db/db.js';
import { User, Trip, TripMember, Expense, MemberBalance, SettlementTransaction, Settlement, NotificationItem, JoinRequest } from '../types/index.js';

const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken(): string | null {
    return this.token || localStorage.getItem('token');
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    const token = this.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = 'Network request failed';
      try {
        const errorJson = await response.json();
        errorMessage = errorJson.error || errorJson.message || errorMessage;
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  }

  // Auth
  async login(email: string, password: string):Promise<{ user: User; token: string }> {
    const res = await this.request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    await localDb.cachedUser.put({ key: 'current', user: res.user, token: res.token });
    return res;
  }

  async register(name: string, email: string, password: string, avatar?: string): Promise<{ user: User; token: string }> {
    const res = await this.request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, avatar }),
    });
    this.setToken(res.token);
    await localDb.cachedUser.put({ key: 'current', user: res.user, token: res.token });
    return res;
  }

  async getMe(): Promise<{ user: User }> {
    const res = await this.request<{ user: User }>('/auth/me');
    const token = this.getToken();
    if (token && res.user) {
      await localDb.cachedUser.put({ key: 'current', user: res.user, token });
    }
    return res;
  }

  async updateProfile(data: { name: string; email: string; avatar?: string | null }): Promise<{ user: User; token: string }> {
    const res = await this.request<{ user: User; token: string }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    this.setToken(res.token);
    await localDb.cachedUser.put({ key: 'current', user: res.user, token: res.token });
    return res;
  }

  async changePassword(data: { current_password: string; new_password: string }): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  logout() {
    this.setToken(null);
    localDb.cachedUser.clear();
  }

  // Trips
  async getTrips(): Promise<{ trips: Trip[] }> {
    try {
      const res = await this.request<{ trips: Trip[] }>('/trips');
      // Cache trips locally
      for (const t of res.trips) {
        await localDb.trips.put(t);
      }
      return res;
    } catch (err) {
      // Offline fallback: load from IndexedDB
      const cached = await localDb.trips.toArray();
      if (cached.length > 0) {
        return { trips: cached };
      }
      throw err;
    }
  }

  async createTrip(data: { name: string; description?: string; start_date?: string; end_date?: string; currency?: string }): Promise<{ trip: Trip }> {
    const res = await this.request<{ trip: Trip }>('/trips', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await localDb.trips.put(res.trip);
    return res;
  }

  async getTrip(id: string): Promise<{ trip: Trip }> {
    try {
      const res = await this.request<{ trip: Trip }>(`/trips/${id}`);
      await localDb.trips.put(res.trip);
      return res;
    } catch (err) {
      const cached = await localDb.trips.get(id);
      if (cached) return { trip: cached };
      throw err;
    }
  }

  async updateTrip(id: string, data: Partial<Trip>): Promise<{ trip: Trip }> {
    const res = await this.request<{ trip: Trip }>(`/trips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    await localDb.trips.put(res.trip);
    return res;
  }

  async deleteTrip(id: string): Promise<{ success: boolean }> {
    const res = await this.request<{ success: boolean }>(`/trips/${id}`, {
      method: 'DELETE',
    });
    await localDb.trips.delete(id);
    return res;
  }

  // Members
  async getMembers(tripId: string): Promise<{ members: TripMember[] }> {
    try {
      const res = await this.request<{ members: TripMember[] }>(`/trips/${tripId}/members`);
      for (const m of res.members) {
        await localDb.members.put(m);
      }
      return res;
    } catch (err) {
      const cached = await localDb.members.where('trip_id').equals(tripId).toArray();
      if (cached.length > 0) return { members: cached };
      throw err;
    }
  }

  async removeMember(tripId: string, memberUserId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/trips/${tripId}/members/${memberUserId}`, {
      method: 'DELETE',
    });
  }

  // Invitations & Join Requests
  async generateInvite(tripId: string): Promise<{ invitation: { token: string; id: string } }> {
    return this.request(`/trips/${tripId}/invitations`, { method: 'POST' });
  }

  async getInvitations(tripId: string): Promise<{ invitations: any[] }> {
    return this.request(`/trips/${tripId}/invitations`);
  }

  async revokeInvite(tripId: string, token: string): Promise<{ success: boolean }> {
    return this.request(`/trips/${tripId}/invitations/${token}`, { method: 'DELETE' });
  }

  async getInvitePreview(token: string): Promise<{ invitation: any }> {
    return this.request(`/join/${token}`);
  }

  async requestToJoin(token: string): Promise<{ message: string; status: string }> {
    return this.request(`/join/${token}/request`, { method: 'POST' });
  }

  async getJoinRequests(tripId: string): Promise<{ requests: JoinRequest[] }> {
    return this.request(`/trips/${tripId}/join-requests`);
  }

  async approveJoinRequest(tripId: string, requestId: string): Promise<{ success: boolean }> {
    return this.request(`/trips/${tripId}/join-requests/${requestId}/accept`, { method: 'POST' });
  }

  async rejectJoinRequest(tripId: string, requestId: string): Promise<{ success: boolean }> {
    return this.request(`/trips/${tripId}/join-requests/${requestId}/reject`, { method: 'POST' });
  }

  // Categories
  async getCategories(tripId: string): Promise<{ categories: import('../types/index.js').TripCategory[] }> {
    return this.request(`/trips/${tripId}/categories`);
  }

  async createCategory(tripId: string, data: { name: string; icon?: string; subcategory?: string; subcategories?: string[] }): Promise<{ category: import('../types/index.js').TripCategory }> {
    return this.request(`/trips/${tripId}/categories`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Expenses
  async getExpenses(tripId: string, filters: { category?: string; paid_by?: string; search?: string } = {}): Promise<{ expenses: Expense[] }> {
    try {
      const params = new URLSearchParams();
      if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
      if (filters.paid_by) params.append('paid_by', filters.paid_by);
      if (filters.search) params.append('search', filters.search);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await this.request<{ expenses: Expense[] }>(`/trips/${tripId}/expenses${qs}`);

      // Cache expenses in Dexie
      for (const exp of res.expenses) {
        await localDb.expenses.put(exp);
      }
      return res;
    } catch (err) {
      const cached = await localDb.expenses.where('trip_id').equals(tripId).toArray();
      const nonDeleted = cached.filter(e => !e.deleted_at);
      if (nonDeleted.length > 0) return { expenses: nonDeleted };
      throw err;
    }
  }

  async createExpense(tripId: string, payload: any): Promise<{ expense: Expense }> {
    const res = await this.request<{ expense: Expense }>(`/trips/${tripId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await localDb.expenses.put(res.expense);
    return res;
  }

  async createBatchExpenses(tripId: string, payload: {
    paid_by: string;
    split_type?: string;
    expense_date: string;
    participant_ids: string[];
    items: { title: string; amount_cents: number; category: string; subcategory?: string | null; notes?: string | null }[];
  }): Promise<{ message: string; expenses: any[] }> {
    return this.request(`/trips/${tripId}/expenses/batch`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateExpense(tripId: string, expenseId: string, payload: any): Promise<{ success: boolean }> {
    const res = await this.request<{ success: boolean }>(`/trips/${tripId}/expenses/${expenseId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res;
  }

  async deleteExpense(tripId: string, expenseId: string): Promise<{ success: boolean }> {
    const res = await this.request<{ success: boolean }>(`/trips/${tripId}/expenses/${expenseId}`, {
      method: 'DELETE',
    });
    const exp = await localDb.expenses.get(expenseId);
    if (exp) {
      exp.deleted_at = new Date().toISOString();
      await localDb.expenses.put(exp);
    }
    return res;
  }

  // Balances & Settlements
  async getBalances(tripId: string): Promise<{
    balances: MemberBalance[];
    recommendations: SettlementTransaction[];
    settlements: Settlement[];
  }> {
    try {
      const res = await this.request<{
        balances: MemberBalance[];
        recommendations: SettlementTransaction[];
        settlements: Settlement[];
      }>(`/trips/${tripId}/balances`);

      for (const s of res.settlements) {
        await localDb.settlements.put(s);
      }
      return res;
    } catch (err) {
      // Offline fallback: calculate directly from local Dexie!
      const members = await localDb.members.where('trip_id').equals(tripId).toArray();
      const expenses = await localDb.expenses.where('trip_id').equals(tripId).toArray();
      const settlements = await localDb.settlements.where('trip_id').equals(tripId).toArray();

      const { calculateLocalBalances, calculateLocalOptimalSettlements } = await import('../services/localSplitter.js');
      const balances = calculateLocalBalances(members, expenses, settlements);
      const recommendations = calculateLocalOptimalSettlements(balances);

      return { balances, recommendations, settlements };
    }
  }

  async recordSettlement(tripId: string, data: { from_user_id: string; to_user_id: string; amount_cents: number; status?: string; notes?: string }): Promise<{ settlement: Settlement }> {
    const res = await this.request<{ settlement: Settlement }>(`/trips/${tripId}/settlements`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await localDb.settlements.put(res.settlement);
    return res;
  }

  async updateSettlementStatus(tripId: string, settlementId: string, status: string): Promise<{ success: boolean }> {
    const res = await this.request<{ success: boolean }>(`/trips/${tripId}/settlements/${settlementId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    const s = await localDb.settlements.get(settlementId);
    if (s) {
      s.status = status as any;
      await localDb.settlements.put(s);
    }
    return res;
  }

  // Notifications
  async getNotifications(): Promise<{ notifications: NotificationItem[] }> {
    return this.request<{ notifications: NotificationItem[] }>('/notifications');
  }

  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'PUT' });
  }

  async markAllNotificationsRead(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/notifications/read-all', { method: 'PUT' });
  }

  // Offline Sync
  async syncBatch(items: any[]): Promise<{ processedIds: string[]; errors: any[] }> {
    return this.request<{ processedIds: string[]; errors: any[] }>('/sync', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  // Admin Portal API
  async getAdminStats(): Promise<{ stats: import('../types/index.js').AdminStats }> {
    return this.request<{ stats: import('../types/index.js').AdminStats }>('/admin/stats');
  }

  async getAdminUsers(): Promise<{ users: import('../types/index.js').AdminUser[] }> {
    return this.request<{ users: import('../types/index.js').AdminUser[] }>('/admin/users');
  }

  async adminResetPassword(userId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword }),
    });
  }

  async adminToggleUser(userId: string): Promise<{ success: boolean; is_admin: number; message: string }> {
    return this.request<{ success: boolean; is_admin: number; message: string }>(`/admin/users/${userId}/toggle-admin`, {
      method: 'POST',
    });
  }

  async adminDeleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async getAdminTrips(): Promise<{ trips: import('../types/index.js').AdminTrip[] }> {
    return this.request<{ trips: import('../types/index.js').AdminTrip[] }>('/admin/trips');
  }

  async adminDeleteTrip(tripId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/admin/trips/${tripId}`, {
      method: 'DELETE',
    });
  }

  async adminClaimRole(passkey: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/admin/claim', {
      method: 'POST',
      body: JSON.stringify({ passkey }),
    });
  }
}

export const api = new ApiClient();
