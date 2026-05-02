import Anthropic from '@anthropic-ai/sdk';
import type {
    AgentResponse,
    LLMProvider,
    ProviderMessage,
    ToolDefinition,
} from './base.js';
import type { ToolExecutor } from '../tools/executor.js';

const MAX_TOOL_ROUNDS = 6;

export class AnthropicProvider implements LLMProvider {
    private client: Anthropic;
    private model: string;

    constructor(apiKey: string, model: string) {
        this.client = new Anthropic({ apiKey });
        this.model = model;
    }

    async chat(
        messages: ProviderMessage[],
        tools: ToolDefinition[],
        system: string,
        executor: ToolExecutor,
    ): Promise<AgentResponse> {
        const toolCallsMade: string[] = [];
        let totalInput = 0;
        let totalOutput = 0;

        const anthropicTools = tools.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: t.input_schema as Anthropic.Tool['input_schema'],
        }));

        let currentMessages: Anthropic.MessageParam[] = messages.map(m => ({
            role: m.role,
            content: m.content as Anthropic.MessageParam['content'],
        }));

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 2048,
                system: [
                    {
                        type: 'text',
                        text: system,
                        cache_control: { type: 'ephemeral' },
                    },
                ],
                tools: anthropicTools,
                messages: currentMessages,
            });

            totalInput += response.usage.input_tokens;
            totalOutput += response.usage.output_tokens;

            if (response.stop_reason !== 'tool_use') {
                let text = '';
                for (const block of response.content) {
                    if (block.type === 'text') text += block.text;
                }
                return { text, toolCallsMade, inputTokens: totalInput, outputTokens: totalOutput };
            }

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of response.content) {
                if (block.type !== 'tool_use') continue;
                toolCallsMade.push(block.name);
                const result = await executor.execute(
                    block.name,
                    block.input as Record<string, unknown>,
                );
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: result,
                });
            }

            currentMessages = [
                ...currentMessages,
                { role: 'assistant', content: response.content },
                { role: 'user', content: toolResults },
            ];
        }

        return {
            text: 'I reached the maximum number of steps. Please try a more focused question.',
            toolCallsMade,
            inputTokens: totalInput,
            outputTokens: totalOutput,
        };
    }
}
