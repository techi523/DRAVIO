import { paymentRepository } from '../repositories/payment.repository.js';
import { InitiatePaymentInput } from '../schema/payment.schema.js';
import { producer } from '../kafka/producer.js';
import { paymentRouter } from '../providers/payment-router.js';

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

    // 2. Create transaction record (PENDING)
    const transaction = await paymentRepository.create({
      ...input,
      user_id: userId
    });

    // 3. Route to real payment provider (Stripe, M-Pesa, etc.)
    const providerResult = await paymentRouter.createPaymentIntent(
      input.method,
      input.amount_usd,
      input.currency || 'USD',
      {
        transaction_id: transaction.id,
        user_id: userId,
        session_id: input.session_id || '',
        phone_number: input.phone_number || '',
      }
    );

    // 4. Persist provider reference
    await paymentRepository.updateProviderRef(transaction.id, providerResult.providerRef);

    return {
      payment_id: transaction.id,
      provider_ref: providerResult.providerRef,
      provider_type: providerResult.providerType,
      status: 'PENDING',
      checkout_url: providerResult.checkoutUrl,
    };
  }

  async handleWebhook(providerRef: string, event: string) {
    if (event === 'payment_intent.succeeded') {
      const transaction = await paymentRepository.completeByRef(providerRef);
      if (transaction) {
        await producer.send({
          topic: 'dm.payment.completed',
          messages: [{
            key: transaction.id,
            value: JSON.stringify({
              transactionId: transaction.id,
              userId: transaction.user_id,
              amount: transaction.amount_usd,
              providerRef,
              completedAt: new Date().toISOString()
            })
          }]
        });
      }
      return transaction;
    }
    return null;
  }

  async handleMpesaCallback(callbackData: any) {
    const { mpesaProvider } = await import('../providers/mpesa.provider.js');
    const parsed = mpesaProvider.parseCallback(callbackData);

    if (parsed.resultCode === 0) {
      // Payment successful
      const transaction = await paymentRepository.completeByRef(parsed.checkoutRequestID);
      if (transaction) {
        await producer.send({
          topic: 'dm.payment.completed',
          messages: [{
            key: transaction.id,
            value: JSON.stringify({
              transactionId: transaction.id,
              userId: transaction.user_id,
              amount: transaction.amount_usd,
              providerRef: parsed.checkoutRequestID,
              mpesaReceipt: parsed.mpesaReceiptNumber,
              completedAt: new Date().toISOString()
            })
          }]
        });
      }
      return { received: true, status: 'COMPLETED' };
    } else {
      // Payment failed or cancelled by user
      await paymentRepository.failByRef(parsed.checkoutRequestID, parsed.resultDesc);
      return { received: true, status: 'FAILED', reason: parsed.resultDesc };
    }
  }
}

export const paymentService = new PaymentService();
