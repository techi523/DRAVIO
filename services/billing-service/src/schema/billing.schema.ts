import { z } from 'zod';

export const GenerateInvoiceSchema = z.object({
  customer_id: z.string().uuid(),
  isp_id: z.string().uuid(),
});

export type GenerateInvoiceInput = z.infer<typeof GenerateInvoiceSchema>;
