import { z } from 'zod';

export const CreateProfileSchema = z.object({
  auth_user_id: z.string().uuid(),
  full_name: z.string().min(2),
  country_code: z.string().length(2),
});

export type CreateProfileInput = z.infer<typeof CreateProfileSchema>;
