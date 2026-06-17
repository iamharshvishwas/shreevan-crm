import { z } from 'zod';

/** Environment schema — validated at startup so the app fails fast on misconfig. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  ENABLE_SIMULATION: z
    .preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean())
    .default(false),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  // Production guard: simulation must never be on in production.
  if (parsed.data.NODE_ENV === 'production' && parsed.data.ENABLE_SIMULATION) {
    throw new Error('ENABLE_SIMULATION must be false in production.');
  }
  return parsed.data;
}
