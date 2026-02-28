import { Router } from 'express';
import UserProfile from '../models/UserProfile.js';
import User from '../models/User.js';

const router = Router();

// GET /api/profile
router.get('/', async (req, res) => {
  try {
    let profile = await UserProfile.findOne({ userId: req.userId }).lean();
    if (!profile) {
      profile = await UserProfile.create({ userId: req.userId, lifeDescription: '' });
      profile = profile.toObject();
    }
    res.json(profile);
  } catch (err) {
    console.error('Profile GET error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /api/profile
router.put('/', async (req, res) => {
  try {
    const { lifeDescription, leetcodeTarget, leetcodeUsername, skillFocuses, waterTarget } = req.body;

    const update = {};
    if (lifeDescription !== undefined) update.lifeDescription = lifeDescription;
    if (leetcodeTarget !== undefined) update.leetcodeTarget = leetcodeTarget;
    if (leetcodeUsername !== undefined) update.leetcodeUsername = leetcodeUsername;
    if (skillFocuses !== undefined) update.skillFocuses = typeof skillFocuses === 'string' ? skillFocuses : JSON.stringify(skillFocuses);
    if (waterTarget !== undefined) update.waterTarget = waterTarget;

    const profile = await UserProfile.findOneAndUpdate(
      { userId: req.userId },
      { $set: update },
      { new: true, upsert: true }
    ).lean();

    res.json(profile);
  } catch (err) {
    console.error('Profile PUT error:', err);
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
    const user = await User.findById(req.userId);

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = hash;
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Password update failed' });
  }
});

export default router;
