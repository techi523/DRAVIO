import { z } from 'zod';

export const HeartbeatSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  pricing: z.object({
    model: z.enum(['per_mb', 'per_gb', 'per_hour']),
    rate: z.number().positive(),
  }),
  metrics: z.object({
    avgSpeed: z.number().positive().optional(),
    stability: z.number().min(0).max(100).optional(),
    maxUsers: z.number().int().positive().optional(),
  }),
  status: z.enum(['active', 'idle', 'offline']).default('active'),
});

export type HeartbeatInput = z.infer<typeof HeartbeatSchema>;

export const SearchSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().default(50),
  unit: z.enum(['km', 'm', 'mi', 'ft']).default('km'),
});

export type SearchInput = z.infer<typeof SearchSchema>;
