import express from 'express';
import session from 'express-session';
import { initializeDatabase, shutdown } from './db.js';
import { checkAuth, handleAuthCallback, getDrive } from './auth.js';

initializeDatabase();
const app = express();

app.use(session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use((req, res, next) => {
    if (req.path === '/auth/google/callback') {
        return next();
    }
    return checkAuth(req, res, next);
});

app.get('/', (req, res) => {
    res.send(`Welcome ${req.session.user?.email}`);
});

app.get('/auth/google/callback', handleAuthCallback);

app.get('/drive/v3/files', async (_, res) => {
    try {
        const drive = getDrive();
        const response = await drive.files.list({ q: "'me' in owners and trashed = false" });
        res.json(response.data);
    } catch (error) {
        console.error('Drive error:', error);
        res.status(500).send('Drive error. Please try again.');
    }
});

const server = app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(async () => {
        console.log('HTTP server closed');
        await shutdown();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(async () => {
        console.log('HTTP server closed');
        await shutdown();
        process.exit(0);
    });
});