import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().optional(),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001,http://localhost:8000'),
  
  // Firebase
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  // M-Pesa
  MPESA_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_PASSKEY: z.string().optional(),
  MPESA_SHORTCODE: z.string().optional(),
  MPESA_CALLBACK_URL: z.string().optional(),
  
  // Currency
  USD_TO_KES_RATE: z.coerce.number().default(155.0),
  
  // Kafka
  KAFKA_URL: z.string().optional(),
  
  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),
  
  // ISP (dynamic naming: ISP_<ID>_BASE_URL, ISP_<ID>_API_KEY, ISP_<ID>_SECRET)
  ISP_001_BASE_URL: z.string().optional(),
  ISP_001_API_KEY: z.string().optional(),
  ISP_001_SECRET: z.string().optional(),

  // Platform fee
  PLATFORM_FEE_PCT: z.coerce.number().min(0).max(0.5).default(0.20),

  // JWT TTLs (seconds)
  JWT_ACCESS_TTL: z.coerce.number().default(900),     // 15 minutes
  JWT_REFRESH_TTL: z.coerce.number().default(2592000), // 30 days

  // Stripe checkout
  STRIPE_CHECKOUT_BASE_URL: z.string().default('https://checkout.dravio.com'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
