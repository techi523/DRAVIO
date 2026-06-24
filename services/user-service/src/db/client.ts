import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || (process.env.LOCAL_DEV === 'true' ? 'localhost' : 'user-db'),
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'dravio_user',
        password: process.env.DB_PASSWORD || 'dravio_password',
        database: process.env.DB_NAME || 'dravio_production',
      }
);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
