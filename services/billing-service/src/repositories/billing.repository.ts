import { pool } from '../db/client.js';

export interface Invoice {
  id: string;
  customer_id: string;
  isp_id: string;
  amount_usd: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  due_date: Date;
  created_at: Date;
}

export class BillingRepository {
  async getUnbilledUsage(customerId: string): Promise<bigint> {
    const usageResult = await pool.query(
      "SELECT SUM(bytes_used) as total_bytes FROM billing.usage_records WHERE customer_id = $1 AND recorded_at > (SELECT COALESCE(MAX(created_at), '1970-01-01') FROM billing.invoices WHERE customer_id = $1)",
      [customerId]
    );
    return BigInt(usageResult.rows[0].total_bytes || '0');
  }

  async createInvoice(input: { customer_id: string; isp_id: string; amount_usd: number }): Promise<Invoice> {
    const result = await pool.query(
      "INSERT INTO billing.invoices (customer_id, isp_id, amount_usd, currency, due_date) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '30 days') RETURNING *",
      [input.customer_id, input.isp_id, input.amount_usd, 'USD']
    );
    return result.rows[0];
  }

  async listInvoicesByCustomer(customerId: string): Promise<Invoice[]> {
    const result = await pool.query(
      'SELECT * FROM billing.invoices WHERE customer_id = $1 ORDER BY created_at DESC',
      [customerId]
    );
    return result.rows;
  }

  async getUserBalance(customerId: string): Promise<number> {
    const result = await pool.query(
      'SELECT balance_usd FROM billing.wallets WHERE customer_id = $1',
      [customerId]
    );
    return result.rows[0]?.balance_usd ? parseFloat(result.rows[0].balance_usd) : 0.00;
  }
}

export const billingRepository = new BillingRepository();
