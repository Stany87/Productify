import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/tasks?date=2026-02-23
router.get('/', (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ error: 'date query parameter required' });
    }
    const tasks = db.prepare('SELECT * FROM tasks WHERE date = ? ORDER BY timeSlot ASC').all(date);
    res.json(tasks);
});

// GET /api/tasks/week?start=2026-02-23&end=2026-03-01
router.get('/week', (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) {
        return res.status(400).json({ error: 'start and end query parameters required' });
    }
    const tasks = db.prepare('SELECT * FROM tasks WHERE date >= ? AND date <= ? ORDER BY date ASC, timeSlot ASC').all(start, end);
    const grouped = {};
    tasks.forEach(t => {
        if (!grouped[t.date]) grouped[t.date] = [];
        grouped[t.date].push(t);
    });
    res.json(grouped);
});

// GET /api/tasks/month?year=2026&month=2
router.get('/month', (req, res) => {
    const { year, month } = req.query;
    if (!year || !month) {
        return res.status(400).json({ error: 'year and month query parameters required' });
    }
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const tasks = db.prepare(
        `SELECT date, COUNT(*) as total, SUM(completed) as completed 
     FROM tasks WHERE date LIKE ? GROUP BY date`
    ).all(`${prefix}%`);

    const counts = {};
    tasks.forEach(row => {
        counts[row.date] = { total: row.total, completed: row.completed };
    });
    res.json(counts);
});

// POST /api/tasks
router.post('/', (req, res) => {
    const { title, category, timeSlot, date } = req.body;
    if (!title || !date) {
        return res.status(400).json({ error: 'title and date are required' });
    }
    const result = db.prepare(
        'INSERT INTO tasks (title, category, timeSlot, date) VALUES (?, ?, ?, ?)'
    ).run(title, category || 'other', timeSlot || '', date);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(task);
});

// POST /api/tasks/bulk
router.post('/bulk', (req, res) => {
    const { tasks } = req.body;
    if (!Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({ error: 'tasks array required' });
    }
    const insert = db.prepare(
        'INSERT INTO tasks (title, category, timeSlot, date) VALUES (?, ?, ?, ?)'
    );
    const insertMany = db.transaction((items) => {
        const results = [];
        for (const t of items) {
            const r = insert.run(t.title, t.category || 'other', t.timeSlot || '', t.date);
            results.push(r.lastInsertRowid);
        }
        return results;
    });
    const ids = insertMany(tasks);
    const inserted = db.prepare(`SELECT * FROM tasks WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
    res.status(201).json(inserted);
});

// PUT /api/tasks/:id
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { title, category, timeSlot, date, completed } = req.body;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    db.prepare(`
    UPDATE tasks SET 
      title = COALESCE(?, title),
      category = COALESCE(?, category),
      timeSlot = COALESCE(?, timeSlot),
      date = COALESCE(?, date),
      completed = COALESCE(?, completed)
    WHERE id = ?
  `).run(
        title ?? null, category ?? null, timeSlot ?? null,
        date ?? null, completed ?? null, id
    );
    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(updated);
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    res.json({ success: true });
});

// ──── Time Tracking ────

// POST /api/tasks/:id/track/start
router.post('/:id/track/start', (req, res) => {
    const { id } = req.params;
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Stop any other currently tracking task
    const tracking = db.prepare('SELECT * FROM tasks WHERE trackingStartedAt IS NOT NULL AND id != ?').all(id);
    const stopStmt = db.prepare('UPDATE tasks SET trackedTime = trackedTime + ?, trackingStartedAt = NULL WHERE id = ?');
    const insertSession = db.prepare('INSERT INTO time_sessions (taskId, startedAt, endedAt, duration) VALUES (?, ?, ?, ?)');

    const now = new Date().toISOString();
    for (const t of tracking) {
        const elapsed = Math.floor((Date.now() - new Date(t.trackingStartedAt).getTime()) / 1000);
        stopStmt.run(elapsed, t.id);
        insertSession.run(t.id, t.trackingStartedAt, now, elapsed);
    }

    // Start tracking this task
    db.prepare('UPDATE tasks SET trackingStartedAt = ? WHERE id = ?').run(now, id);
    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(updated);
});

// POST /api/tasks/:id/track/stop
router.post('/:id/track/stop', (req, res) => {
    const { id } = req.params;
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!task.trackingStartedAt) return res.json(task); // not tracking

    const now = new Date().toISOString();
    const elapsed = Math.floor((Date.now() - new Date(task.trackingStartedAt).getTime()) / 1000);

    db.prepare('UPDATE tasks SET trackedTime = trackedTime + ?, trackingStartedAt = NULL WHERE id = ?')
        .run(elapsed, id);
    db.prepare('INSERT INTO time_sessions (taskId, startedAt, endedAt, duration) VALUES (?, ?, ?, ?)')
        .run(id, task.trackingStartedAt, now, elapsed);

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(updated);
});

// GET /api/tasks/:id/sessions
router.get('/:id/sessions', (req, res) => {
    const { id } = req.params;
    const sessions = db.prepare('SELECT * FROM time_sessions WHERE taskId = ? ORDER BY startedAt DESC').all(id);
    res.json(sessions);
});

export default router;
