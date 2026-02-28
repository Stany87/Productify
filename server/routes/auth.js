import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth.js';
import User from '../models/User.js';
import UserProfile from '../models/UserProfile.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, displayName } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({
            email: email.toLowerCase().trim(),
            displayName: displayName?.trim() || 'User',
            passwordHash,
        });

        // Create user profile
        await UserProfile.create({ userId: user._id, lifeDescription: '' });

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({
            token,
            user: { id: user._id, email: user.email, displayName: user.displayName },
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Registration failed: ' + (err.message || 'Unknown error') });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            token,
            user: { id: user._id, email: user.email, displayName: user.displayName },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed: ' + (err.message || 'Unknown error') });
    }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const token = header.slice(7);
        const payload = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(payload.userId).select('email displayName createdAt');

        if (!user) return res.status(401).json({ error: 'User not found' });
        res.json({ id: user._id, email: user.email, displayName: user.displayName, createdAt: user.createdAt });
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
});

export default router;
