import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'productify-secret-change-in-production';

export function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const token = header.slice(7);
        const payload = jwt.verify(token, JWT_SECRET);
        req.userId = payload.userId;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

export { JWT_SECRET };
