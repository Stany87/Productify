import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/backlog
router.get('/', (req, res) => {
    const items = db.prepare('SELECT * FROM backlog ORDER BY failedDate DESC').all();
    res.json(items);
});

// POST /api/backlog/process — detect overdue tasks and move to backlog
router.post('/process', (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    // Find incomplete tasks from past dates
    const overdue = db.prepare(
        'SELECT * FROM tasks WHERE date < ? AND completed = 0'
    ).all(today);

    if (overdue.length === 0) {
        return res.json({ moved: 0, items: [] });
    }

    const insert = db.prepare(
        'INSERT INTO backlog (title, category, originalDate, failedDate) VALUES (?, ?, ?, ?)'
    );
    const deleteTasks = db.prepare('DELETE FROM tasks WHERE id = ?');

    const process = db.transaction(() => {
        const backlogItems = [];
        for (const task of overdue) {
            insert.run(task.title, task.category, task.date, task.date);
            deleteTasks.run(task.id);
            backlogItems.push({
                title: task.title,
                category: task.category,
                originalDate: task.date,
                failedDate: task.date,
            });
        }
        return backlogItems;
    });

    const items = process();
    res.json({ moved: items.length, items });
});

// PUT /api/backlog/:id/reschedule
router.put('/:id/reschedule', (req, res) => {
    const { id } = req.params;
    const { targetDate } = req.body;
    if (!targetDate) return res.status(400).json({ error: 'targetDate required' });

    const item = db.prepare('SELECT * FROM backlog WHERE id = ?').get(id);
    if (!item) return res.status(404).json({ error: 'Backlog item not found' });

    // Create a new task for the target date
    const result = db.prepare(
        'INSERT INTO tasks (title, category, timeSlot, date) VALUES (?, ?, ?, ?)'
    ).run(item.title, item.category, 'Rescheduled', targetDate);

    // Remove from backlog
    db.prepare('DELETE FROM backlog WHERE id = ?').run(id);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    res.json(task);
});

// DELETE /api/backlog/:id
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM backlog WHERE id = ?').run(id);
    res.json({ success: true });
});

export default router;
