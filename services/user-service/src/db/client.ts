import pg from 'pg';

const { Pool } = pg;

const sslConfig = process.env.DATABASE_URL && process.env.NODE_ENV === 'production'
  ? { ssl: { rejectUnauthorized: false } }
  : {};

export const pool = new Pool({
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || (process.env.LOCAL_DEV === 'true' ? 'localhost' : 'user-db'),
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'dravio_user',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'dravio_production',
      }),
  ...sslConfig,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

