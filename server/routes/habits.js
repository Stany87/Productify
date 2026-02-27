import { Router } from 'express';
import pool from '../db.js';

const router = Router();

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// GET /api/habits/:date
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { rows: profileRows } = await pool.query('SELECT waterTarget as "waterTarget" FROM user_profile WHERE userId = $1', [req.userId]);
    const waterTarget = profileRows[0]?.waterTarget || 4.0;

    await pool.query(`
      INSERT INTO daily_habits (userId, date, habitType, targetValue) 
      VALUES ($1, $2, 'water', $3)
      ON CONFLICT (userId, date, habitType) DO NOTHING
    `, [req.userId, date, waterTarget]);

    await pool.query(`
      INSERT INTO daily_habits (userId, date, habitType, targetValue) 
      VALUES ($1, $2, 'workout', 1)
      ON CONFLICT (userId, date, habitType) DO NOTHING
    `, [req.userId, date]);

    const { rows: habits } = await pool.query('SELECT * FROM daily_habits WHERE userId = $1 AND date = $2', [req.userId, date]);
    const result = {};
    habits.forEach(h => { result[h.habittype] = h; });
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
    const { rows: profileRows } = await pool.query('SELECT waterTarget as "waterTarget" FROM user_profile WHERE userId = $1', [req.userId]);
    const target = profileRows[0]?.waterTarget || 4.0;

    await pool.query(`
      INSERT INTO daily_habits (userId, date, habitType, targetValue, currentValue)
      VALUES ($1, $2, 'water', $3, $4)
      ON CONFLICT(userId, date, habitType)
      DO UPDATE SET currentValue = LEAST(daily_habits.currentValue + $4, daily_habits.targetValue)
    `, [req.userId, today, target, amount || 0.5]);

    const { rows } = await pool.query("SELECT * FROM daily_habits WHERE userId = $1 AND date = $2 AND habitType = 'water'", [req.userId, today]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Water update error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/habits/workout
router.post('/workout', async (req, res) => {
  try {
    const today = getTodayKey();

    await pool.query(`
      INSERT INTO daily_habits (userId, date, habitType, targetValue, currentValue)
      VALUES ($1, $2, 'workout', 1, 1)
      ON CONFLICT(userId, date, habitType)
      DO UPDATE SET currentValue = CASE WHEN daily_habits.currentValue = 0 THEN 1 ELSE 0 END
    `, [req.userId, today]);

    const { rows } = await pool.query("SELECT * FROM daily_habits WHERE userId = $1 AND date = $2 AND habitType = 'workout'", [req.userId, today]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Workout update error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;

