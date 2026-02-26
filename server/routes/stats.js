import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/stats/:date
router.get('/:date', (req, res) => {
    const { date } = req.params;

    const sessions = db.prepare('SELECT * FROM daily_sessions WHERE userId = ? AND date = ?').all(req.userId, date);
    const itemsStmt = db.prepare('SELECT * FROM session_items WHERE sessionId = ?');

    let leetcodeCompleted = 0, leetcodeTarget = 0;
    let sessionsCompleted = 0;

    for (const s of sessions) {
        if (s.status === 'completed') sessionsCompleted++;
        const items = itemsStmt.all(s.id);
        for (const item of items) {
            if (item.category === 'leetcode') {
                leetcodeTarget += item.targetCount;
                leetcodeCompleted += item.completedCount;
            }
        }
    }

    const habits = db.prepare('SELECT * FROM daily_habits WHERE userId = ? AND date = ?').all(req.userId, date);
    const waterHabit = habits.find(h => h.habitType === 'water');
    const workoutHabit = habits.find(h => h.habitType === 'workout');

    const punishmentCount = db.prepare(
        'SELECT COUNT(*) as c FROM punishment_backlog WHERE userId = ? AND originalDate = ?'
    ).get(req.userId, date)?.c || 0;

    const stats = {
        date,
        sessionsCompleted,
        sessionsTotal: sessions.length,
        leetcodeCompleted,
        leetcodeTarget,
        punishmentItems: punishmentCount,
        waterLiters: waterHabit?.currentValue || 0,
        workoutDone: workoutHabit?.currentValue || 0,
    };

    // Upsert stats
    db.prepare(`
    INSERT INTO daily_stats (userId, date, sessionsCompleted, sessionsTotal, leetcodeCompleted, leetcodeTarget, punishmentItems, waterLiters, workoutDone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(userId, date) DO UPDATE SET
      sessionsCompleted = ?, sessionsTotal = ?, leetcodeCompleted = ?, leetcodeTarget = ?,
      punishmentItems = ?, waterLiters = ?, workoutDone = ?
  `).run(
        req.userId, date, stats.sessionsCompleted, stats.sessionsTotal, stats.leetcodeCompleted, stats.leetcodeTarget,
        stats.punishmentItems, stats.waterLiters, stats.workoutDone,
        stats.sessionsCompleted, stats.sessionsTotal, stats.leetcodeCompleted, stats.leetcodeTarget,
        stats.punishmentItems, stats.waterLiters, stats.workoutDone
    );

    res.json(stats);
});

// GET /api/stats/range/query?start=&end=
router.get('/range/query', (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end required' });

    const dates = [];
    const d = new Date(start + 'T00:00:00');
    const endD = new Date(end + 'T00:00:00');
    while (d <= endD) {
        // Build YYYY-MM-DD using local time (prevents UTC offset shifting the day backward)
        const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dates.push(localDateStr);
        d.setDate(d.getDate() + 1);
    }

    const sessionsStmt = db.prepare('SELECT * FROM daily_sessions WHERE userId = ? AND date = ?');
    const itemsStmt = db.prepare('SELECT * FROM session_items WHERE sessionId = ?');
    const habitsStmt = db.prepare('SELECT * FROM daily_habits WHERE userId = ? AND date = ?');
    const punishStmt = db.prepare('SELECT COUNT(*) as c FROM punishment_backlog WHERE userId = ? AND originalDate = ?');
    const upsertStmt = db.prepare(`
        INSERT INTO daily_stats (userId, date, sessionsCompleted, sessionsTotal, leetcodeCompleted, leetcodeTarget, punishmentItems, waterLiters, workoutDone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(userId, date) DO UPDATE SET
          sessionsCompleted = ?, sessionsTotal = ?, leetcodeCompleted = ?, leetcodeTarget = ?,
          punishmentItems = ?, waterLiters = ?, workoutDone = ?
    `);

    const results = dates.map(date => {
        const sessions = sessionsStmt.all(req.userId, date);
        let leetcodeCompleted = 0, leetcodeTarget = 0, sessionsCompleted = 0;

        for (const s of sessions) {
            if (s.status === 'completed') sessionsCompleted++;
            const items = itemsStmt.all(s.id);
            for (const item of items) {
                if (item.category === 'leetcode') {
                    leetcodeTarget += item.targetCount;
                    leetcodeCompleted += item.completedCount;
                }
            }
        }

        const habits = habitsStmt.all(req.userId, date);
        const waterLiters = habits.find(h => h.habitType === 'water')?.currentValue || 0;
        const workoutDone = habits.find(h => h.habitType === 'workout')?.currentValue || 0;
        const punishmentItems = punishStmt.get(req.userId, date)?.c || 0;

        const stat = { date, sessionsCompleted, sessionsTotal: sessions.length, leetcodeCompleted, leetcodeTarget, punishmentItems, waterLiters, workoutDone };

        upsertStmt.run(
            req.userId, date, stat.sessionsCompleted, stat.sessionsTotal, stat.leetcodeCompleted, stat.leetcodeTarget,
            stat.punishmentItems, stat.waterLiters, stat.workoutDone,
            stat.sessionsCompleted, stat.sessionsTotal, stat.leetcodeCompleted, stat.leetcodeTarget,
            stat.punishmentItems, stat.waterLiters, stat.workoutDone
        );

        return stat;
    });

    res.json(results);
});

export default router;
