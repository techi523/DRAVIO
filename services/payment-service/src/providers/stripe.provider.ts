import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('FATAL: STRIPE_SECRET_KEY environment variable is required for payment processing.');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export interface StripeIntentResult {
  providerRef: string;
  checkoutUrl: string;
  clientSecret: string;
}

export class StripeProvider {
  /**
   * Creates a real Stripe Payment Intent for card-based payments.
   */
  async createPaymentIntent(
    amountUsd: number,
    currency: string,
    metadata: Record<string, string>
  ): Promise<StripeIntentResult> {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountUsd * 100), // Stripe uses cents
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

  /**
   * Verifies a Stripe webhook signature and parses the event.
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  /**
   * Retrieves a payment intent to check its current status.
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Creates a payout to a connected account (seller withdrawal).
   */
  async createPayout(amountUsd: number, currency: string, destination: string): Promise<Stripe.Payout> {
    return stripe.payouts.create({
      amount: Math.round(amountUsd * 100),
      currency: currency.toLowerCase(),
      destination,
    });
  }
}

export const stripeProvider = new StripeProvider();
