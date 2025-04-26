import { google } from 'googleapis';
import { saveUser, saveTokens, getCredentials } from './db.js';

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);

function getAuthUrl() {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/userinfo.email',
        ]
    });
    console.log('Generated auth URL:', authUrl);
    return authUrl;
}

function getDrive() {
    return google.drive({ version: 'v3', auth: oauth2Client });
}

async function checkAuth(req, res, next) {
    const user = req.session.user;
    let authUrl = null;

    if (!user) {
        authUrl = getAuthUrl();
        return res.redirect(authUrl);
    }

    const now = Date.now();
    if (user.accessToken && user.expiryDate >= now) {
        oauth2Client.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken,
            expiry_date: user.expiryDate
        });
        return next();
    }

    if (user.accessToken && user.expiryDate < now) {
        try {
            const { credentials } = await oauth2Client.refreshAccessToken();
            await saveUser(user.googleId, user.email);
            await saveTokens(user.googleId, credentials);

            req.session.user = {
                ...user,
                accessToken: credentials.access_token,
                refreshToken: credentials.refresh_token,
                expiryDate: credentials.expiry_date
            };

            oauth2Client.setCredentials(credentials);
            return next();
        } catch (error) {
            console.error('Error refreshing token:', error);
            authUrl = authUrl || getAuthUrl();
            return res.redirect(authUrl);
        }
    }

    const credentials = await getCredentials(user.googleId);
    if (!credentials) {
        authUrl = authUrl || getAuthUrl();
        return res.redirect(authUrl);
    }

    oauth2Client.setCredentials(credentials);
    req.session.user = credentials;
    return next();
}

async function handleAuthCallback(req, res) {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).send('Authorization code is required');
        }

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userinfo = await oauth2.userinfo.get();
        const { id, email } = userinfo.data;

        await saveUser(id, email);
        await saveTokens(id, tokens);

        req.session.user = {
            googleId: id,
            email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiryDate: tokens.expiry_date
        };

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).send('Session error');
            }
            res.redirect('/');
        });
    } catch (error) {
        console.error('Auth callback error:', error);
        return res.status(500).send('Authentication failed. Please try again.');
    }
}

export { getDrive, checkAuth, handleAuthCallback };