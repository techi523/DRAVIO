import { billingRepository } from '../repositories/billing.repository.js';

export class BillingService {
  async generateInvoice(input: { customer_id: string; isp_id: string }) {
    const bytesUsed = await billingRepository.getUnbilledUsage(input.customer_id);
    
    if (bytesUsed === 0n) {
      return null;
    }

    const amountUsd = (Number(bytesUsed) / (1024 * 1024)) * 0.01;
    
    return await billingRepository.createInvoice({
      customer_id: input.customer_id,
      isp_id: input.isp_id,
      amount_usd: amountUsd,
    });
  }
}

export const billingService = new BillingService();
