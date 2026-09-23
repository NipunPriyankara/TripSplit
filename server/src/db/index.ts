import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure db directory exists
const dbDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'trip_splitter.db');
export const db = new Database(dbPath);

// Enable WAL mode for high concurrency and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // Check and add subcategory column if missing
  const cols = db.pragma('table_info(expenses)') as { name: string }[];
  if (!cols.some(c => c.name === 'subcategory')) {
    try {
      db.exec('ALTER TABLE expenses ADD COLUMN subcategory TEXT;');
    } catch (e) {
      // already exists
    }
  }

  // Check and add is_admin column to users if missing
  const userCols = db.pragma('table_info(users)') as { name: string }[];
  if (!userCols.some(c => c.name === 'is_admin')) {
    try {
      db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;');
    } catch (e) {
      // already exists
    }
  }

  // Auto-promote first user to admin if no admin exists yet
  try {
    const adminCheck = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get() as { count: number };
    if (adminCheck && adminCheck.count === 0) {
      db.prepare('UPDATE users SET is_admin = 1 WHERE id IN (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)').run();
    }
  } catch (e) {
    // ignore
  }

  console.log('Database initialized successfully at:', dbPath);
}
