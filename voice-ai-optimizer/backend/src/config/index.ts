import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  OPENROUTER_API_KEY: z.string().min(1, 'OpenRouter API key is required'),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  MONGODB_URI: z.string().min(1, 'MongoDB URI is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  HIGHLEVEL_API_KEY: z.string().optional(),
  HIGHLEVEL_API_BASE_URL: z.string().url().default('https://rest.gohighlevel.com/v1'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const config = parsed.data;
