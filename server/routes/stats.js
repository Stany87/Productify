import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/stats/:date
router.get('/:date', async (req, res) => {
    try {
        const { date } = req.params;

        const { rows: sessions } = await pool.query('SELECT * FROM daily_sessions WHERE userId = $1 AND date = $2', [req.userId, date]);

        let leetcodeCompleted = 0, leetcodeTarget = 0;
        let sessionsCompleted = 0;

        for (const s of sessions) {
            if (s.status === 'completed') sessionsCompleted++;
            const { rows: items } = await pool.query('SELECT * FROM session_items WHERE sessionId = $1', [s.id]);
            for (const item of items) {
                if (item.category === 'leetcode') {
                    leetcodeTarget += item.targetcount;
                    leetcodeCompleted += item.completedcount;
                }
            }
        }

        const { rows: habits } = await pool.query('SELECT * FROM daily_habits WHERE userId = $1 AND date = $2', [req.userId, date]);
        const waterHabit = habits.find(h => h.habittype === 'water');
        const workoutHabit = habits.find(h => h.habittype === 'workout');

        const { rows: punishRows } = await pool.query(
            'SELECT COUNT(*) as c FROM punishment_backlog WHERE userId = $1 AND originalDate = $2',
            [req.userId, date]
        );
        const punishmentCount = parseInt(punishRows[0]?.c || 0);

        const stats = {
            date,
            sessionsCompleted,
            sessionsTotal: sessions.length,
            leetcodeCompleted,
            leetcodeTarget,
            punishmentItems: punishmentCount,
            waterLiters: waterHabit?.currentvalue || 0,
            workoutDone: workoutHabit?.currentvalue || 0,
        };

        // Upsert stats
        await pool.query(`
            INSERT INTO daily_stats (userId, date, sessionsCompleted, sessionsTotal, leetcodeCompleted, leetcodeTarget, punishmentItems, waterLiters, workoutDone)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT(userId, date) DO UPDATE SET
              sessionsCompleted = $3, sessionsTotal = $4, leetcodeCompleted = $5, leetcodeTarget = $6,
              punishmentItems = $7, waterLiters = $8, workoutDone = $9
        `, [
            req.userId, date, stats.sessionsCompleted, stats.sessionsTotal, stats.leetcodeCompleted, stats.leetcodeTarget,
            stats.punishmentItems, stats.waterLiters, stats.workoutDone
        ]);

        res.json(stats);
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// GET /api/stats/range/query?start=&end=
router.get('/range/query', async (req, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) return res.status(400).json({ error: 'start and end required' });

        const dates = [];
        const d = new Date(start + 'T00:00:00');
        const endD = new Date(end + 'T00:00:00');
        while (d <= endD) {
            const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            dates.push(localDateStr);
            d.setDate(d.getDate() + 1);
        }

        const results = await Promise.all(dates.map(async (date) => {
            const { rows: sessions } = await pool.query('SELECT * FROM daily_sessions WHERE userId = $1 AND date = $2', [req.userId, date]);
            let leetcodeCompleted = 0, leetcodeTarget = 0, sessionsCompleted = 0;

            for (const s of sessions) {
                if (s.status === 'completed') sessionsCompleted++;
                const { rows: items } = await pool.query('SELECT * FROM session_items WHERE sessionId = $1', [s.id]);
                for (const item of items) {
                    if (item.category === 'leetcode') {
                        leetcodeTarget += item.targetcount;
                        leetcodeCompleted += item.completedcount;
                    }
                }
            }

            const { rows: habits } = await pool.query('SELECT * FROM daily_habits WHERE userId = $1 AND date = $2', [req.userId, date]);
            const waterLiters = habits.find(h => h.habittype === 'water')?.currentvalue || 0;
            const workoutDone = habits.find(h => h.habittype === 'workout')?.currentvalue || 0;

            const { rows: punishRows } = await pool.query('SELECT COUNT(*) as c FROM punishment_backlog WHERE userId = $1 AND originalDate = $2', [req.userId, date]);
            const punishmentItems = parseInt(punishRows[0]?.c || 0);

            const stat = { date, sessionsCompleted, sessionsTotal: sessions.length, leetcodeCompleted, leetcodeTarget, punishmentItems, waterLiters, workoutDone };

            await pool.query(`
                INSERT INTO daily_stats (userId, date, sessionsCompleted, sessionsTotal, leetcodeCompleted, leetcodeTarget, punishmentItems, waterLiters, workoutDone)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT(userId, date) DO UPDATE SET
                  sessionsCompleted = $3, sessionsTotal = $4, leetcodeCompleted = $5, leetcodeTarget = $6,
                  punishmentItems = $7, waterLiters = $8, workoutDone = $9
            `, [
                req.userId, date, stat.sessionsCompleted, stat.sessionsTotal, stat.leetcodeCompleted, stat.leetcodeTarget,
                stat.punishmentItems, stat.waterLiters, stat.workoutDone
            ]);

            return stat;
        }));

        res.json(results);
    } catch (err) {
        console.error('Range stats error:', err);
        res.status(500).json({ error: 'Failed' });
    }
});

export default router;

