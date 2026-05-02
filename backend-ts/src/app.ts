import { serveStatic } from '@hono/node-server/serve-static';
import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from './config.js';
import health from './routes/health.js';
import units from './routes/units.js';
import factionsRoute from './routes/factions.js';
import metadata from './routes/metadata.js';
import search from './routes/search.js';
import lists from './routes/lists.js';
import agent from './routes/agent.js';
import { GameDataLoader } from './agent/gameData/loader.js';

export const app = new Hono();

if (config.devAuth) {
    void (async () => {
        try {
            const { db } = await import('./db/client.js');
            const { users } = await import('./db/schema.js');
            await db
                .insert(users)
                .values({ id: 'dev-user', email: 'dev@local' })
                .onConflictDoNothing();
        } catch (e) {
            console.warn('Dev user provision failed:', (e as Error).message);
        }
    })();
}

app.use('*', logger());
app.use(
    '/api/*',
    cors({
        origin: config.corsOrigins,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
    }),
);

app.route('/api', health);
app.route('/api/units', units);
app.route('/api/factions', factionsRoute);
app.route('/api/metadata', metadata);
app.route('/api/search', search);
app.route('/api/lists', lists);
app.route('/api/agent', agent);

void GameDataLoader.getInstance().initialize(config.dataDir);

const SPA_ROOT = ['public', 'dist'].find(d =>
    fs.existsSync(path.join(process.cwd(), d, 'index.html')),
);
if (SPA_ROOT) {
    app.use('/*', serveStatic({ root: `./${SPA_ROOT}` }));
    app.get('*', serveStatic({ path: `./${SPA_ROOT}/index.html` }));
}
