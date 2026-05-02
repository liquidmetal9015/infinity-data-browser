import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { config } from '../config.js';
import { requireUser, type AuthVars } from '../auth/middleware.js';
import { InfinityAgent, type ChatContext, type ChatMessage } from '../agent/agent.js';
import { AnthropicProvider } from '../agent/providers/anthropic.js';
import { GeminiProvider } from '../agent/providers/gemini.js';
import { GameDataLoader } from '../agent/gameData/loader.js';
import type { LLMProvider } from '../agent/providers/base.js';
import { checkAndIncrementUsage, RateLimitError } from '../lib/usage.js';

const router = new OpenAPIHono<{ Variables: AuthVars }>();

router.use('*', requireUser);

const ListContextUnitSchema = z.object({
    name: z.string(),
    isc: z.string(),
    loadout: z.string().optional(),
    points: z.number().optional(),
    swc: z.number().optional(),
}).openapi('ListContextUnit');

const ChatContextSchema = z.object({
    faction_id: z.number().int().nullable().optional(),
    faction_name: z.string().nullable().optional(),
    list_points: z.number().nullable().optional(),
    list_swc: z.number().nullable().optional(),
    list_units: z.array(ListContextUnitSchema).optional(),
}).openapi('ChatContext');

const ChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
}).openapi('ChatMessage');

const ChatRequestSchema = z.object({
    message: z.string().max(2000),
    history: z.array(ChatMessageSchema).max(20).optional(),
    context: ChatContextSchema.optional(),
}).openapi('ChatRequest');

const ChatResponseSchema = z.object({
    reply: z.string(),
    tools_used: z.array(z.string()),
    input_tokens: z.number().int(),
    output_tokens: z.number().int(),
}).openapi('ChatResponse');

const ErrorSchema = z.object({
    detail: z.union([z.string(), z.array(z.unknown())]),
}).openapi('Error');

class ProviderUnavailable extends Error {}

function getProvider(): LLMProvider {
    if (config.llmProvider === 'anthropic') {
        if (!config.anthropicApiKey) {
            throw new ProviderUnavailable('AI features are not configured (missing API key).');
        }
        return new AnthropicProvider(config.anthropicApiKey, config.llmModel);
    }
    if (config.llmProvider === 'gemini') return new GeminiProvider();
    throw new ProviderUnavailable(`Unknown LLM provider: ${config.llmProvider}`);
}

router.openapi(
    createRoute({
        method: 'post',
        path: '/chat',
        tags: ['agent'],
        summary: 'Chat with the Infinity AI agent',
        request: {
            body: { content: { 'application/json': { schema: ChatRequestSchema } }, required: true },
        },
        responses: {
            200: { content: { 'application/json': { schema: ChatResponseSchema } }, description: 'Reply' },
            401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' },
            422: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Validation error' },
            429: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Rate limited' },
            500: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Server error' },
            503: { content: { 'application/json': { schema: ErrorSchema } }, description: 'AI provider unavailable' },
        },
    }),
    async c => {
        const user = c.get('user');
        const data = c.req.valid('json');

        try {
            await checkAndIncrementUsage(user.id, config.aiMonthlyLimit);
        } catch (e) {
            if (e instanceof RateLimitError) return c.json({ detail: e.message }, 429);
            throw e;
        }

        let provider: LLMProvider;
        try {
            provider = getProvider();
        } catch (e) {
            if (e instanceof ProviderUnavailable) return c.json({ detail: e.message }, 503);
            throw e;
        }

        const loader = GameDataLoader.getInstance();
        const agent = new InfinityAgent(provider, loader);

        const history = (data.history ?? []) as ChatMessage[];
        const context = (data.context ?? {}) as ChatContext;

        try {
            const response = await agent.chat(data.message, history, context);
            return c.json({
                reply: response.text,
                tools_used: response.toolCallsMade,
                input_tokens: response.inputTokens,
                output_tokens: response.outputTokens,
            }, 200);
        } catch (e) {
            console.error('Agent chat failed for user', user.id, e);
            return c.json({ detail: 'AI assistant encountered an error.' }, 500);
        }
    },
);

export default router;
