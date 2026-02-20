import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'platform.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// ─── Schema ───────────────────────────────────────────────────

// Users: The heart of the platform
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id TEXT PRIMARY KEY,
    username TEXT,
    ton_wallet TEXT,
    runtime TEXT DEFAULT 'nanobot', -- 'nanobot' | 'openclaw'
    plan TEXT DEFAULT 'starter',    -- 'starter' | 'pro'
    credits INTEGER DEFAULT 50000,   -- Free trial credits
    workspace_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Transactions: Ledger for credits (topups and usage)
db.exec(`
  CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT,
    amount INTEGER, -- negative for usage, positive for topup
    reason TEXT,   -- 'usage', 'topup', 'bonus'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(telegram_id) REFERENCES users(telegram_id)
  )
`);

// Crons: Scheduled tasks across all bots
db.exec(`
  CREATE TABLE IF NOT EXISTS crons (
    id TEXT PRIMARY KEY,
    telegram_id TEXT,
    schedule TEXT, -- cron expression
    message TEXT,  -- what to send the bot
    enabled INTEGER DEFAULT 1,
    last_run DATETIME,
    FOREIGN KEY(telegram_id) REFERENCES users(telegram_id)
  )
`);

export default db;
