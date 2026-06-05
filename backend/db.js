const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const DB_PATH = path.join(__dirname, 'meet.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

function generateMeetCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const r = () => chars[Math.floor(Math.random() * chars.length)];
  return `${r()}${r()}${r()}-${r()}${r()}${r()}${r()}-${r()}${r()}${r()}`;
}

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL DEFAULT 'My Meeting',
      host_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      scheduled_at DATETIME,
      password TEXT,
      settings TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const canCreate = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('can_create_meetings');
  if (!canCreate) {
    db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)').run('can_create_meetings', 'true');
  }

  const admins = [
    { email: 'yairfrish2@gmail.com', password: 'prha12345', name: 'Yair Frish' },
    { email: 'przyyryair@gmail.com', password: 'yair2589', name: 'Yair Admin' }
  ];

  for (const admin of admins) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(admin.email);
    if (!existing) {
      const hashedPw = bcrypt.hashSync(admin.password, 10);
      db.prepare('INSERT INTO users (id, email, name, password, role) VALUES (?, ?, ?, ?, ?)').run(
        uuidv4(), admin.email, admin.name, hashedPw, 'admin'
      );
      console.log(`Admin created: ${admin.email}`);
    }
  }

  console.log('Database initialized');
}

module.exports = { db, initDB, generateMeetCode };
