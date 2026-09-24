import { z } from 'zod';

export const CreateProfileSchema = z.object({
  auth_user_id: z.string().uuid(),
  full_name: z.string().min(2),
  country_code: z.string().length(2),
});

export const UpdateProfileSchema = z.object({
  full_name: z.string().min(2).max(255).optional(),
  country_code: z.string().length(2).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one updateable field is required',
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type CreateProfileInput = z.infer<typeof CreateProfileSchema>;
