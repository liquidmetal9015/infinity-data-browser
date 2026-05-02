import fs from 'node:fs/promises';
import path from 'node:path';
// Hono mounts /api/lists & /api/agent, both of which require a configured
// DATABASE_URL at import time (auth middleware reads from it). We don't need a
// live DB to export the OpenAPI spec — set a sentinel before importing.
process.env.DATABASE_URL ??= 'postgresql://noop:noop@127.0.0.1:5432/noop';

const { app } = await import('../src/app.js');

const doc = app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: { title: 'Infinity Data API', version: '0.1.0' },
});

const outPath = path.resolve(process.cwd(), '../openapi.json');
await fs.writeFile(outPath, JSON.stringify(doc, null, 2) + '\n', 'utf-8');
console.log(`Wrote OpenAPI spec → ${outPath}`);
process.exit(0);
