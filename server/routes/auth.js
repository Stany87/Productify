import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { JWT_SECRET } from '../middleware/auth.js';

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

        // Check if email exists
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const result = db.prepare(
            'INSERT INTO users (email, displayName, passwordHash) VALUES (?, ?, ?)'
        ).run(email.toLowerCase().trim(), displayName?.trim() || 'User', passwordHash);

        const userId = result.lastInsertRowid;

        // Create user profile
        db.prepare('INSERT INTO user_profile (userId, lifeDescription) VALUES (?, ?)').run(userId, '');

        const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({
            token,
            user: { id: userId, email: email.toLowerCase().trim(), displayName: displayName?.trim() || 'User' },
        });
    } catch (err) {
        console.error('Registration error:', err.message, err.code);
        res.status(500).json({ error: 'Registration failed: ' + err.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            token,
            user: { id: user.id, email: user.email, displayName: user.displayName },
        });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const token = header.slice(7);
        const payload = jwt.verify(token, JWT_SECRET);
        const user = db.prepare('SELECT id, email, displayName, createdAt FROM users WHERE id = ?').get(payload.userId);
        if (!user) return res.status(401).json({ error: 'User not found' });
        res.json(user);
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
});

export default router;
