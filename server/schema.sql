-- Productify PostgreSQL Schema for Supabase

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  displayName TEXT NOT NULL DEFAULT 'User',
  passwordHash TEXT NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- User profile
CREATE TABLE IF NOT EXISTS user_profile (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  lifeDescription TEXT NOT NULL DEFAULT '',
  leetcodeTarget INTEGER DEFAULT 5,
  leetcodeUsername TEXT DEFAULT '',
  skillFocuses TEXT DEFAULT '[]',
  waterTarget DOUBLE PRECISION DEFAULT 4.0,
  updatedAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Master sessions
CREATE TABLE IF NOT EXISTS baseline_sessions (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dayOfWeek INTEGER NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  type TEXT DEFAULT 'fixed',
  category TEXT DEFAULT 'other',
  icon TEXT DEFAULT '📚',
  color TEXT DEFAULT '#10b981',
  items TEXT DEFAULT '[]'
);

-- Daily generated sessions
CREATE TABLE IF NOT EXISTS daily_sessions (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  trackingStartedAt TEXT
);

-- Sub-items within sessions
CREATE TABLE IF NOT EXISTS session_items (
  id SERIAL PRIMARY KEY,
  sessionId INTEGER NOT NULL REFERENCES daily_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  targetCount INTEGER DEFAULT 1,
  completedCount INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0
);

-- Punishment backlog
CREATE TABLE IF NOT EXISTS punishment_backlog (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  missedCount INTEGER NOT NULL,
  originalDate TEXT NOT NULL,
  sourceSession TEXT,
  assignedToDate TEXT,
  resolved INTEGER DEFAULT 0,
  createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Daily habits
CREATE TABLE IF NOT EXISTS daily_habits (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  habitType TEXT NOT NULL,
  targetValue DOUBLE PRECISION NOT NULL,
  currentValue DOUBLE PRECISION DEFAULT 0,
  UNIQUE(userId, date, habitType)
);

-- AI daily overrides
CREATE TABLE IF NOT EXISTS daily_overrides (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  reason TEXT NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(userId, date)
);

-- Daily stats
CREATE TABLE IF NOT EXISTS daily_stats (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  sessionsCompleted INTEGER DEFAULT 0,
  sessionsTotal INTEGER DEFAULT 0,
  leetcodeCompleted INTEGER DEFAULT 0,
  leetcodeTarget INTEGER DEFAULT 0,
  punishmentItems INTEGER DEFAULT 0,
  waterLiters DOUBLE PRECISION DEFAULT 0,
  workoutDone INTEGER DEFAULT 0,
  UNIQUE(userId, date)
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
