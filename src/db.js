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
            CREATE TABLE IF NOT EXISTS credentials (
                google_id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                access_token TEXT NOT NULL,
                refresh_token TEXT NOT NULL,
                expiry_date BIGINT NOT NULL
            )
        `);
    } catch (error) {
        throw new Error('Error initializing database', error);
    } finally {
        client.release();
    }
}

async function saveCredentials(googleId, email, tokens) {
    const client = await pool.connect();
    try {
        if (tokens.refresh_token) {
            await client.query(`
                INSERT INTO credentials (google_id, email, access_token, refresh_token, expiry_date) 
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (google_id) 
                DO UPDATE SET 
                    email = EXCLUDED.email,
                    access_token = EXCLUDED.access_token,
                    refresh_token = EXCLUDED.refresh_token,
                    expiry_date = EXCLUDED.expiry_date
            `,
                [googleId, email, tokens.access_token, tokens.refresh_token, tokens.expiry_date]
            );
        } else {
            await client.query(
                'UPDATE credentials SET access_token = $1, expiry_date = $2 WHERE google_id = $3',
                [tokens.access_token, tokens.expiry_date, googleId]
            );
        }
    } catch (error) {
        throw new Error('Error saving credentials to database', error);
    } finally {
        client.release();
    }
}

async function getCredentials(googleId) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT * FROM credentials WHERE google_id = $1',
            [googleId]
        );
        return result.rows[0];
    } catch (error) {
        return null;
    } finally {
        client.release();
    }
}

async function shutdown() {
    await pool.end();
}

export { initialize, saveCredentials, getCredentials, shutdown };