import { Router } from 'express';
import DailyHabit from '../models/DailyHabit.js';
import UserProfile from '../models/UserProfile.js';

const router = Router();

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// GET /api/habits/:date
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const profile = await UserProfile.findOne({ userId: req.userId }).lean();
    const waterTarget = profile?.waterTarget || 4.0;

    await DailyHabit.findOneAndUpdate(
      { userId: req.userId, date, habitType: 'water' },
      { $setOnInsert: { targetValue: waterTarget, currentValue: 0 } },
      { upsert: true, new: true }
    );

    await DailyHabit.findOneAndUpdate(
      { userId: req.userId, date, habitType: 'workout' },
      { $setOnInsert: { targetValue: 1, currentValue: 0 } },
      { upsert: true, new: true }
    );

    const habits = await DailyHabit.find({ userId: req.userId, date }).lean();
    const result = {};
    habits.forEach(h => { result[h.habitType] = h; });
    res.json(result);
  } catch (err) {
    console.error('Habits GET error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/habits/water
router.post('/water', async (req, res) => {
  try {
    const { amount } = req.body;
    const today = getTodayKey();
    const profile = await UserProfile.findOne({ userId: req.userId }).lean();
    const target = profile?.waterTarget || 4.0;

    const habit = await DailyHabit.findOneAndUpdate(
      { userId: req.userId, date: today, habitType: 'water' },
      {
        $setOnInsert: { targetValue: target },
        $inc: { currentValue: amount || 0.5 }
      },
      { upsert: true, new: true }
    );

    // Cap at target
    if (habit.currentValue > habit.targetValue) {
      habit.currentValue = habit.targetValue;
      await habit.save();
    }

    res.json(habit.toObject());
  } catch (err) {
    console.error('Water update error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/habits/workout
router.post('/workout', async (req, res) => {
  try {
    const today = getTodayKey();

    let habit = await DailyHabit.findOne({ userId: req.userId, date: today, habitType: 'workout' });
    if (!habit) {
      habit = await DailyHabit.create({ userId: req.userId, date: today, habitType: 'workout', targetValue: 1, currentValue: 1 });
    } else {
      habit.currentValue = habit.currentValue === 0 ? 1 : 0;
      await habit.save();
    }

    res.json(habit.toObject());
  } catch (err) {
    console.error('Workout update error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
