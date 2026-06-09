import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://127.0.0.1:6379'),
  JWT_ACCESS_SECRET: z.string().min(16).default('change-me-access-secret-placeholder-32chars'),
  JWT_REFRESH_SECRET: z.string().min(16).default('change-me-refresh-secret-placeholder-32c'),
  ENCRYPTION_KEY: z.string().length(64).default('0000000000000000000000000000000000000000000000000000000000000000'),
  METAAPI_TOKEN: z.string().min(1).default('not_configured'),
  MPESA_CONSUMER_KEY: z.string().min(1).default('not_configured'),
  MPESA_CONSUMER_SECRET: z.string().min(1).default('not_configured'),
  MPESA_SHORTCODE: z.string().min(1).default('not_configured'),
  MPESA_LNM_PASSKEY: z.string().min(1).default('not_configured'),
  MPESA_CALLBACK_URL: z.string().url().default('https://placeholder.example.com/callback'),
  MPESA_ENV: z.enum(['sandbox', 'live']).default('live')
});

export const env = envSchema.parse(process.env);
