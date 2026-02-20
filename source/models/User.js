import db from '../db.js';

export class UserModel {
  static get(userId) {
    return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(userId);
  }

  static create(userId, username) {
    db.prepare(`
      INSERT INTO users (telegram_id, username, workspace_path, credits)
      VALUES (?, ?, ?, ?)
    `).run(userId, username, `/root/.openclaw/workspaces/${userId}`, 50000);
    
    db.prepare('INSERT INTO ledger (telegram_id, amount, reason) VALUES (?, ?, ?)')
      .run(userId, 50000, 'trial');

    return this.get(userId);
  }

  static updateCredits(userId, delta, reason) {
    db.transaction(() => {
      db.prepare('UPDATE users SET credits = credits + ? WHERE telegram_id = ?').run(delta, userId);
      db.prepare('INSERT INTO ledger (telegram_id, amount, reason) VALUES (?, ?, ?)')
        .run(userId, delta, reason);
    })();
    return this.get(userId);
  }
}
