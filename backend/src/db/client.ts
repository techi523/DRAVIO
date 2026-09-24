import pg from 'pg';

const { Pool } = pg;

// TLS policy for PostgreSQL.
//
// DRAVIO hardens toward zero-trust: in PRODUCTION we require a verifiable
// server certificate chain by default. `PG_SSL_REJECT_UNAUTHORIZED=false` is an
// explicit, operator-granted override for valid proxy/self-managed deployments
// (e.g. a corporate TLS-terminating gateway) — we never silently disable
// verification in production. In local/dev (no DATABASE_URL or non-prod) we keep
// the historic permissive posture so `start_local_dev.ps1` and WSL/Docker dev
// keep working unchanged.
const isProduction = process.env.NODE_ENV === 'production';
const explicitDisable =
  (process.env.PG_SSL_REJECT_UNAUTHORIZED || '').toLowerCase() === 'false';
const sslConfig = process.env.DATABASE_URL
  ? isProduction
    ? { ssl: { rejectUnauthorized: !explicitDisable } }
    : { ssl: { rejectUnauthorized: false } }
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
