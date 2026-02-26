import { Router } from 'express';
import db from '../db.js';

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
router.get('/', (req, res) => {
    const items = db.prepare(
        'SELECT * FROM punishment_backlog WHERE userId = ? AND resolved = 0 ORDER BY createdAt DESC'
    ).all(req.userId);
    res.json(items);
});

// GET /api/punishment/history
router.get('/history', (req, res) => {
    const items = db.prepare(
        'SELECT * FROM punishment_backlog WHERE userId = ? ORDER BY createdAt DESC LIMIT 50'
    ).all(req.userId);
    res.json(items);
});

// POST /api/punishment/process
router.post('/process', (req, res) => {
    const today = getTodayKey();
    const tomorrow = getTomorrowKey();

    const incomplete = db.prepare(`
    SELECT si.*, ds.name as sessionName, ds.date
    FROM session_items si
    JOIN daily_sessions ds ON si.sessionId = ds.id
    WHERE ds.userId = ? AND ds.date < ? AND si.completed = 0 AND si.targetCount > si.completedCount
  `).all(req.userId, today);

    if (incomplete.length === 0) {
        return res.json({ processed: 0, items: [] });
    }

    const insertPunishment = db.prepare(`
    INSERT INTO punishment_backlog (userId, title, category, missedCount, originalDate, sourceSession, assignedToDate)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    const process = db.transaction(() => {
        const results = [];
        for (const item of incomplete) {
            const missed = item.targetCount - item.completedCount;
            const existing = db.prepare(
                'SELECT * FROM punishment_backlog WHERE userId = ? AND title = ? AND originalDate = ? AND resolved = 0'
            ).get(req.userId, item.title, item.date);

            if (!existing) {
                insertPunishment.run(
                    req.userId, item.title, item.category, missed,
                    item.date, item.sessionName, tomorrow
                );
                results.push({ title: item.title, missed, from: item.date });
            }
        }

        db.prepare(`
      UPDATE daily_sessions SET status = 'missed'
      WHERE userId = ? AND date < ? AND status != 'completed'
    `).run(req.userId, today);

        return results;
    });

    const results = process();
    res.json({ processed: results.length, items: results });
});

// PUT /api/punishment/:id/tick
router.put('/:id/tick', (req, res) => {
    const { id } = req.params;
    const { count } = req.body;
    const item = db.prepare('SELECT * FROM punishment_backlog WHERE id = ? AND userId = ?').get(id, req.userId);
    if (!item) return res.status(404).json({ error: 'Not found' });

    const newMissed = Math.max(0, item.missedCount - (count || 1));
    if (newMissed === 0) {
        db.prepare('UPDATE punishment_backlog SET missedCount = 0, resolved = 1 WHERE id = ? AND userId = ?').run(id, req.userId);
    } else {
        db.prepare('UPDATE punishment_backlog SET missedCount = ? WHERE id = ? AND userId = ?').run(newMissed, id, req.userId);
    }

    const updated = db.prepare('SELECT * FROM punishment_backlog WHERE id = ? AND userId = ?').get(id, req.userId);
    res.json(updated);
});

// PUT /api/punishment/:id/resolve
router.put('/:id/resolve', (req, res) => {
    const { id } = req.params;
    const item = db.prepare('SELECT * FROM punishment_backlog WHERE id = ? AND userId = ?').get(id, req.userId);
    if (!item) return res.status(404).json({ error: 'Not found' });

    db.prepare('UPDATE punishment_backlog SET resolved = 1 WHERE id = ? AND userId = ?').run(id, req.userId);

    // Reverse sync: mark matching session items as completed
    const backlogTitle = `${item.title} (BACKLOG)`;
    db.prepare(
        "UPDATE session_items SET completed = 1, completedCount = targetCount WHERE title = ? AND completed = 0"
    ).run(backlogTitle);

    res.json({ success: true });
});

export default router;
