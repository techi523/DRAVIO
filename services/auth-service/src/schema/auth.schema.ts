import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  country_code: z.string().length(2).optional().default('US'),
  role: z.enum(['BUYER', 'SELLER', 'ADMIN']).default('BUYER'),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const OAuthLoginSchema = z.object({
  provider: z.enum(['google', 'github', 'apple', 'microsoft', 'facebook', 'x']),
  id_token: z.string().optional(),
  access_token: z.string().optional(),
  role_preference: z.enum(['BUYER', 'SELLER']).default('BUYER'), // Used only if new user
});

export const OtpSendSchema = z.object({
  phone_number: z.string(), // E.g. +1234567890
});

export const OtpVerifySchema = z.object({
  phone_number: z.string(),
  code: z.string().length(6),
  role_preference: z.enum(['BUYER', 'SELLER']).default('BUYER'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type OAuthLoginInput = z.infer<typeof OAuthLoginSchema>;
export type OtpSendInput = z.infer<typeof OtpSendSchema>;
export type OtpVerifyInput = z.infer<typeof OtpVerifySchema>;
