import { Router } from 'express';
import pool from '../db.js';

const router = Router();

function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTomorrowKey() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// GET /api/punishment
router.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, userId, title, category, missedCount as "missedCount", originalDate as "originalDate", sourceSession as "sourceSession", assignedToDate as "assignedToDate", resolved, createdAt as "createdAt" FROM punishment_backlog WHERE userId = $1 AND resolved = 0 ORDER BY createdAt DESC',
            [req.userId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

// GET /api/punishment/history
router.get('/history', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM punishment_backlog WHERE userId = $1 ORDER BY createdAt DESC LIMIT 50',
            [req.userId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

// POST /api/punishment/process
router.post('/process', async (req, res) => {
    const client = await pool.connect();
    try {
        const today = getTodayKey();
        const tomorrow = getTomorrowKey();

        const { rows: incomplete } = await client.query(`
            SELECT si.*, ds.name as sessionName, ds.date
            FROM session_items si
            JOIN daily_sessions ds ON si.sessionId = ds.id
            WHERE ds.userId = $1 AND ds.date < $2 AND si.completed = 0 AND si.targetCount > si.completedCount
        `, [req.userId, today]);

        if (incomplete.length === 0) {
            return res.json({ processed: 0, items: [] });
        }

        await client.query('BEGIN');
        const results = [];

        for (const item of incomplete) {
            const missed = item.targetcount - item.completedcount;
            const { rows: existingRows } = await client.query(
                'SELECT * FROM punishment_backlog WHERE userId = $1 AND title = $2 AND originalDate = $3 AND resolved = 0',
                [req.userId, item.title, item.date]
            );

            if (existingRows.length === 0) {
                await client.query(
                    'INSERT INTO punishment_backlog (userId, title, category, missedCount, originalDate, sourceSession, assignedToDate) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [req.userId, item.title, item.category, missed, item.date, item.sessionname, tomorrow]
                );
                results.push({ title: item.title, missed, from: item.date });
            }
        }

        await client.query(`
            UPDATE daily_sessions SET status = 'missed'
            WHERE userId = $1 AND date < $2 AND status != 'completed'
        `, [req.userId, today]);

        await client.query('COMMIT');
        res.json({ processed: results.length, items: results });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Punishment process error:', err);
        res.status(500).json({ error: 'Process failed' });
    } finally {
        client.release();
    }
});

// PUT /api/punishment/:id/tick
router.put('/:id/tick', async (req, res) => {
    try {
        const { id } = req.params;
        const { count } = req.body;
        const { rows } = await pool.query('SELECT * FROM punishment_backlog WHERE id = $1 AND userId = $2', [id, req.userId]);
        const item = rows[0];
        if (!item) return res.status(404).json({ error: 'Not found' });

        const newMissed = Math.max(0, item.missedcount - (count || 1));
        if (newMissed === 0) {
            await pool.query('UPDATE punishment_backlog SET missedCount = 0, resolved = 1 WHERE id = $1 AND userId = $2', [id, req.userId]);
        } else {
            await pool.query('UPDATE punishment_backlog SET missedCount = $1 WHERE id = $2 AND userId = $3', [newMissed, id, req.userId]);
        }

        const { rows: updatedRows } = await pool.query('SELECT * FROM punishment_backlog WHERE id = $1 AND userId = $2', [id, req.userId]);
        res.json(updatedRows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Tick failed' });
    }
});

// PUT /api/punishment/:id/resolve
router.put('/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query('SELECT * FROM punishment_backlog WHERE id = $1 AND userId = $2', [id, req.userId]);
        const item = rows[0];
        if (!item) return res.status(404).json({ error: 'Not found' });

        await pool.query('UPDATE punishment_backlog SET resolved = 1 WHERE id = $1 AND userId = $2', [id, req.userId]);

        const backlogTitle = `${item.title} (BACKLOG)`;
        await pool.query(
            "UPDATE session_items SET completed = 1, completedCount = targetCount WHERE title = $1 AND completed = 0",
            [backlogTitle]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Resolve failed' });
    }
});

export default router;

