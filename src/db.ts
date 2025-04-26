import { Pool } from 'pg';
import { User } from './models.js';
import { Credentials } from 'google-auth-library';

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

async function initialize(): Promise<void> {
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
                expiry_date BIGINT NOT NULL,
                token_type TEXT,
                scope TEXT,
                id_token TEXT
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
        throw new Error('Error initializing database: ' + (error as Error).message);
    } finally {
        client.release();
    }
}

async function saveUser(googleId: string, email: string): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO users (google_id, email)
            VALUES ($1, $2)
            ON CONFLICT (google_id) DO UPDATE
            SET email = EXCLUDED.email
        `, [googleId, email]);
    } catch (error) {
        throw new Error('Error saving user to database for user ' + googleId + ': ' + (error as Error).message);
    } finally {
        client.release();
    }
}

async function saveCredentials(googleId: string, credentials: Credentials): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO tokens (google_id, access_token, refresh_token, expiry_date, token_type, scope, id_token)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (google_id) DO UPDATE
            SET access_token = EXCLUDED.access_token,
                refresh_token = CASE 
                    WHEN EXCLUDED.refresh_token IS NOT NULL 
                    THEN EXCLUDED.refresh_token 
                    ELSE tokens.refresh_token 
                END,
                expiry_date = EXCLUDED.expiry_date,
                token_type = EXCLUDED.token_type,
                scope = EXCLUDED.scope,
                id_token = EXCLUDED.id_token
        `, [
            googleId,
            credentials.access_token,
            credentials.refresh_token,
            credentials.expiry_date,
            credentials.token_type,
            credentials.scope,
            credentials.id_token
        ]);
    } catch (error) {
        throw new Error('Error saving credentials to database for user ' + googleId + ': ' + (error as Error).message);
    } finally {
        client.release();
    }
}

async function getUser(googleId: string): Promise<User | null> {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT google_id, email
            FROM users
            WHERE google_id = $1
        `, [googleId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting user from database for user ' + googleId, error);
        return null;
    } finally {
        client.release();
    }
}

async function getCredentials(googleId: string): Promise<Credentials | null> {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT access_token, refresh_token, expiry_date, token_type, scope, id_token
            FROM tokens
            WHERE google_id = $1
        `, [googleId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting credentials from database for user ' + googleId, error);
        return null;
    } finally {
        client.release();
    }
}

async function saveFile(googleId: string, fileId: string): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO files (google_id, file_id)
            VALUES ($1, $2)
            ON CONFLICT (google_id, file_id) DO NOTHING
        `, [googleId, fileId]);
    } catch (error) {
        throw new Error('Error saving file to database for user ' + googleId + ': ' + (error as Error).message);
    } finally {
        client.release();
    }
}

async function getFileIds(googleId: string): Promise<{ file_id: string }[]> {
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
        return [];
    } finally {
        client.release();
    }
}

async function shutdown(): Promise<void> {
    await pool.end();
}

export { initialize, saveUser, saveCredentials, getUser, getCredentials, saveFile, getFileIds, shutdown };