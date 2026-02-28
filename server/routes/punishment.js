import { Router } from 'express';
import PunishmentBacklog from '../models/PunishmentBacklog.js';
import DailySession from '../models/DailySession.js';

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
        const items = await PunishmentBacklog.find({ userId: req.userId, resolved: 0 })
            .sort({ createdAt: -1 }).lean();
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

// GET /api/punishment/history
router.get('/history', async (req, res) => {
    try {
        const items = await PunishmentBacklog.find({ userId: req.userId })
            .sort({ createdAt: -1 }).limit(50).lean();
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

// POST /api/punishment/process
router.post('/process', async (req, res) => {
    try {
        const today = getTodayKey();
        const tomorrow = getTomorrowKey();

        // Find incomplete items from past sessions
        const pastSessions = await DailySession.find({
            userId: req.userId,
            date: { $lt: today },
            'items.completed': 0,
        }).lean();

        const incomplete = [];
        for (const session of pastSessions) {
            for (const item of session.items) {
                if (item.completed === 0 && item.targetCount > item.completedCount) {
                    incomplete.push({ ...item, sessionName: session.name, date: session.date });
                }
            }
        }

        if (incomplete.length === 0) {
            return res.json({ processed: 0, items: [] });
        }

        const results = [];
        for (const item of incomplete) {
            const missed = item.targetCount - item.completedCount;
            const existing = await PunishmentBacklog.findOne({
                userId: req.userId, title: item.title, originalDate: item.date, resolved: 0
            });

            if (!existing) {
                await PunishmentBacklog.create({
                    userId: req.userId,
                    title: item.title,
                    category: item.category,
                    missedCount: missed,
                    originalDate: item.date,
                    sourceSession: item.sessionName,
                    assignedToDate: tomorrow,
                });
                results.push({ title: item.title, missed, from: item.date });
            }
        }

        // Mark old incomplete sessions as missed
        await DailySession.updateMany(
            { userId: req.userId, date: { $lt: today }, status: { $ne: 'completed' } },
            { $set: { status: 'missed' } }
        );

        res.json({ processed: results.length, items: results });
    } catch (err) {
        console.error('Punishment process error:', err);
        res.status(500).json({ error: 'Process failed' });
    }
});

// PUT /api/punishment/:id/tick
router.put('/:id/tick', async (req, res) => {
    try {
        const { id } = req.params;
        const { count } = req.body;
        const item = await PunishmentBacklog.findOne({ _id: id, userId: req.userId });
        if (!item) return res.status(404).json({ error: 'Not found' });

        const newMissed = Math.max(0, item.missedCount - (count || 1));
        item.missedCount = newMissed;
        if (newMissed === 0) item.resolved = 1;
        await item.save();

        res.json(item.toObject());
    } catch (err) {
        res.status(500).json({ error: 'Tick failed' });
    }
});

// PUT /api/punishment/:id/resolve
router.put('/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        const item = await PunishmentBacklog.findOne({ _id: id, userId: req.userId });
        if (!item) return res.status(404).json({ error: 'Not found' });

        item.resolved = 1;
        await item.save();

        // Also complete matching backlog items in sessions
        const backlogTitle = `${item.title} (BACKLOG)`;
        await DailySession.updateMany(
            { userId: req.userId, 'items.title': backlogTitle, 'items.completed': 0 },
            { $set: { 'items.$.completed': 1, 'items.$.completedCount': 1 } }
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Resolve failed' });
    }
});

export default router;
