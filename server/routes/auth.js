import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
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
        const { rows: existingRows } = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase().trim()]
        );

        if (existingRows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const { rows: userRows } = await pool.query(
            'INSERT INTO users (email, displayName, passwordHash) VALUES ($1, $2, $3) RETURNING id',
            [email.toLowerCase().trim(), displayName?.trim() || 'User', passwordHash]
        );

        const userId = userRows[0].id;

        // Create user profile
        await pool.query(
            'INSERT INTO user_profile (userId, lifeDescription) VALUES ($1, $2)',
            [userId, '']
        );

        const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({
            token,
            user: { id: userId, email: email.toLowerCase().trim(), displayName: displayName?.trim() || 'User' },
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

        const { rows } = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email.toLowerCase().trim()]
        );

        const user = rows[0];
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const valid = await bcrypt.compare(password, user.passwordhash); // Postgres lowers column names unless quoted
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            token,
            user: { id: user.id, email: user.email, displayName: user.displayname },
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
        const { rows } = await pool.query(
            'SELECT id, email, displayName as "displayName", createdAt as "createdAt" FROM users WHERE id = $1',
            [payload.userId]
        );
        const user = rows[0];

        if (!user) return res.status(401).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
});

export default router;

