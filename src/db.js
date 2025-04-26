import { Pool } from 'pg';

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

async function initialize() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                google_id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE
            )
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS tokens (
                google_id TEXT PRIMARY KEY REFERENCES users(google_id) ON DELETE CASCADE,
                access_token TEXT NOT NULL,
                refresh_token TEXT NOT NULL,
                expiry_date BIGINT NOT NULL
            )
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS files (
                id SERIAL PRIMARY KEY,
                google_id TEXT REFERENCES users(google_id) ON DELETE CASCADE,
                file_id TEXT NOT NULL,
                UNIQUE(google_id, file_id)
            )
        `);
    } catch (error) {
        throw new Error('Error initializing database', error);
    } finally {
        client.release();
    }
}

async function saveUser(googleId, email) {
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO users (google_id, email)
            VALUES ($1, $2)
            ON CONFLICT (google_id) DO UPDATE
            SET email = EXCLUDED.email
        `, [googleId, email]);
    } catch (error) {
        throw new Error('Error saving user to database for user ' + googleId, error);
    } finally {
        client.release();
    }
}

async function saveTokens(googleId, tokens) {
    const client = await pool.connect();
    try {
        await client.query(`
                INSERT INTO tokens (google_id, access_token, refresh_token, expiry_date)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (google_id) DO UPDATE
                SET access_token = EXCLUDED.access_token,
                    refresh_token = CASE 
                        WHEN EXCLUDED.refresh_token IS NOT NULL 
                        THEN EXCLUDED.refresh_token 
                        ELSE tokens.refresh_token 
                    END,
                    expiry_date = EXCLUDED.expiry_date
            `, [googleId, tokens.access_token, tokens.refresh_token, tokens.expiry_date]);
    } catch (error) {
        throw new Error('Error saving tokens to database for user ' + googleId, error);
    } finally {
        client.release();
    }
}

async function getCredentials(googleId) {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT u.google_id, u.email, t.access_token, t.refresh_token, t.expiry_date
            FROM users u
            JOIN tokens t ON u.google_id = t.google_id
            WHERE u.google_id = $1
        `, [googleId]);
        return result.rows[0];
    } catch (error) {
        console.error('Error getting credentials from database for user ' + googleId, error);
        return null;
    } finally {
        client.release();
    }
}

async function saveFile(googleId, fileId) {
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO files (google_id, file_id)
            VALUES ($1, $2)
            ON CONFLICT (google_id, file_id) DO NOTHING
        `, [googleId, fileId]);
    } catch (error) {
        throw new Error('Error saving file to database for user ' + googleId, error);
    } finally {
        client.release();
    }
}

async function getFileIds(googleId) {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT file_id
            FROM files
            WHERE google_id = $1
        `, [googleId]);
        return result.rows;
    } catch (error) {
        console.error('Error getting files from database for user ' + googleId, error);
        return null;
    } finally {
        client.release();
    }
}

async function shutdown() {
    await pool.end();
}

export { initialize, saveUser, saveTokens, getCredentials, saveFile, getFileIds, shutdown };