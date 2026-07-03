import pg from 'pg';

const { Pool } = pg;

const sslConfig = (process.env.DATABASE_URL && process.env.NODE_ENV === 'production')
  ? { ssl: { rejectUnauthorized: false } }
  : {};

export const pool = new Pool({
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'dravio_user',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'dravio_production',
      }),
  ...sslConfig,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('[DB] PostgreSQL connection OK');
    return true;
  } catch (err) {
    console.error('[DB] PostgreSQL connection failed:', err);
    return false;
  }
}
