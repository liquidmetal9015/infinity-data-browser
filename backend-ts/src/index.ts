import { serve } from '@hono/node-server';
import { config } from './config.js';
import { pool } from './db/client.js';
import { app } from './app.js';

const shutdown = async () => {
    await pool.end().catch(() => undefined);
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

serve({ fetch: app.fetch, port: config.port }, info => {
    console.log(`backend-ts listening on :${info.port}`);
});

export { app };
