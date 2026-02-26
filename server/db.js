import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'productify.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ──── Migrations for existing DB (single-user → multi-user) ────

const tablesToMigrate = [
  { table: 'user_profile', col: 'userId', sql: "ALTER TABLE user_profile ADD COLUMN userId INTEGER DEFAULT 1" },
  { table: 'baseline_sessions', col: 'userId', sql: "ALTER TABLE baseline_sessions ADD COLUMN userId INTEGER DEFAULT 1" },
  { table: 'daily_sessions', col: 'userId', sql: "ALTER TABLE daily_sessions ADD COLUMN userId INTEGER DEFAULT 1" },
  { table: 'punishment_backlog', col: 'userId', sql: "ALTER TABLE punishment_backlog ADD COLUMN userId INTEGER DEFAULT 1" },
  { table: 'daily_habits', col: 'userId', sql: "ALTER TABLE daily_habits ADD COLUMN userId INTEGER DEFAULT 1" },
  { table: 'daily_overrides', col: 'userId', sql: "ALTER TABLE daily_overrides ADD COLUMN userId INTEGER DEFAULT 1" },
  { table: 'daily_stats', col: 'userId', sql: "ALTER TABLE daily_stats ADD COLUMN userId INTEGER DEFAULT 1" }
];

// Add userId columns FIRST so indexes don't fail
for (const m of tablesToMigrate) {
  try {
    db.prepare(`SELECT ${m.col} FROM ${m.table} LIMIT 1`).get();
  } catch (err) {
    if (err.message.includes('no such column') || err.message.includes('no such table')) {
      try { db.exec(m.sql); } catch (e) { /* ignore if table doesn't exist yet */ }
    }
  }
}

// ──── V5 Schema: Multi-User Session Engine ────

db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    displayName TEXT NOT NULL DEFAULT 'User',
    passwordHash TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  -- User profile
  CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL UNIQUE,
    lifeDescription TEXT NOT NULL DEFAULT '',
    leetcodeTarget INTEGER DEFAULT 5,
    leetcodeUsername TEXT DEFAULT '',
    skillFocuses TEXT DEFAULT '[]',
    waterTarget REAL DEFAULT 4.0,
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
  );

  -- AI-generated master sessions
  CREATE TABLE IF NOT EXISTS baseline_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    name TEXT NOT NULL,
    dayOfWeek INTEGER NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    type TEXT DEFAULT 'fixed',
    category TEXT DEFAULT 'other',
    icon TEXT DEFAULT '📚',
    color TEXT DEFAULT '#10b981',
    items TEXT DEFAULT '[]',
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Daily generated sessions
  CREATE TABLE IF NOT EXISTS daily_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    type TEXT DEFAULT 'normal',
    category TEXT DEFAULT 'other',
    status TEXT DEFAULT 'pending',
    icon TEXT DEFAULT '📚',
    color TEXT DEFAULT '#10b981',
    trackedTime INTEGER DEFAULT 0,
    trackingStartedAt TEXT,
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Sub-items within sessions
  CREATE TABLE IF NOT EXISTS session_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessionId INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'other',
    targetCount INTEGER DEFAULT 1,
    completedCount INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    FOREIGN KEY(sessionId) REFERENCES daily_sessions(id) ON DELETE CASCADE
  );

  -- Punishment backlog
  CREATE TABLE IF NOT EXISTS punishment_backlog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    missedCount INTEGER NOT NULL,
    originalDate TEXT NOT NULL,
    sourceSession TEXT,
    assignedToDate TEXT,
    resolved INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Daily habits
  CREATE TABLE IF NOT EXISTS daily_habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    date TEXT NOT NULL,
    habitType TEXT NOT NULL,
    targetValue REAL NOT NULL,
    currentValue REAL DEFAULT 0,
    UNIQUE(userId, date, habitType),
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
  );

  -- AI daily overrides
  CREATE TABLE IF NOT EXISTS daily_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    date TEXT NOT NULL,
    reason TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    UNIQUE(userId, date),
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Daily stats
  CREATE TABLE IF NOT EXISTS daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    date TEXT NOT NULL,
    sessionsCompleted INTEGER DEFAULT 0,
    sessionsTotal INTEGER DEFAULT 0,
    leetcodeCompleted INTEGER DEFAULT 0,
    leetcodeTarget INTEGER DEFAULT 0,
    punishmentItems INTEGER DEFAULT 0,
    waterLiters REAL DEFAULT 0,
    workoutDone INTEGER DEFAULT 0,
    UNIQUE(userId, date),
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_daily_sessions_date ON daily_sessions(date);
  CREATE INDEX IF NOT EXISTS idx_daily_sessions_user ON daily_sessions(userId, date);
  CREATE INDEX IF NOT EXISTS idx_session_items_session ON session_items(sessionId);
  CREATE INDEX IF NOT EXISTS idx_punishment_resolved ON punishment_backlog(resolved);
  CREATE INDEX IF NOT EXISTS idx_punishment_user ON punishment_backlog(userId, resolved);
  CREATE INDEX IF NOT EXISTS idx_daily_habits_date ON daily_habits(date);
  CREATE INDEX IF NOT EXISTS idx_daily_habits_user ON daily_habits(userId, date);
  CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
  CREATE INDEX IF NOT EXISTS idx_daily_stats_user ON daily_stats(userId, date);
  CREATE INDEX IF NOT EXISTS idx_baseline_dow ON baseline_sessions(dayOfWeek);
  CREATE INDEX IF NOT EXISTS idx_baseline_user ON baseline_sessions(userId, dayOfWeek);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`);

// Migration for leetcodeUsername
try {
  db.prepare("SELECT leetcodeUsername FROM user_profile LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE user_profile ADD COLUMN leetcodeUsername TEXT DEFAULT ''");
}

export default db;
