import { z } from 'zod';

const ConfigSchema = z.object({
    DATABASE_URL: z.string().min(1),
    CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:8080'),
    DATA_DIR: z.string().default('../data'),
    DEV_AUTH: z
        .union([z.string(), z.boolean()])
        .default(false)
        .transform(v => (typeof v === 'boolean' ? v : v === 'true' || v === '1')),
    ANTHROPIC_API_KEY: z.string().default(''),
    LLM_PROVIDER: z.enum(['anthropic', 'gemini']).default('anthropic'),
    LLM_MODEL: z.string().default('claude-haiku-4-5-20251001'),
    AI_MONTHLY_LIMIT: z.coerce.number().int().positive().default(100),
    PORT: z.coerce.number().int().positive().default(8080),
    FIREBASE_ADMIN_CREDENTIALS: z.string().default(''),
});

const parsed = ConfigSchema.parse(process.env);

export const config = {
    databaseUrl: parsed.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://'),
    corsOrigins: parsed.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean),
    dataDir: parsed.DATA_DIR,
    devAuth: parsed.DEV_AUTH,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
    llmProvider: parsed.LLM_PROVIDER,
    llmModel: parsed.LLM_MODEL,
    aiMonthlyLimit: parsed.AI_MONTHLY_LIMIT,
    port: parsed.PORT,
    firebaseAdminCredentials: parsed.FIREBASE_ADMIN_CREDENTIALS,
} as const;

if (process.env.NODE_ENV === 'production' && config.devAuth) {
    throw new Error(
        'DEV_AUTH=true in production: refusing to start. ' +
        'The dev token bypass would let any caller impersonate dev-user. ' +
        'Unset DEV_AUTH (or set to false) and redeploy.',
    );
}

export type Config = typeof config;
