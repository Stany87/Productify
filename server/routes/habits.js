import { Router } from 'express';
import db from '../db.js';

const router = Router();

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// GET /api/habits/:date
router.get('/:date', (req, res) => {
  const { date } = req.params;
  const profile = db.prepare('SELECT waterTarget FROM user_profile WHERE userId = ?').get(req.userId);
  const waterTarget = profile?.waterTarget || 4.0;

  db.prepare(`
    INSERT OR IGNORE INTO daily_habits (userId, date, habitType, targetValue) VALUES (?, ?, 'water', ?)
  `).run(req.userId, date, waterTarget);
  db.prepare(`
    INSERT OR IGNORE INTO daily_habits (userId, date, habitType, targetValue) VALUES (?, ?, 'workout', 1)
  `).run(req.userId, date);

  const habits = db.prepare('SELECT * FROM daily_habits WHERE userId = ? AND date = ?').all(req.userId, date);
  const result = {};
  habits.forEach(h => { result[h.habitType] = h; });
  res.json(result);
});

// POST /api/habits/water
router.post('/water', (req, res) => {
  const { amount } = req.body;
  const today = getTodayKey();
  const profile = db.prepare('SELECT waterTarget FROM user_profile WHERE userId = ?').get(req.userId);

  db.prepare(`
    INSERT INTO daily_habits (userId, date, habitType, targetValue, currentValue)
    VALUES (?, ?, 'water', ?, ?)
    ON CONFLICT(userId, date, habitType)
    DO UPDATE SET currentValue = MIN(currentValue + ?, targetValue)
  `).run(req.userId, today, profile?.waterTarget || 4.0, amount || 0.5, amount || 0.5);

  const habit = db.prepare("SELECT * FROM daily_habits WHERE userId = ? AND date = ? AND habitType = 'water'").get(req.userId, today);
  res.json(habit);
});

// POST /api/habits/workout
router.post('/workout', (req, res) => {
  const today = getTodayKey();

  db.prepare(`
    INSERT INTO daily_habits (userId, date, habitType, targetValue, currentValue)
    VALUES (?, ?, 'workout', 1, 1)
    ON CONFLICT(userId, date, habitType)
    DO UPDATE SET currentValue = CASE WHEN currentValue = 0 THEN 1 ELSE 0 END
  `).run(req.userId, today);

  const habit = db.prepare("SELECT * FROM daily_habits WHERE userId = ? AND date = ? AND habitType = 'workout'").get(req.userId, today);
  res.json(habit);
});

export default router;
