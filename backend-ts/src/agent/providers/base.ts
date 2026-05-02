import type { ToolExecutor } from '../tools/executor.js';

export interface AgentResponse {
    text: string;
    toolCallsMade: string[];
    inputTokens: number;
    outputTokens: number;
}

export interface ToolDefinition {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
}

export interface ProviderMessage {
    role: 'user' | 'assistant';
    content: unknown;
}

export interface LLMProvider {
    chat(
        messages: ProviderMessage[],
        tools: ToolDefinition[],
        system: string,
        executor: ToolExecutor,
    ): Promise<AgentResponse>;
}
