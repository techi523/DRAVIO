import { z } from 'zod';

export const HeartbeatSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  price_per_gb: z.number().positive(),
});

export type HeartbeatInput = z.infer<typeof HeartbeatSchema>;

export const SearchSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  radius: z.coerce.number().positive().default(5),
  unit: z.enum(['km', 'm', 'mi', 'ft']).default('km'),
});

export type SearchInput = z.infer<typeof SearchSchema>;
