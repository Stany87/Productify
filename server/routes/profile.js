import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/profile
router.get('/', (req, res) => {
  const profile = db.prepare('SELECT * FROM user_profile WHERE userId = ?').get(req.userId);
  if (!profile) {
    // Auto-create profile for user
    db.prepare('INSERT INTO user_profile (userId, lifeDescription) VALUES (?, ?)').run(req.userId, '');
    const created = db.prepare('SELECT * FROM user_profile WHERE userId = ?').get(req.userId);
    return res.json(created);
  }
  res.json(profile);
});

// PUT /api/profile
router.put('/', (req, res) => {
  const { lifeDescription, leetcodeTarget, leetcodeUsername, skillFocuses, waterTarget } = req.body;

  // Ensure profile exists
  const existing = db.prepare('SELECT * FROM user_profile WHERE userId = ?').get(req.userId);
  if (!existing) {
    db.prepare('INSERT INTO user_profile (userId, lifeDescription) VALUES (?, ?)').run(req.userId, '');
  }

  db.prepare(`
    UPDATE user_profile SET
      lifeDescription = COALESCE(?, lifeDescription),
      leetcodeTarget = COALESCE(?, leetcodeTarget),
      leetcodeUsername = COALESCE(?, leetcodeUsername),
      skillFocuses = COALESCE(?, skillFocuses),
      waterTarget = COALESCE(?, waterTarget),
      updatedAt = datetime('now')
    WHERE userId = ?
  `).run(
    lifeDescription ?? null,
    leetcodeTarget ?? null,
    leetcodeUsername ?? null,
    skillFocuses ? JSON.stringify(skillFocuses) : null,
    waterTarget ?? null,
    req.userId
  );
  const updated = db.prepare('SELECT * FROM user_profile WHERE userId = ?').get(req.userId);
  res.json(updated);
});

// PUT /api/profile/password
router.put('/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Invalid password' });
  }

  const { default: bcrypt } = await import('bcryptjs');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(hash, req.userId);
  res.json({ success: true });
});

export default router;
