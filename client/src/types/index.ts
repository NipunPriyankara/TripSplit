export type UserRole = 'OWNER' | 'MEMBER';
export type MemberStatus = 'ACTIVE' | 'REMOVED' | 'LEFT';
export type InvitationStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';
export type JoinRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type ExpenseCategory = 'Food' | 'Drinks' | 'Hotel' | 'Transport' | 'Fuel' | 'Tickets' | 'Shopping' | 'Other';
export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES';
export type SettlementStatus = 'PENDING' | 'PAID' | 'CONFIRMED';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  is_admin?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AdminStats {
  total_users: number;
  total_trips: number;
  total_expenses: number;
  total_volume_cents: number;
  total_settlements: number;
}

export interface AdminUser extends User {
  owned_trips_count: number;
  member_trips_count: number;
}

export interface AdminTripMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
  joined_at: string;
}

export interface AdminTrip {
  id: string;
  name: string;
  description?: string | null;
  currency: string;
  created_at: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  member_count: number;
  members: AdminTripMember[];
  expense_count: number;
  total_expense_cents: number;
}

export interface Trip {
  id: string;
  owner_id: string;
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  currency: string;
  cover_image?: string | null;
  created_at?: string;
  updated_at?: string;
  role?: UserRole;
  member_count?: number;
  total_expenses_cents?: number;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  role: UserRole;
  status: MemberStatus;
  joined_at: string;
  user?: User;
}

export interface Invitation {
  id: string;
  trip_id: string;
  token: string;
  created_by: string;
  expires_at?: string | null;
  max_uses?: number | null;
  usage_count: number;
  status: InvitationStatus;
  created_at: string;
}

export interface JoinRequest {
  id: string;
  trip_id: string;
  user_id: string;
  status: JoinRequestStatus;
  requested_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  user?: User;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount_cents: number;
  percentage?: number | null;
  shares?: number | null;
  user?: User;
}

export interface TripCategory {
  id: string;
  trip_id: string;
  name: string;
  icon?: string | null;
  subcategories: string[];
  created_at?: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  created_by: string;
  title: string;
  amount_cents: number;
  category: string;
  subcategory?: string | null;
  paid_by: string;
  split_type: SplitType;
  expense_date: string;
  notes?: string | null;
  receipt_image?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  splits?: ExpenseSplit[];
  payer?: User;
}

export interface MemberBalance {
  user_id: string;
  user: User;
  role: UserRole;
  total_paid_cents: number;
  total_share_cents: number;
  net_balance_cents: number;
}

export interface SettlementTransaction {
  id?: string;
  from_user_id: string;
  from_user: User;
  to_user_id: string;
  to_user: User;
  amount_cents: number;
  status: SettlementStatus;
}

export interface Settlement {
  id: string;
  trip_id: string;
  from_user_id: string;
  to_user_id: string;
  amount_cents: number;
  status: SettlementStatus;
  created_at: string;
  confirmed_at?: string | null;
  notes?: string | null;
  from_user?: User;
  to_user?: User;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  trip_id?: string | null;
  type: string;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
}

export interface SyncQueueItem {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'expense' | 'trip' | 'settlement';
  entityId: string;
  payload: any;
  timestamp: string;
}
