import { billingRepository } from '../repositories/billing.repository.js';
import { GenerateInvoiceInput } from '../schema/billing.schema.js';

export class BillingService {
  async generateInvoice(input: GenerateInvoiceInput) {
    const bytesUsed = await billingRepository.getUnbilledUsage(input.customer_id);
    
    if (bytesUsed === 0n) {
      return null;
    }

    // Precise calculation: $0.01 per MB
    const amountUsd = (Number(bytesUsed) / (1024 * 1024)) * 0.01;
    
    return await billingRepository.createInvoice({
      customer_id: input.customer_id,
      isp_id: input.isp_id,
      amount_usd: amountUsd,
    });
  }
}

export const billingService = new BillingService();
