import express from 'express';
import cors from 'cors';
import path from 'path';
import connectDB from './db.js';

// Fix for __dirname in ESM
const __dirname = path.resolve();

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

// Connect to MongoDB before handling any requests
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('MongoDB connection error:', err);
        res.status(500).json({ error: 'Database connection failed' });
    }
});

// Health check - keep it public
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: 'v6-mongodb', database: 'mongodb-atlas' });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/leetcode', leetcodeRouter);
app.use('/api/profile', authMiddleware, profileRouter);
app.use('/api/sessions', authMiddleware, sessionsRouter);
app.use('/api/punishment', authMiddleware, punishmentRouter);
app.use('/api/habits', authMiddleware, habitsRouter);
app.use('/api/stats', authMiddleware, statsRouter);
app.use('/api/ai', authMiddleware, aiRouter);

// Serve static frontend files (used primarily by the Electron desktop app)
import fs from 'fs';
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API Route Not Found' });
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

export function startServer(port = PORT) {
    return new Promise((resolve) => {
        const server = app.listen(port, () => {
            console.log(`⚡ Server running on port ${port}`);
            resolve(server);
        });
    });
}

// Minimal auto-start for local node execution
if (process.env.START_SERVER === 'true') {
    startServer(PORT);
}

export default app;
