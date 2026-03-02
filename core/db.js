import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';
import os from 'os';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || join(os.homedir(), '.openclaw');
const DB_DIR = join(OPENCLAW_HOME, 'panel');
const DB_PATH = join(DB_DIR, 'panel.db');

mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ── Schema ────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS terminal_tabs (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL DEFAULT 'Terminal',
    agent_id   TEXT NOT NULL DEFAULT 'main',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_used  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS log_entries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id   TEXT NOT NULL,
    type       TEXT NOT NULL,
    time       TEXT NOT NULL,
    text       TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_log_agent ON log_entries (agent_id, created_at DESC);
`);

// ── Terminal tabs ─────────────────────────────────────────────
export const tabs = {
  list: (agentId) =>
    db.prepare('SELECT * FROM terminal_tabs WHERE agent_id = ? ORDER BY last_used DESC').all(agentId),

  get: (id) =>
    db.prepare('SELECT * FROM terminal_tabs WHERE id = ?').get(id),

  upsert: (id, name, agentId) =>
    db.prepare(`
      INSERT INTO terminal_tabs (id, name, agent_id, last_used)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, last_used = unixepoch()
    `).run(id, name, agentId),

  touch: (id) =>
    db.prepare('UPDATE terminal_tabs SET last_used = unixepoch() WHERE id = ?').run(id),

  rename: (id, name) =>
    db.prepare('UPDATE terminal_tabs SET name = ? WHERE id = ?').run(name, id),

  delete: (id) =>
    db.prepare('DELETE FROM terminal_tabs WHERE id = ?').run(id),
};

// ── Log entries ───────────────────────────────────────────────
const INSERT_LOG = db.prepare(
  'INSERT INTO log_entries (agent_id, type, time, text) VALUES (?, ?, ?, ?)'
);
const RECENT_LOGS = db.prepare(
  'SELECT type, time, text FROM log_entries WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?'
);
const PRUNE_LOGS = db.prepare(
  `DELETE FROM log_entries WHERE agent_id = ? AND id NOT IN (
     SELECT id FROM log_entries WHERE agent_id = ? ORDER BY created_at DESC LIMIT 500
   )`
);

export const logs = {
  insert: (agentId, entry) => {
    INSERT_LOG.run(agentId, entry.type, entry.time, entry.text);
  },

  recent: (agentId, limit = 200) =>
    RECENT_LOGS.all(agentId, limit).reverse(),

  prune: (agentId) =>
    PRUNE_LOGS.run(agentId, agentId),
};

export default db;
