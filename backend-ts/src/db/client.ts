import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export const db = drizzle(pool);

export type DB = typeof db;
