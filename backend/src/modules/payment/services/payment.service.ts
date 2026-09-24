import { paymentRepository } from '../repositories/payment.repository.js';
import { InitiatePaymentInput } from '../schema/payment.schema.js';
import { producer } from '../kafka/producer.js';
import { paymentRouter } from '../providers/payment-router.js';
import { computeFees } from '../money.js';
import { policyAcceptanceRepository } from '../../compliance/repositories/policy-acceptance.repository.js';
import { assertSatisfiesGate } from '../../compliance/pure/policy-registry.js';

export class PaymentService {
  async initiatePayment(userId: string, input: InitiatePaymentInput) {
    // Policy gate: no purchase/payment until the CURRENT buyer_terms version
    // has been accepted. Real enforcement, not a fabricated consent claim.
    const acceptedRows = await policyAcceptanceRepository.acceptedVersions(userId);
    const gate = assertSatisfiesGate('PURCHASE', acceptedRows.map((r) => ({
      policyId: r.policy_id,
      version: r.version,
      acceptedAt: new Date(r.accepted_at).toISOString(),
    })));
    if (!gate.satisfied) {
      throw new Error('POLICY_ACCEPTANCE_REQUIRED');
    }

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

    // Create is idempotency-safe at the DB level (ON CONFLICT DO NOTHING).
    let transaction = await paymentRepository.create({
      ...input,
      user_id: userId
    });

    // A concurrent create with the same idempotency_key may have won the race.
    if (!transaction && input.idempotency_key) {
      transaction = await paymentRepository.findByIdempotencyKey(input.idempotency_key);
    }
    if (!transaction) {
      throw new Error('PAYMENT_CREATE_FAILED');
    }

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

    await paymentRepository.updateProviderRef(transaction.id, providerResult.providerRef);

    return {
      payment_id: transaction.id,
      provider_ref: providerResult.providerRef,
      provider_type: providerResult.providerType,
      status: 'PENDING',
      checkout_url: providerResult.checkoutUrl,
    };
  }

  /**
   * Stripe webhook handler. The caller MUST already have verified the
   * `Stripe-Signature`. Only `payment_intent.succeeded` is acted upon, and
   * the transaction is only completed while still PENDING (replay-safe).
   */
  async handleVerifiedStripeEvent(event: any): Promise<{ transaction: any; credited: boolean } | null> {
    if (event.type !== 'payment_intent.succeeded') {
      return null;
    }
    const providerRef = event.data?.object?.id;
    if (!providerRef) {
      return null;
    }

    const amountUsd = ((event.data?.object?.amount ?? 0) / 100);

    const transaction = await paymentRepository.completeAndCredit(
      providerRef,
      computeFees(amountUsd)
    );

    if (!transaction) {
      return null; // not PENDING (replay/dup) — no event emitted
    }
    await this.publishCompleted(transaction, providerRef);
    return { transaction, credited: true };
  }

  async handleMpesaCallback(callbackData: any): Promise<{ status: string; transaction?: any }> {
    const { mpesaProvider } = await import('../providers/mpesa.provider.js');
    const parsed = mpesaProvider.parseCallback(callbackData);

    if (parsed.resultCode === 0) {
      // Resolve the stored transaction first: reconcile amount before completing.
      const stored = await paymentRepository.findByRef(parsed.checkoutRequestID);
      if (!stored) {
        return { status: 'UNKNOWN_REF' };
      }
      // The transaction may already be non-PENDING (dedup/replay).
      if (stored.status !== 'PENDING') {
        return { status: 'IGNORED' };
      }

      if (parsed.amount !== undefined && parsed.amount !== null) {
        const fxRate = Number(process.env.USD_TO_KES_RATE || '155.0');
        const expectedKes = Math.round(Number(stored.amount_usd) * fxRate);
        const tolerance = 5.0; // KES — tolerate FX rounding
        if (Math.abs(Number(parsed.amount) - expectedKes) > tolerance) {
          await paymentRepository.failByRef(parsed.checkoutRequestID, `AMOUNT_MISMATCH expected~${expectedKes}KES got ${parsed.amount}KES`);
          return { status: 'FAILED', transaction: stored };
        }
      }

      const transaction = await paymentRepository.completeAndCredit(
        parsed.checkoutRequestID,
        computeFees(Number(stored.amount_usd))
      );

      if (transaction) {
        await this.publishCompleted(transaction, parsed.checkoutRequestID, parsed.mpesaReceiptNumber);
        return { status: 'COMPLETED', transaction };
      }
      return { status: 'IGNORED' };
    } else {
      await paymentRepository.failByRef(parsed.checkoutRequestID, parsed.resultDesc);
      return { status: 'FAILED' };
    }
  }

  private async publishCompleted(transaction: any, providerRef: string, mpesaReceipt?: string) {
    try {
      await producer.send({
        topic: 'dm.payment.completed',
        messages: [{
          key: transaction.id,
          value: JSON.stringify({
            transactionId: transaction.id,
            userId: transaction.user_id,
            amount: transaction.amount_usd,
            platformFeeUsd: transaction.platform_fee_usd,
            sellerNetUsd: transaction.seller_net_usd,
            providerRef,
            mpesaReceipt: mpesaReceipt || null,
            completedAt: new Date().toISOString()
          })
        }]
      });
    } catch (err) {
      console.warn('[PaymentService] Failed to publish dm.payment.completed (non-fatal):', err);
    }
  }
}

export const paymentService = new PaymentService();