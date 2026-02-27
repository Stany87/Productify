import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/profile
router.get('/', async (req, res) => {
  try {
    const { rows: profileRows } = await pool.query(`
      SELECT userId as "userId", lifeDescription as "lifeDescription", 
             leetcodeTarget as "leetcodeTarget", leetcodeUsername as "leetcodeUsername", 
             skillFocuses as "skillFocuses", waterTarget as "waterTarget", 
             updatedAt as "updatedAt" 
      FROM user_profile WHERE userId = $1
    `, [req.userId]);

    let profile = profileRows[0];
    if (!profile) {
      await pool.query('INSERT INTO user_profile (userId, lifeDescription) VALUES ($1, $2) ON CONFLICT (userId) DO NOTHING', [req.userId, '']);
      const { rows } = await pool.query('SELECT * FROM user_profile WHERE userId = $1', [req.userId]);
      profile = rows[0];
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /api/profile
router.put('/', async (req, res) => {
  try {
    const { lifeDescription, leetcodeTarget, leetcodeUsername, skillFocuses, waterTarget } = req.body;

    await pool.query(`
      UPDATE user_profile SET
        lifeDescription = COALESCE($1, lifeDescription),
        leetcodeTarget = COALESCE($2, leetcodeTarget),
        leetcodeUsername = COALESCE($3, leetcodeUsername),
        skillFocuses = COALESCE($4, skillFocuses),
        waterTarget = COALESCE($5, waterTarget),
        updatedAt = NOW()
      WHERE userId = $6
    `, [
      lifeDescription ?? null,
      leetcodeTarget ?? null,
      leetcodeUsername ?? null,
      skillFocuses ? (typeof skillFocuses === 'string' ? skillFocuses : JSON.stringify(skillFocuses)) : null,
      waterTarget ?? null,
      req.userId
    ]);

    const { rows } = await pool.query('SELECT * FROM user_profile WHERE userId = $1', [req.userId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// PUT /api/profile/password
router.put('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    const { default: bcrypt } = await import('bcryptjs');
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = rows[0];

    const valid = await bcrypt.compare(currentPassword, user.passwordhash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET passwordHash = $1 WHERE id = $2', [hash, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Password update failed' });
  }
});

export default router;

