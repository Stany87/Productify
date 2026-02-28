import { Router } from 'express';
import mongoose from 'mongoose';
import DailySession from '../models/DailySession.js';
import DailyHabit from '../models/DailyHabit.js';
import DailyStats from '../models/DailyStats.js';
import PunishmentBacklog from '../models/PunishmentBacklog.js';

const router = Router();

async function computeStats(userId, date) {
    const sessions = await DailySession.find({ userId, date });

    let leetcodeCompleted = 0, leetcodeTarget = 0, sessionsCompleted = 0;

    for (const s of sessions) {
        if (s.status === 'completed') sessionsCompleted++;
        for (const item of (s.items || [])) {
            if (item.category === 'leetcode') {
                leetcodeTarget += item.targetCount;
                leetcodeCompleted += item.completedCount;
            }
        }
    }

    const habits = await DailyHabit.find({ userId, date });
    const waterHabit = habits.find(h => h.habitType === 'water');
    const workoutHabit = habits.find(h => h.habitType === 'workout');

    const punishCount = await PunishmentBacklog.countDocuments({ userId, originalDate: date });

    return {
        date,
        sessionsCompleted,
        sessionsTotal: sessions.length,
        leetcodeCompleted,
        leetcodeTarget,
        punishmentItems: punishCount,
        waterLiters: waterHabit?.currentValue || 0,
        workoutDone: workoutHabit?.currentValue || 0,
    };
}

// GET /api/stats/:date
router.get('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const stats = await computeStats(req.userId, date);

        // Upsert stats
        await DailyStats.findOneAndUpdate(
            { userId: req.userId, date },
            { $set: stats },
            { upsert: true }
        );

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

        // Fetch ALL sessions in the range in ONE query
        const allSessions = await DailySession.find({
            userId: req.userId,
            date: { $gte: start, $lte: end }
        });

        // Fetch ALL habits in the range in ONE query
        const allHabits = await DailyHabit.find({
            userId: req.userId,
            date: { $gte: start, $lte: end }
        });

        // Fetch ALL punishment counts in the range in ONE query
        const punishAgg = await PunishmentBacklog.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.userId), originalDate: { $gte: start, $lte: end } } },
            { $group: { _id: '$originalDate', count: { $sum: 1 } } }
        ]);
        const punishMap = {};
        punishAgg.forEach(p => { punishMap[p._id] = p.count; });

        // Group by date in JS
        const sessionsByDate = {};
        allSessions.forEach(s => {
            if (!sessionsByDate[s.date]) sessionsByDate[s.date] = [];
            sessionsByDate[s.date].push(s);
        });

        const habitsByDate = {};
        allHabits.forEach(h => {
            if (!habitsByDate[h.date]) habitsByDate[h.date] = [];
            habitsByDate[h.date].push(h);
        });

        // Build date range
        const dates = [];
        const d = new Date(start + 'T00:00:00');
        const endD = new Date(end + 'T00:00:00');
        while (d <= endD) {
            dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
            d.setDate(d.getDate() + 1);
        }

        const results = dates.map(date => {
            const sessions = sessionsByDate[date] || [];
            let leetcodeCompleted = 0, leetcodeTarget = 0, sessionsCompleted = 0;

            for (const s of sessions) {
                if (s.status === 'completed') sessionsCompleted++;
                for (const item of (s.items || [])) {
                    if (item.category === 'leetcode') {
                        leetcodeTarget += item.targetCount;
                        leetcodeCompleted += item.completedCount;
                    }
                }
            }

            const habits = habitsByDate[date] || [];
            const waterLiters = habits.find(h => h.habitType === 'water')?.currentValue || 0;
            const workoutDone = habits.find(h => h.habitType === 'workout')?.currentValue || 0;

            return {
                date,
                sessionsCompleted,
                sessionsTotal: sessions.length,
                leetcodeCompleted,
                leetcodeTarget,
                punishmentItems: punishMap[date] || 0,
                waterLiters,
                workoutDone,
            };
        });

        // Bulk upsert stats
        const bulkOps = results.map(stat => ({
            updateOne: {
                filter: { userId: req.userId, date: stat.date },
                update: { $set: stat },
                upsert: true,
            }
        }));
        if (bulkOps.length > 0) await DailyStats.bulkWrite(bulkOps);

        res.json(results);
    } catch (err) {
        console.error('Range stats error:', err);
        res.status(500).json({ error: 'Failed' });
    }
});

export default router;
