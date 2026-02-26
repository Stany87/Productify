import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'productify.db'));
db.pragma('foreign_keys = OFF');

console.log('--- Checking table schemas ---');

// Check current schemas
const tables = ['daily_habits', 'daily_stats', 'daily_overrides'];
for (const t of tables) {
    const info = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(t);
    console.log(`\n${t}:`, info ? info.sql : 'NOT FOUND');
}

console.log('\n--- Rebuilding tables with userId in UNIQUE constraints ---\n');

db.transaction(() => {
    // Fix daily_habits: UNIQUE(userId, date, habitType)
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS daily_habits_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL DEFAULT 1,
                date TEXT NOT NULL,
                habitType TEXT NOT NULL,
                targetValue REAL NOT NULL,
                currentValue REAL DEFAULT 0,
                UNIQUE(userId, date, habitType),
                FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            );
            INSERT OR IGNORE INTO daily_habits_new (id, userId, date, habitType, targetValue, currentValue)
                SELECT id, COALESCE(userId,1), date, habitType, targetValue, currentValue FROM daily_habits;
            DROP TABLE daily_habits;
            ALTER TABLE daily_habits_new RENAME TO daily_habits;
        `);
        console.log('✅ daily_habits rebuilt with UNIQUE(userId, date, habitType)');
    } catch (e) {
        console.error('❌ daily_habits:', e.message);
    }

    // Fix daily_stats: UNIQUE(userId, date)
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS daily_stats_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL DEFAULT 1,
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
            INSERT OR IGNORE INTO daily_stats_new (id, userId, date, sessionsCompleted, sessionsTotal, leetcodeCompleted, leetcodeTarget, punishmentItems, waterLiters, workoutDone)
                SELECT id, COALESCE(userId,1), date, sessionsCompleted, sessionsTotal, leetcodeCompleted, leetcodeTarget, punishmentItems, waterLiters, workoutDone FROM daily_stats;
            DROP TABLE daily_stats;
            ALTER TABLE daily_stats_new RENAME TO daily_stats;
        `);
        console.log('✅ daily_stats rebuilt with UNIQUE(userId, date)');
    } catch (e) {
        console.error('❌ daily_stats:', e.message);
    }

    // Fix daily_overrides: UNIQUE(userId, date)
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS daily_overrides_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL DEFAULT 1,
                date TEXT NOT NULL,
                reason TEXT NOT NULL,
                createdAt TEXT DEFAULT (datetime('now')),
                UNIQUE(userId, date),
                FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            );
            INSERT OR IGNORE INTO daily_overrides_new (id, userId, date, reason, createdAt)
                SELECT id, COALESCE(userId,1), date, reason, createdAt FROM daily_overrides;
            DROP TABLE daily_overrides;
            ALTER TABLE daily_overrides_new RENAME TO daily_overrides;
        `);
        console.log('✅ daily_overrides rebuilt with UNIQUE(userId, date)');
    } catch (e) {
        console.error('❌ daily_overrides:', e.message);
    }
})();

// Recreate indexes
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_daily_habits_user ON daily_habits(userId, date);
    CREATE INDEX IF NOT EXISTS idx_daily_stats_user ON daily_stats(userId, date);
    CREATE INDEX IF NOT EXISTS idx_daily_habits_date ON daily_habits(date);
    CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
`);

console.log('\n--- Verifying new schemas ---');
for (const t of tables) {
    const info = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(t);
    console.log(`\n${t}:`, info ? info.sql : 'NOT FOUND');
}

console.log('\n✅ Migration complete!');
db.close();
