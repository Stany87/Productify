import express from 'express';
import cors from 'cors';
import path from 'path';

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

// Health check - keep it public
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: 'v5-serverless', database: 'supabase' });
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

