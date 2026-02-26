import { Router } from 'express';
import db from '../db.js';

const router = Router();

function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// GET /api/sessions/today
router.get('/today', (req, res) => {
    const today = getTodayKey();
    const sessions = db.prepare(
        'SELECT * FROM daily_sessions WHERE userId = ? AND date = ? ORDER BY startTime ASC'
    ).all(req.userId, today);

    const itemsStmt = db.prepare('SELECT * FROM session_items WHERE sessionId = ?');
    const result = sessions.map(s => ({
        ...s,
        items: itemsStmt.all(s.id),
    }));

    res.json(result);
});

// GET /api/sessions/:date
router.get('/:date', (req, res) => {
    const { date } = req.params;
    const sessions = db.prepare(
        'SELECT * FROM daily_sessions WHERE userId = ? AND date = ? ORDER BY startTime ASC'
    ).all(req.userId, date);

    const itemsStmt = db.prepare('SELECT * FROM session_items WHERE sessionId = ?');
    const result = sessions.map(s => ({
        ...s,
        items: itemsStmt.all(s.id),
    }));

    res.json(result);
});

// GET /api/sessions/month/:year/:month
router.get('/month/:year/:month', (req, res) => {
    const { year, month } = req.params;
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const rows = db.prepare(`
    SELECT date, COUNT(*) as total,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM daily_sessions WHERE userId = ? AND date LIKE ? GROUP BY date
  `).all(req.userId, `${prefix}%`);

    const counts = {};
    rows.forEach(r => { counts[r.date] = { total: r.total, completed: r.completed }; });
    res.json(counts);
});

// POST /api/sessions/generate/:date
router.post('/generate/:date', (req, res) => {
    const { date } = req.params;
    const { sessions: overrideSessions } = req.body;

    const dateObj = new Date(date + 'T00:00:00');
    const dow = dateObj.getDay();

    let sessionsToInsert = [];

    if (overrideSessions && overrideSessions.length > 0) {
        sessionsToInsert = overrideSessions;
    } else {
        const baselines = db.prepare(
            'SELECT * FROM baseline_sessions WHERE userId = ? AND (dayOfWeek = ? OR dayOfWeek = 7 OR (dayOfWeek = 8 AND ? BETWEEN 1 AND 5) OR (dayOfWeek = 9 AND ? IN (0, 6))) ORDER BY startTime ASC'
        ).all(req.userId, dow, dow, dow);

        sessionsToInsert = baselines.map(b => ({
            name: b.name,
            startTime: b.startTime,
            endTime: b.endTime,
            type: b.type,
            category: b.category,
            icon: b.icon,
            color: b.color,
            items: JSON.parse(b.items || '[]'),
        }));
    }

    // Punishment backlog for this user and date
    const punishments = db.prepare(
        'SELECT * FROM punishment_backlog WHERE userId = ? AND assignedToDate = ? AND resolved = 0'
    ).all(req.userId, date);

    if (punishments.length > 0) {
        const punishmentItems = punishments.map(p => ({
            title: `${p.title} (BACKLOG)`,
            category: p.category,
            targetCount: p.missedCount,
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

    const insertSession = db.prepare(`
    INSERT INTO daily_sessions (userId, date, name, startTime, endTime, type, category, status, icon, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `);
    const insertItem = db.prepare(`
    INSERT INTO session_items (sessionId, title, category, targetCount)
    VALUES (?, ?, ?, ?)
  `);

    const insertAll = db.transaction(() => {
        const existingIds = db.prepare('SELECT id FROM daily_sessions WHERE userId = ? AND date = ?').all(req.userId, date).map(r => r.id);
        if (existingIds.length > 0) {
            db.prepare(`DELETE FROM session_items WHERE sessionId IN (${existingIds.map(() => '?').join(',')})`).run(...existingIds);
            db.prepare('DELETE FROM daily_sessions WHERE userId = ? AND date = ?').run(req.userId, date);
        }

        for (const s of sessionsToInsert) {
            if (!s.name) continue;
            const r = insertSession.run(
                req.userId, date, s.name || 'Session', s.startTime || 'flexible', s.endTime || 'flexible',
                s.type || 'normal', s.category || 'other',
                s.icon || '📚', s.color || '#10b981'
            );
            const sessionId = r.lastInsertRowid;

            const items = Array.isArray(s.items) ? s.items : [];
            for (const item of items) {
                if (!item.title) continue;
                insertItem.run(sessionId, item.title, item.category || s.category || 'other', item.targetCount || 1);
            }
        }
    });

    insertAll();

    const generated = db.prepare('SELECT * FROM daily_sessions WHERE userId = ? AND date = ? ORDER BY startTime ASC').all(req.userId, date);
    const itemsStmt = db.prepare('SELECT * FROM session_items WHERE sessionId = ?');
    const result = generated.map(s => ({ ...s, items: itemsStmt.all(s.id) }));

    res.json(result);
});

// PUT /api/sessions/:id/status
router.put('/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.prepare('UPDATE daily_sessions SET status = ? WHERE id = ? AND userId = ?').run(status, id, req.userId);
    const session = db.prepare('SELECT * FROM daily_sessions WHERE id = ? AND userId = ?').get(id, req.userId);

    // Auto-resolve punishment backlog when a punishment session is completed
    if (status === 'completed' && session?.type === 'punishment') {
        const items = db.prepare('SELECT title FROM session_items WHERE sessionId = ?').all(id);
        for (const item of items) {
            const origTitle = item.title.replace(/\s*\(BACKLOG\)\s*$/, '');
            db.prepare(
                "UPDATE punishment_backlog SET resolved = 1 WHERE userId = ? AND title = ? AND resolved = 0"
            ).run(req.userId, origTitle);
        }
        db.prepare(
            "UPDATE punishment_backlog SET resolved = 1 WHERE userId = ? AND assignedToDate = ? AND resolved = 0"
        ).run(req.userId, session.date);
    }

    res.json(session);
});

// PUT /api/sessions/:id/track/start
router.put('/:id/track/start', (req, res) => {
    const { id } = req.params;

    // Stop any other tracking for this user
    const tracking = db.prepare('SELECT * FROM daily_sessions WHERE userId = ? AND trackingStartedAt IS NOT NULL AND id != ?').all(req.userId, id);
    for (const t of tracking) {
        const elapsed = Math.floor((Date.now() - new Date(t.trackingStartedAt).getTime()) / 1000);
        db.prepare('UPDATE daily_sessions SET trackedTime = trackedTime + ?, trackingStartedAt = NULL, status = ? WHERE id = ?')
            .run(elapsed, 'completed', t.id);
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE daily_sessions SET trackingStartedAt = ?, status = ? WHERE id = ? AND userId = ?').run(now, 'active', id, req.userId);
    const session = db.prepare('SELECT * FROM daily_sessions WHERE id = ? AND userId = ?').get(id, req.userId);
    res.json(session);
});

// PUT /api/sessions/:id/track/stop
router.put('/:id/track/stop', (req, res) => {
    const { id } = req.params;
    const session = db.prepare('SELECT * FROM daily_sessions WHERE id = ? AND userId = ?').get(id, req.userId);
    if (!session || !session.trackingStartedAt) {
        return res.json(session || {});
    }

    const elapsed = Math.floor((Date.now() - new Date(session.trackingStartedAt).getTime()) / 1000);
    db.prepare('UPDATE daily_sessions SET trackedTime = trackedTime + ?, trackingStartedAt = NULL WHERE id = ? AND userId = ?')
        .run(elapsed, id, req.userId);
    const updated = db.prepare('SELECT * FROM daily_sessions WHERE id = ? AND userId = ?').get(id, req.userId);
    res.json(updated);
});

// PUT /api/sessions/items/:itemId/tick
router.put('/items/:itemId/tick', (req, res) => {
    const { itemId } = req.params;
    const { completedCount } = req.body;
    const item = db.prepare('SELECT * FROM session_items WHERE id = ?').get(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const newCount = completedCount !== undefined ? completedCount : item.completedCount + 1;
    const completed = newCount >= item.targetCount ? 1 : 0;

    db.prepare('UPDATE session_items SET completedCount = ?, completed = ? WHERE id = ?')
        .run(newCount, completed, itemId);

    // Auto-complete the parent session if all items are done
    const allItems = db.prepare('SELECT completed FROM session_items WHERE sessionId = ?').all(item.sessionId);
    const allDone = allItems.length > 0 && allItems.every(i => i.completed === 1);

    if (allDone) {
        db.prepare("UPDATE daily_sessions SET status = 'completed' WHERE id = ?").run(item.sessionId);

        // Auto-resolve punishment backlog if applicable
        const session = db.prepare('SELECT * FROM daily_sessions WHERE id = ?').get(item.sessionId);
        if (session?.type === 'punishment') {
            const items = db.prepare('SELECT title FROM session_items WHERE sessionId = ?').all(item.sessionId);
            for (const i of items) {
                const origTitle = i.title.replace(/\s*\(BACKLOG\)\s*$/, '');
                db.prepare(
                    "UPDATE punishment_backlog SET resolved = 1 WHERE userId = ? AND title = ? AND resolved = 0"
                ).run(req.userId || session.userId, origTitle);
            }
            db.prepare(
                "UPDATE punishment_backlog SET resolved = 1 WHERE userId = ? AND assignedToDate = ? AND resolved = 0"
            ).run(req.userId || session.userId, session.date);
        }
    } else {
        // Mark as active if not all done but we just ticked an item
        db.prepare("UPDATE daily_sessions SET status = 'active' WHERE id = ? AND status = 'pending'").run(item.sessionId);
    }

    const updated = db.prepare('SELECT * FROM session_items WHERE id = ?').get(itemId);
    res.json(updated);
});

export default router;
