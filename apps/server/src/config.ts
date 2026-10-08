import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** `KEY=` in an env file means "not set". */
const emptyAsUnset = (value: unknown): unknown => (value === '' ? undefined : value);

/**
 * Printable ASCII without spaces. A stray CR, LF or NUL (say, from a pasted key) would make every provider call fail
 * with an error that quotes the Authorization header, key included; the message never repeats the value.
 */
const optionalSecret = z.preprocess(
  emptyAsUnset,
  z
    .string()
    .regex(/^[\x21-\x7E]+$/, 'must be printable ASCII without spaces or line breaks')
    .optional(),
);

const latencyRange = z
  .string()
  .regex(/^\d+-\d+$/, 'use "min-max", e.g. 1200-3500')
  .transform((value) => {
    const [a = 0, b = 0] = value.split('-').map(Number);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.preprocess(emptyAsUnset, z.string().optional()),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  CLOUDFLARE_ACCOUNT_ID: optionalSecret,
  CLOUDFLARE_API_TOKEN: optionalSecret,
  ARK_API_KEY: optionalSecret,
  MAX_CONCURRENT_JOBS: z.coerce.number().int().min(1).max(16).default(4),
  JOB_TIMEOUT_MS: z.coerce.number().int().min(1).default(120_000),
  DAILY_LIMIT_CLOUDFLARE: z.coerce.number().int().min(0).default(80),
  DAILY_LIMIT_BYTEPLUS: z.coerce.number().int().min(0).default(20),
  MOCK_LATENCY_MS: latencyRange.default({ min: 1200, max: 3500 }),
});

export type Config = {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: LogLevel;
  cloudflare: { accountId: string; apiToken: string } | null;
  byteplus: { apiKey: string } | null;
  maxConcurrentJobs: number;
  jobTimeoutMs: number;
  dailyLimits: { cloudflare: number; byteplus: number };
  mockLatencyMs: { min: number; max: number };
};

/** Validates the environment once at boot. Missing provider keys disable models; they never crash the server. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  const e = parsed.data;
  return {
    env: e.NODE_ENV,
    // Loopback keeps a development server off the network; a production container must listen on every interface.
    host: e.HOST ?? (e.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    cloudflare:
      e.CLOUDFLARE_ACCOUNT_ID && e.CLOUDFLARE_API_TOKEN
        ? { accountId: e.CLOUDFLARE_ACCOUNT_ID, apiToken: e.CLOUDFLARE_API_TOKEN }
        : null,
    byteplus: e.ARK_API_KEY ? { apiKey: e.ARK_API_KEY } : null,
    maxConcurrentJobs: e.MAX_CONCURRENT_JOBS,
    jobTimeoutMs: e.JOB_TIMEOUT_MS,
    dailyLimits: { cloudflare: e.DAILY_LIMIT_CLOUDFLARE, byteplus: e.DAILY_LIMIT_BYTEPLUS },
    mockLatencyMs: e.MOCK_LATENCY_MS,
  };
}
