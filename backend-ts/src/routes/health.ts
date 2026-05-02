import { Hono } from 'hono';

const router = new Hono();

const APP_VERSION = '0.1.0';

router.get('/health', c => c.json({ status: 'ok', version: APP_VERSION }));

export default router;
