import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z.string().length(64), // Hex format (32 bytes string)
  METAAPI_TOKEN: z.string().min(1),
  MPESA_CONSUMER_KEY: z.string().min(1),
  MPESA_CONSUMER_SECRET: z.string().min(1),
  MPESA_SHORTCODE: z.string().min(1),
  MPESA_LNM_PASSKEY: z.string().min(1),
  MPESA_CALLBACK_URL: z.string().url(),
  MPESA_ENV: z.enum(['sandbox', 'live']).default('sandbox')
});

export const env = envSchema.parse(process.env);
