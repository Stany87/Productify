import Database from 'better-sqlite3';

const db = new Database('./server/productify.db');

const tables = [
    'user_profile',
    'baseline_sessions',
    'daily_sessions',
    'punishment_backlog',
    'daily_habits',
    'daily_overrides',
    'daily_stats'
];

console.log('--- STARTING USER_ID MIGRATION ---');

try {
    // Ensure at least one user exists to assign data to (if no users, we'll wait for first signup)
    const user = db.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get();
    const defaultUserId = user ? user.id : 1;

    if (!user) {
        console.log('No users found in database. Data will be assigned to userId = 1 by default.');
    } else {
        console.log(`Assigning existing data to userId = ${defaultUserId} (${user.email || 'first user'})`);
    }

    db.transaction(() => {
        for (const table of tables) {
            try {
                const result = db.prepare(`UPDATE ${table} SET userId = ? WHERE userId IS NULL OR userId = 1`).run(defaultUserId);
                console.log(`Updated ${table}: ${result.changes} rows`);
            } catch (err) {
                console.error(`Failed to update ${table}:`, err.message);
            }
        }
    })();

    console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
} catch (err) {
    console.error('Migration failed:', err.message);
} finally {
    db.close();
}
