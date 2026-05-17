import { paymentRepository } from '../repositories/payment.repository.js';
import { InitiatePaymentInput } from '../schema/payment.schema.js';
import { producer } from '../kafka/producer.js';

export class PaymentService {
  async initiatePayment(userId: string, input: InitiatePaymentInput) {
    // 1. Check idempotency
    if (input.idempotency_key) {
      const existing = await paymentRepository.findByIdempotencyKey(input.idempotency_key);
      if (existing) {
        return {
          payment_id: existing.id,
          provider_ref: existing.provider_ref,
          status: existing.status,
          reused: true
        };
      }
    }

    // 2. Create transaction record
    const transaction = await paymentRepository.create({
      ...input,
      user_id: userId
    });

    // 3. Mock provider intent
    const providerRef = `mock_${input.method.toLowerCase()}_${Date.now()}`;
    await paymentRepository.updateProviderRef(transaction.id, providerRef);

    return {
      payment_id: transaction.id,
      provider_ref: providerRef,
      status: 'PENDING',
      checkout_url: `https://checkout.dravio.com/${providerRef}`
    };
  }

  async handleWebhook(providerRef: string, event: string) {
    if (event === 'payment_intent.succeeded') {
      const transaction = await paymentRepository.completeByRef(providerRef);
      if (transaction) {
        console.log(`Payment successful for transaction ${transaction.id}, emitting dm.payment.completed event...`);
        await producer.send({
          topic: 'dm.payment.completed',
          messages: [{ value: JSON.stringify({ transactionId: transaction.id, userId: transaction.user_id, amount: transaction.amount_usd }) }]
        });
      }
      return transaction;
    }
    return null;
  }
}


export const paymentService = new PaymentService();
