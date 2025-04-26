import express from 'express';
import session from 'express-session';
import { checkAuth, handleAuthCallback } from './auth.js';
import { initialize, shutdown } from './db.js';
import { uploadFiles, getUploadedFiles, getAllFiles } from './handler.js';

initialize();
const app = express();

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'development-secret',
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

app.post('/upload-files', async (req, res) => {
    const { urls } = req.body;
    if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'Provide an array of URLs' });
    }
    const results = await uploadFiles(req.session.user!.googleId, urls);
    res.json({ results });
});

app.get('/get-uploaded-files', async (req, res) => {
    try {
        const files = await getUploadedFiles(req.session.user!.googleId);
        res.json({ files });
    } catch (error) {
        console.error('Drive error:', error);
        res.status(500).send('Drive error. Please try again.');
    }
});

app.get('/get-all-files', async (req, res) => {
    try {
        const files = await getAllFiles(req.session.user!.googleId);
        res.json({ files });
    } catch (error) {
        console.error('Drive error:', error);
        res.status(500).send('Drive error. Please try again.');
    }
});

const server = app.listen(process.env.APP_PORT, () => {
    console.log(`Server is running on port ${process.env.APP_PORT}`);
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