import { Router } from 'express';
import DailySession from '../models/DailySession.js';
import BaselineSession from '../models/BaselineSession.js';
import PunishmentBacklog from '../models/PunishmentBacklog.js';

const router = Router();

function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// GET /api/sessions/today
router.get('/today', async (req, res) => {
    try {
        const today = getTodayKey();
        const sessions = await DailySession.find({ userId: req.userId, date: today }).sort({ startTime: 1 }).lean();
        res.json(sessions);
    } catch (err) {
        console.error('Error fetching today sessions:', err);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// GET /api/sessions/:date
router.get('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const sessions = await DailySession.find({ userId: req.userId, date }).sort({ startTime: 1 }).lean();
        res.json(sessions);
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

        const sessions = await DailySession.aggregate([
            { $match: { userId: req.userId, date: { $regex: `^${prefix}` } } },
            {
                $group: {
                    _id: '$date',
                    total: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
                }
            }
        ]);

        const counts = {};
        sessions.forEach(r => { counts[r._id] = { total: r.total, completed: r.completed }; });
        res.json(counts);
    } catch (err) {
        console.error('Error fetching month sessions:', err);
        res.status(500).json({ error: 'Failed' });
    }
});

// POST /api/sessions/generate/:date
router.post('/generate/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { sessions: overrideSessions } = req.body;

        const dateObj = new Date(date + 'T00:00:00');
        const dow = dateObj.getDay();

        let sessionsToInsert = [];

        if (overrideSessions && overrideSessions.length > 0) {
            sessionsToInsert = overrideSessions;
        } else {
            const baselines = await BaselineSession.find({
                userId: req.userId,
                $or: [
                    { dayOfWeek: dow },
                    { dayOfWeek: 7 },
                    { dayOfWeek: 8, ...(dow >= 1 && dow <= 5 ? {} : { dayOfWeek: -1 }) },
                    { dayOfWeek: 9, ...(dow === 0 || dow === 6 ? {} : { dayOfWeek: -1 }) },
                ]
            }).sort({ startTime: 1 }).lean();

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
        const punishments = await PunishmentBacklog.find({
            userId: req.userId, assignedToDate: date, resolved: 0
        }).lean();

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

        // Delete existing sessions for this date
        await DailySession.deleteMany({ userId: req.userId, date });

        // Insert new sessions with embedded items
        const docs = sessionsToInsert
            .filter(s => s.name)
            .map(s => ({
                userId: req.userId,
                date,
                name: s.name || 'Session',
                startTime: s.startTime || 'flexible',
                endTime: s.endTime || 'flexible',
                type: s.type || 'normal',
                category: s.category || 'other',
                status: 'pending',
                icon: s.icon || '📚',
                color: s.color || '#10b981',
                items: (Array.isArray(s.items) ? s.items : []).map(item => ({
                    title: item.title || 'Task',
                    category: item.category || s.category || 'other',
                    targetCount: item.targetCount || 1,
                    completedCount: 0,
                    completed: 0,
                })),
            }));

        const generated = await DailySession.insertMany(docs);
        res.json(generated);
    } catch (err) {
        console.error('Generation error:', err);
        res.status(500).json({ error: 'Failed to generate' });
    }
});

// PUT /api/sessions/:id/status
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const session = await DailySession.findOneAndUpdate(
            { _id: id, userId: req.userId },
            { $set: { status } },
            { new: true }
        ).lean();

        if (status === 'completed' && session?.type === 'punishment') {
            for (const item of session.items) {
                const origTitle = item.title.replace(/\s*\(BACKLOG\)\s*$/, '');
                await PunishmentBacklog.updateMany(
                    { userId: req.userId, title: origTitle, resolved: 0 },
                    { $set: { resolved: 1 } }
                );
            }
            await PunishmentBacklog.updateMany(
                { userId: req.userId, assignedToDate: session.date, resolved: 0 },
                { $set: { resolved: 1 } }
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

        // Stop all other active trackers
        const tracking = await DailySession.find({
            userId: req.userId, trackingStartedAt: { $ne: null }, _id: { $ne: id }
        });

        for (const t of tracking) {
            const elapsed = Math.floor((Date.now() - new Date(t.trackingStartedAt).getTime()) / 1000);
            t.trackedTime += elapsed;
            t.trackingStartedAt = null;
            t.status = 'completed';
            await t.save();
        }

        const now = new Date().toISOString();
        const session = await DailySession.findOneAndUpdate(
            { _id: id, userId: req.userId },
            { $set: { trackingStartedAt: now, status: 'active' } },
            { new: true }
        ).lean();

        res.json(session);
    } catch (err) {
        res.status(500).json({ error: 'Failed start' });
    }
});

// PUT /api/sessions/:id/track/stop
router.put('/:id/track/stop', async (req, res) => {
    try {
        const { id } = req.params;
        const session = await DailySession.findOne({ _id: id, userId: req.userId });

        if (!session || !session.trackingStartedAt) {
            return res.json(session?.toObject() || {});
        }

        const elapsed = Math.floor((Date.now() - new Date(session.trackingStartedAt).getTime()) / 1000);
        session.trackedTime += elapsed;
        session.trackingStartedAt = null;
        await session.save();

        res.json(session.toObject());
    } catch (err) {
        res.status(500).json({ error: 'Failed stop' });
    }
});

// PUT /api/sessions/items/:itemId/tick
router.put('/items/:itemId/tick', async (req, res) => {
    try {
        const { itemId } = req.params;
        const { completedCount } = req.body;

        // Find the session containing this item
        const session = await DailySession.findOne({ 'items._id': itemId, userId: req.userId });
        if (!session) return res.status(404).json({ error: 'Item not found' });

        const item = session.items.id(itemId);
        if (!item) return res.status(404).json({ error: 'Item not found' });

        const newCount = completedCount !== undefined ? completedCount : item.completedCount + 1;
        item.completedCount = newCount;
        item.completed = newCount >= item.targetCount ? 1 : 0;

        // Check if all items are done
        const allDone = session.items.length > 0 && session.items.every(i => i.completed === 1);

        if (allDone) {
            session.status = 'completed';
            if (session.type === 'punishment') {
                for (const i of session.items) {
                    const origTitle = i.title.replace(/\s*\(BACKLOG\)\s*$/, '');
                    await PunishmentBacklog.updateMany(
                        { userId: req.userId, title: origTitle, resolved: 0 },
                        { $set: { resolved: 1 } }
                    );
                }
                await PunishmentBacklog.updateMany(
                    { userId: req.userId, assignedToDate: session.date, resolved: 0 },
                    { $set: { resolved: 1 } }
                );
            }
        } else if (session.status === 'pending') {
            session.status = 'active';
        }

        await session.save();
        res.json(item.toObject());
    } catch (err) {
        console.error('Tick error:', err);
        res.status(500).json({ error: 'Tick failed' });
    }
});

export default router;
