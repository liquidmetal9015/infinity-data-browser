import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, '../shared'),
        },
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
        env: {
            DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:password@127.0.0.1:5432/infinity',
            DEV_AUTH: 'true',
        },
    },
});
