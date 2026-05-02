import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, '../../drizzle');

const pool = new pg.Pool({ connectionString: databaseUrl });
const db = drizzle(pool);

console.log(`Applying drizzle migrations from ${migrationsFolder}…`);
await migrate(db, { migrationsFolder });
console.log('Migrations applied.');

await pool.end();
