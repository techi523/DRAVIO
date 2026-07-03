import Stripe from 'stripe';

export interface StripeIntentResult {
  providerRef: string;
  checkoutUrl: string;
  clientSecret: string;
}

export class StripeProvider {
  private stripe: Stripe | null = null;

  private getStripe(): Stripe {
    if (this.stripe) return this.stripe;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured — payment processing unavailable');
    }
    this.stripe = new Stripe(key, {
      apiVersion: '2023-10-16',
    });
    return this.stripe;
  }

  async createPaymentIntent(
    amountUsd: number,
    currency: string,
    metadata: Record<string, string>
  ): Promise<StripeIntentResult> {
    const s = this.getStripe();
    const paymentIntent = await s.paymentIntents.create({
      amount: Math.round(amountUsd * 100),
      currency: currency.toLowerCase(),
      metadata,
      automatic_payment_methods: { enabled: true },
    });

    return {
      providerRef: paymentIntent.id,
      checkoutUrl: paymentIntent.client_secret
        ? `${process.env.STRIPE_CHECKOUT_BASE_URL || 'https://checkout.dravio.com'}/pay/${paymentIntent.id}`
        : '',
      clientSecret: paymentIntent.client_secret || '',
    };
  }

  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    const s = this.getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    return s.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    const s = this.getStripe();
    return s.paymentIntents.retrieve(paymentIntentId);
  }

  async createPayout(amountUsd: number, currency: string, destination: string): Promise<Stripe.Payout> {
    const s = this.getStripe();
    return s.payouts.create({
      amount: Math.round(amountUsd * 100),
      currency: currency.toLowerCase(),
      destination,
    });
  }
}

export const stripeProvider = new StripeProvider();
