import { z } from 'zod';

export const SUPPORTED_CURRENCIES = ['USD', 'KES', 'EUR', 'GBP'] as const;

export const MAX_PAYMENT_AMOUNT_USD = 100_000;

export const InitiatePaymentSchema = z.object({
  amount_usd: z.number().positive().max(MAX_PAYMENT_AMOUNT_USD).multipleOf(0.01),
  currency: z.enum(SUPPORTED_CURRENCIES).default('USD'),
  // Removed 'CRYPTO' — no provider implementation exists; it orphaned transactions.
  method: z.enum(['STRIPE', 'MPESA']),
  session_id: z.string().uuid().optional(),
  phone_number: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'phone_number must be a valid phone number').optional(),
  idempotency_key: z.string().uuid().optional(),
});

export type InitiatePaymentInput = z.infer<typeof InitiatePaymentSchema>;

// Stripe webhooks arrive with a signature header; the body is raw JSON.
// The schema below is used only after the signature has been verified.
export const StripeWebhookEventSchema = z.object({
  type: z.string(),
  data: z.object({
    object: z.object({
      id: z.string(),
    }),
  }),
});

// M-Pesa STK callbacks are unsigned; the callback MUST be reconciled
// against the stored transaction (amount + checkoutRequestID).
export const MpesaCallbackBodySchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      CheckoutRequestID: z.string(),
      MerchantRequestID: z.string().optional(),
      ResultCode: z.number().int().optional(),
      ResultDesc: z.string().optional(),
      CallbackMetadata: z
        .object({
          Item: z
            .array(
              z.object({
                Name: z.string(),
                Value: z.unknown().optional(),
              })
            )
            .optional(),
        })
        .optional(),
    }),
  }),
});