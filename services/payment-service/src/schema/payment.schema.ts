import { z } from 'zod';

export const InitiatePaymentSchema = z.object({
  amount_usd: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  method: z.enum(['STRIPE', 'MPESA', 'CRYPTO']),
  session_id: z.string().uuid().optional(),
  phone_number: z.string().optional(),
  idempotency_key: z.string().uuid().optional(),
});

export type InitiatePaymentInput = z.infer<typeof InitiatePaymentSchema>;

export const WebhookSchema = z.object({
  event: z.string(),
  provider_ref: z.string(),
});
