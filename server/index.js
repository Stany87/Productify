import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import { authMiddleware } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import sessionsRouter from './routes/sessions.js';
import punishmentRouter from './routes/punishment.js';
import habitsRouter from './routes/habits.js';
import statsRouter from './routes/stats.js';
import aiRouter from './routes/ai.js';
import leetcodeRouter from './routes/leetcode.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serve built frontend in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '..', 'dist')));
}

// Public routes (no auth)
app.use('/api/auth', authRouter);
app.use('/api/leetcode', leetcodeRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: 'v5-multiuser', timestamp: new Date().toISOString() });
});

// Protected routes (auth required)
app.use('/api/profile', authMiddleware, profileRouter);
app.use('/api/sessions', authMiddleware, sessionsRouter);
app.use('/api/punishment', authMiddleware, punishmentRouter);
app.use('/api/habits', authMiddleware, habitsRouter);
app.use('/api/stats', authMiddleware, statsRouter);
app.use('/api/ai', authMiddleware, aiRouter);

// SPA fallback for production
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`⚡ Productify v5 server running on http://localhost:${PORT}`);
});
