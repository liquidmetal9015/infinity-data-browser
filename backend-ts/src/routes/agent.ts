import { Hono } from 'hono';
import { z } from 'zod';
import { config } from '../config.js';
import { requireUser, type AuthVars } from '../auth/middleware.js';
import { InfinityAgent, type ChatContext, type ChatMessage } from '../agent/agent.js';
import { AnthropicProvider } from '../agent/providers/anthropic.js';
import { GeminiProvider } from '../agent/providers/gemini.js';
import { GameDataLoader } from '../agent/gameData/loader.js';
import type { LLMProvider } from '../agent/providers/base.js';
import { checkAndIncrementUsage, RateLimitError } from '../lib/usage.js';

const router = new Hono<{ Variables: AuthVars }>();

router.use('*', requireUser);

const ListContextUnitSchema = z.object({
    name: z.string(),
    isc: z.string(),
    loadout: z.string().optional(),
    points: z.number().optional(),
    swc: z.number().optional(),
});

const ChatContextSchema = z.object({
    faction_id: z.number().int().nullable().optional(),
    faction_name: z.string().nullable().optional(),
    list_points: z.number().nullable().optional(),
    list_swc: z.number().nullable().optional(),
    list_units: z.array(ListContextUnitSchema).default([]),
});

const ChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
});

const ChatRequestSchema = z.object({
    message: z.string().max(2000),
    history: z.array(ChatMessageSchema).max(20).default([]),
    context: ChatContextSchema.default({}),
});

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

class ProviderUnavailable extends Error {}

router.post('/chat', async c => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) return c.json({ detail: parsed.error.issues }, 422);

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

    try {
        const response = await agent.chat(
            parsed.data.message,
            parsed.data.history as ChatMessage[],
            parsed.data.context as ChatContext,
        );
        return c.json({
            reply: response.text,
            tools_used: response.toolCallsMade,
            input_tokens: response.inputTokens,
            output_tokens: response.outputTokens,
        });
    } catch (e) {
        console.error('Agent chat failed for user', user.id, e);
        return c.json({ detail: 'AI assistant encountered an error.' }, 500);
    }
});

export default router;
