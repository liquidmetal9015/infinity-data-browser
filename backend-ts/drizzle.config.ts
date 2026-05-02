import { defineConfig } from 'drizzle-kit';

const databaseUrl = (process.env.DATABASE_URL ?? '')
    .replace('postgresql+asyncpg://', 'postgresql://');

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/db/schema.ts',
    out: './drizzle',
    dbCredentials: { url: databaseUrl },
    introspect: { casing: 'preserve' },
});
