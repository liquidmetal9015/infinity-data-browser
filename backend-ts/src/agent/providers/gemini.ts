import type { LLMProvider } from './base.js';

export class GeminiProvider implements LLMProvider {
    chat(): never {
        throw new Error('Gemini provider not implemented');
    }
}
