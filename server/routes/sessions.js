import { Router } from 'express';
import pool from '../db.js';

const router = Router();

function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// GET /api/sessions/today
router.get('/today', async (req, res) => {
    try {
        const today = getTodayKey();
        const { rows: sessions } = await pool.query(
            'SELECT * FROM daily_sessions WHERE userId = $1 AND date = $2 ORDER BY startTime ASC',
            [req.userId, today]
        );

        const result = await Promise.all(sessions.map(async (s) => {
            const { rows: items } = await pool.query('SELECT * FROM session_items WHERE sessionId = $1', [s.id]);
            return { ...s, items };
        }));

        res.json(result);
    } catch (err) {
        console.error('Error fetching today sessions:', err);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// GET /api/sessions/:date
router.get('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { rows: sessions } = await pool.query(
            'SELECT * FROM daily_sessions WHERE userId = $1 AND date = $2 ORDER BY startTime ASC',
            [req.userId, date]
        );

        const result = await Promise.all(sessions.map(async (s) => {
            const { rows: items } = await pool.query('SELECT * FROM session_items WHERE sessionId = $1', [s.id]);
            return { ...s, items };
        }));

        res.json(result);
    } catch (err) {
        console.error('Error fetching sessions by date:', err);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// GET /api/sessions/month/:year/:month
router.get('/month/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        const { rows } = await pool.query(`
            SELECT date, COUNT(*) as total,
                   SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
            FROM daily_sessions WHERE userId = $1 AND date LIKE $2 GROUP BY date
        `, [req.userId, `${prefix}%`]);

        const counts = {};
        rows.forEach(r => { counts[r.date] = { total: parseInt(r.total), completed: parseInt(r.completed || 0) }; });
        res.json(counts);
    } catch (err) {
        console.error('Error fetching month sessions:', err);
        res.status(500).json({ error: 'Failed' });
    }
});

// POST /api/sessions/generate/:date
router.post('/generate/:date', async (req, res) => {
    const client = await pool.connect();
    try {
        const { date } = req.params;
        const { sessions: overrideSessions } = req.body;

        const dateObj = new Date(date + 'T00:00:00');
        const dow = dateObj.getDay();

        let sessionsToInsert = [];

        if (overrideSessions && overrideSessions.length > 0) {
            sessionsToInsert = overrideSessions;
        } else {
            const { rows: baselines } = await client.query(
                'SELECT * FROM baseline_sessions WHERE userId = $1 AND (dayOfWeek = $2 OR dayOfWeek = 7 OR (dayOfWeek = 8 AND $3 BETWEEN 1 AND 5) OR (dayOfWeek = 9 AND $4 IN (0, 6))) ORDER BY startTime ASC',
                [req.userId, dow, dow, dow]
            );

            sessionsToInsert = baselines.map(b => ({
                name: b.name,
                startTime: b.starttime,
                endTime: b.endtime,
                type: b.type,
                category: b.category,
                icon: b.icon,
                color: b.color,
                items: JSON.parse(b.items || '[]'),
            }));
        }

        // Punishment backlog for this user and date
        const { rows: punishments } = await client.query(
            'SELECT * FROM punishment_backlog WHERE userId = $1 AND assignedToDate = $2 AND resolved = 0',
            [req.userId, date]
        );

        if (punishments.length > 0) {
            const punishmentItems = punishments.map(p => ({
                title: `${p.title} (BACKLOG)`,
                category: p.category,
                targetCount: p.missedcount,
            }));

            sessionsToInsert.push({
                name: 'Punishment Backlog',
                startTime: 'flexible',
                endTime: 'flexible',
                type: 'punishment',
                category: 'leetcode',
                icon: '🔥',
                color: '#ef4444',
                items: punishmentItems,
            });
        }

        await client.query('BEGIN');

        const { rows: existingRows } = await client.query('SELECT id FROM daily_sessions WHERE userId = $1 AND date = $2', [req.userId, date]);
        const existingIds = existingRows.map(r => r.id);

        if (existingIds.length > 0) {
            await client.query(`DELETE FROM session_items WHERE sessionId = ANY($1)`, [existingIds]);
            await client.query('DELETE FROM daily_sessions WHERE userId = $1 AND date = $2', [req.userId, date]);
        }

        for (const s of sessionsToInsert) {
            if (!s.name) continue;
            const { rows: sessionRows } = await client.query(
                `INSERT INTO daily_sessions (userId, date, name, startTime, endTime, type, category, status, icon, color)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9) RETURNING id`,
                [req.userId, date, s.name || 'Session', s.startTime || 'flexible', s.endTime || 'flexible',
                s.type || 'normal', s.category || 'other', s.icon || '📚', s.color || '#10b981']
            );
            const sessionId = sessionRows[0].id;

            const items = Array.isArray(s.items) ? s.items : [];
            for (const item of items) {
                if (!item.title) continue;
                await client.query(
                    'INSERT INTO session_items (sessionId, title, category, targetCount) VALUES ($1, $2, $3, $4)',
                    [sessionId, item.title, item.category || s.category || 'other', item.targetCount || 1]
                );
            }
        }

        await client.query('COMMIT');

        const { rows: generated } = await client.query('SELECT * FROM daily_sessions WHERE userId = $1 AND date = $2 ORDER BY startTime ASC', [req.userId, date]);
        const result = await Promise.all(generated.map(async (s) => {
            const { rows: items } = await client.query('SELECT * FROM session_items WHERE sessionId = $1', [s.id]);
            return { ...s, items };
        }));

        res.json(result);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Generation error:', err);
        res.status(500).json({ error: 'Failed to generate' });
    } finally {
        client.release();
    }
});

// PUT /api/sessions/:id/status
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await pool.query('UPDATE daily_sessions SET status = $1 WHERE id = $2 AND userId = $3', [status, id, req.userId]);
        const { rows } = await pool.query('SELECT * FROM daily_sessions WHERE id = $1 AND userId = $2', [id, req.userId]);
        const session = rows[0];

        if (status === 'completed' && session?.type === 'punishment') {
            const { rows: items } = await pool.query('SELECT title FROM session_items WHERE sessionId = $1', [id]);
            for (const item of items) {
                const origTitle = item.title.replace(/\s*\(BACKLOG\)\s*$/, '');
                await pool.query(
                    "UPDATE punishment_backlog SET resolved = 1 WHERE userId = $1 AND title = $2 AND resolved = 0",
                    [req.userId, origTitle]
                );
            }
            await pool.query(
                "UPDATE punishment_backlog SET resolved = 1 WHERE userId = $1 AND assignedToDate = $2 AND resolved = 0",
                [req.userId, session.date]
            );
        }

        res.json(session);
    } catch (err) {
        res.status(500).json({ error: 'Update failed' });
    }
});

// PUT /api/sessions/:id/track/start
router.put('/:id/track/start', async (req, res) => {
    try {
        const { id } = req.params;

        const { rows: tracking } = await pool.query(
            'SELECT * FROM daily_sessions WHERE userId = $1 AND trackingStartedAt IS NOT NULL AND id != $2',
            [req.userId, id]
        );

        for (const t of tracking) {
            const elapsed = Math.floor((Date.now() - new Date(t.trackingstartedat).getTime()) / 1000);
            await pool.query(
                'UPDATE daily_sessions SET trackedTime = trackedTime + $1, trackingStartedAt = NULL, status = $2 WHERE id = $3',
                [elapsed, 'completed', t.id]
            );
        }

        const now = new Date().toISOString();
        await pool.query(
            'UPDATE daily_sessions SET trackingStartedAt = $1, status = $2 WHERE id = $3 AND userId = $4',
            [now, 'active', id, req.userId]
        );
        const { rows } = await pool.query('SELECT * FROM daily_sessions WHERE id = $1 AND userId = $2', [id, req.userId]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed start' });
    }
});

// PUT /api/sessions/:id/track/stop
router.put('/:id/track/stop', async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query('SELECT * FROM daily_sessions WHERE id = $1 AND userId = $2', [id, req.userId]);
        const session = rows[0];

        if (!session || !session.trackingstartedat) {
            return res.json(session || {});
        }

        const elapsed = Math.floor((Date.now() - new Date(session.trackingstartedat).getTime()) / 1000);
        await pool.query(
            'UPDATE daily_sessions SET trackedTime = trackedTime + $1, trackingStartedAt = NULL WHERE id = $2 AND userId = $3',
            [elapsed, id, req.userId]
        );
        const { rows: updatedRows } = await pool.query('SELECT * FROM daily_sessions WHERE id = $1 AND userId = $2', [id, req.userId]);
        res.json(updatedRows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed stop' });
    }
});

// PUT /api/sessions/items/:itemId/tick
router.put('/items/:itemId/tick', async (req, res) => {
    try {
        const { itemId } = req.params;
        const { completedCount } = req.body;
        const { rows: itemRows } = await pool.query('SELECT * FROM session_items WHERE id = $1', [itemId]);
        const item = itemRows[0];
        if (!item) return res.status(404).json({ error: 'Item not found' });

        const newCount = completedCount !== undefined ? completedCount : item.completedcount + 1;
        const completed = newCount >= item.targetcount ? 1 : 0;

        await pool.query('UPDATE session_items SET completedCount = $1, completed = $2 WHERE id = $3', [newCount, completed, itemId]);

        const { rows: allItems } = await pool.query('SELECT completed FROM session_items WHERE sessionId = $1', [item.sessionid]);
        const allDone = allItems.length > 0 && allItems.every(i => i.completed === 1);

        if (allDone) {
            await pool.query("UPDATE daily_sessions SET status = 'completed' WHERE id = $1", [item.sessionid]);
            const { rows: sessionRows } = await pool.query('SELECT * FROM daily_sessions WHERE id = $1', [item.sessionid]);
            const session = sessionRows[0];
            if (session?.type === 'punishment') {
                const { rows: items } = await pool.query('SELECT title FROM session_items WHERE sessionId = $1', [item.sessionid]);
                for (const i of items) {
                    const origTitle = i.title.replace(/\s*\(BACKLOG\)\s*$/, '');
                    await pool.query(
                        "UPDATE punishment_backlog SET resolved = 1 WHERE userId = $1 AND title = $2 AND resolved = 0",
                        [req.userId || session.userid, origTitle]
                    );
                }
                await pool.query(
                    "UPDATE punishment_backlog SET resolved = 1 WHERE userId = $1 AND assignedToDate = $2 AND resolved = 0",
                    [req.userId || session.userid, session.date]
                );
            }
        } else {
            await pool.query("UPDATE daily_sessions SET status = 'active' WHERE id = $1 AND status = 'pending'", [item.sessionid]);
        }

        const { rows: updatedRows } = await pool.query('SELECT * FROM session_items WHERE id = $1', [itemId]);
        res.json(updatedRows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Tick failed' });
    }
});

export default router;

