import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || (process.env.LOCAL_DEV === 'true' ? 'localhost' : 'billing-db'),
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'dravio_user',
        password: process.env.DB_PASSWORD || 'dravio_password',
        database: process.env.DB_NAME || 'dravio_production',
      }
);

export const initializeSchema = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS billing;
      CREATE TABLE IF NOT EXISTS billing.wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id TEXT UNIQUE NOT NULL,
        balance_usd DECIMAL(12,2) DEFAULT 0.00,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Billing schema initialized successfully');
  } catch (err) {
    console.error('Failed to initialize billing schema:', err);
    throw err;
  } finally {
    client.release();
  }
};
