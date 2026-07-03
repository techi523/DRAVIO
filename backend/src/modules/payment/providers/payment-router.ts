import { stripeProvider, StripeIntentResult } from './stripe.provider.js';
import { mpesaProvider, STKPushResult } from './mpesa.provider.js';

export interface PaymentProviderResult {
  providerRef: string;
  checkoutUrl: string;
  providerType: 'stripe' | 'mpesa';
}

export class PaymentRouter {
  async createPaymentIntent(
    method: string,
    amountUsd: number,
    currency: string,
    metadata: Record<string, string>
  ): Promise<PaymentProviderResult> {
    const normalizedMethod = method.toLowerCase().trim();

    switch (normalizedMethod) {
      case 'card':
      case 'stripe':
      case 'visa':
      case 'mastercard': {
        const result: StripeIntentResult = await stripeProvider.createPaymentIntent(
          amountUsd,
          currency,
          metadata
        );
        return {
          providerRef: result.providerRef,
          checkoutUrl: result.checkoutUrl,
          providerType: 'stripe',
        };
      }

      case 'mpesa':
      case 'm-pesa':
      case 'mobile_money': {
        const exchangeRate = parseFloat(process.env.USD_TO_KES_RATE || '155.0');
        const amountKes = amountUsd * exchangeRate;

        const phone = metadata.phone_number;
        if (!phone) {
          throw new Error('M-Pesa payments require a phone_number in metadata');
        }

        const result: STKPushResult = await mpesaProvider.initiateSTKPush(
          phone,
          amountKes,
          metadata.transaction_id || `DRV-${Date.now()}`,
          `DRAVIO Top-Up $${amountUsd.toFixed(2)}`
        );

        return {
          providerRef: result.providerRef,
          checkoutUrl: '',
          providerType: 'mpesa',
        };
      }

      default:
        throw new Error(`Unsupported payment method: ${method}. Supported: card, stripe, mpesa, mobile_money`);
    }
  }
}

export const paymentRouter = new PaymentRouter();
