import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const router = new OpenAPIHono();

const HealthSchema = z.object({
    status: z.literal('ok'),
    version: z.string(),
}).openapi('HealthResponse');

router.openapi(
    createRoute({
        method: 'get',
        path: '/health',
        tags: ['health'],
        summary: 'Liveness check',
        responses: {
            200: {
                content: { 'application/json': { schema: HealthSchema } },
                description: 'Server is running',
            },
        },
    }),
    c => c.json({ status: 'ok' as const, version: '0.1.0' }),
);

export default router;
