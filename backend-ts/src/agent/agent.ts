import type { LLMProvider, AgentResponse, ProviderMessage } from './providers/base.js';
import { TOOL_DEFINITIONS } from './tools/definitions.js';
import { ToolExecutor } from './tools/executor.js';
import type { GameDataLoader } from './gameData/loader.js';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ListContextUnit {
    name: string;
    isc: string;
    loadout?: string;
    points?: number;
    swc?: number;
}

export interface ChatContext {
    faction_id?: number | null;
    faction_name?: string | null;
    list_points?: number | null;
    list_swc?: number | null;
    list_units?: ListContextUnit[];
}

const SYSTEM_PROMPT_BASE = `You are an expert assistant for the miniature wargame Infinity (N5 rules) by Corvus Belli.
You help players build army lists, understand game mechanics, analyze combat matchups, and optimize strategies.

Guidelines:
- Use tools to look up unit stats, fireteam rules, and game data before answering — do not rely on training data for specific numbers
- Keep answers concise and tactical — players want actionable advice
- When suggesting units, always mention their points cost and key capabilities
- For combat analysis, always note the key factors (range band, cover, ARM values)
- If you don't have enough information, ask a clarifying question
`;

export class InfinityAgent {
    constructor(
        private provider: LLMProvider,
        private loader: GameDataLoader,
    ) {}

    private buildSystemPrompt(context: ChatContext): string {
        const parts = [SYSTEM_PROMPT_BASE];

        if (context.faction_name) {
            parts.push(`\nThe player is currently building a ${context.faction_name} list.`);
        }
        if (context.list_points != null) {
            parts.push(`List total: ${context.list_points} pts.`);
        }
        if (context.list_units && context.list_units.length > 0) {
            const lines = context.list_units
                .map(u => `${u.name} (${u.points ?? 0}pts)`)
                .join(', ');
            parts.push(`Current units in list: ${lines}.`);
        }
        if (context.faction_id != null) {
            parts.push(
                `Faction ID for tool calls: ${context.faction_id}. ` +
                'Use this when faction_id is required by a tool.',
            );
        }
        return parts.join('\n');
    }

    private formatHistory(history: ChatMessage[]): ProviderMessage[] {
        return history.map(m => ({ role: m.role, content: m.content }));
    }

    async chat(
        message: string,
        history: ChatMessage[],
        context: ChatContext,
    ): Promise<AgentResponse> {
        const executor = new ToolExecutor(this.loader);
        const system = this.buildSystemPrompt(context);
        const messages: ProviderMessage[] = [
            ...this.formatHistory(history),
            { role: 'user', content: message },
        ];
        return this.provider.chat(messages, TOOL_DEFINITIONS, system, executor);
    }
}
