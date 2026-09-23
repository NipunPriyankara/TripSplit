import Dexie, { Table } from 'dexie';
import { Trip, TripMember, Expense, ExpenseSplit, Settlement, SyncQueueItem, User } from '../types/index.js';

export class TripSplitterDB extends Dexie {
  trips!: Table<Trip, string>;
  members!: Table<TripMember, string>;
  expenses!: Table<Expense, string>;
  splits!: Table<ExpenseSplit, string>;
  settlements!: Table<Settlement, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  cachedUser!: Table<{ key: string; user: User; token: string }, string>;

  constructor() {
    super('TripSplitterDB');
    this.version(1).stores({
      trips: 'id, owner_id, name, updated_at',
      members: 'id, trip_id, user_id, role',
      expenses: 'id, trip_id, paid_by, expense_date, updated_at, deleted_at',
      splits: 'id, expense_id, user_id',
      settlements: 'id, trip_id, from_user_id, to_user_id, status',
      syncQueue: 'id, action, entity, entityId, timestamp',
      cachedUser: 'key',
    });
  }
}

export const localDb = new TripSplitterDB();
