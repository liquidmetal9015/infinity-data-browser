import { create } from 'zustand';
import { STATIC_MODE } from '../services/listService';
import { getAuthHeaders } from '../utils/authHeaders';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    toolsUsed?: string[];
}

export interface ChatContext {
    faction_id?: number;
    faction_name?: string;
    list_points?: number;
    list_swc?: number;
    list_units?: { name: string; isc: string; loadout: string; points: number; swc: number }[];
}

interface AIPanelStore {
    isOpen: boolean;
    messages: ChatMessage[];
    isLoading: boolean;
    error: string | null;
    togglePanel: () => void;
    openPanel: () => void;
    sendMessage: (message: string, context: ChatContext) => Promise<void>;
    clearHistory: () => void;
}

const BASE_URL = import.meta.env.VITE_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');

function makeId(): string {
    return Math.random().toString(36).slice(2, 10);
}

export const useAIPanelStore = create<AIPanelStore>()((set, get) => ({
    isOpen: false,
    messages: [],
    isLoading: false,
    error: null,

    togglePanel: () => set(s => ({ isOpen: !s.isOpen })),
    openPanel: () => set({ isOpen: true }),

    clearHistory: () => set({ messages: [], error: null }),

    sendMessage: async (message: string, context: ChatContext) => {
        if (STATIC_MODE) {
            set({ error: 'AI features require a backend connection and are not available in offline mode.' });
            return;
        }

        const userMsg: ChatMessage = { id: makeId(), role: 'user', content: message };
        set(s => ({ messages: [...s.messages, userMsg], isLoading: true, error: null }));

        const { messages } = get();
        const history = messages
            .filter(m => m.id !== userMsg.id)
            .map(m => ({ role: m.role, content: m.content }));

        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${BASE_URL}/api/agent/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify({ message, history, context }),
            });

            if (res.status === 429) {
                const data = await res.json().catch(() => ({}));
                set(s => ({
                    messages: s.messages.filter(m => m.id !== userMsg.id),
                    isLoading: false,
                    error: data.detail ?? 'Monthly AI message limit reached.',
                }));
                return;
            }

            if (!res.ok) {
                throw new Error(`Request failed: ${res.status}`);
            }

            const data = await res.json();
            const assistantMsg: ChatMessage = {
                id: makeId(),
                role: 'assistant',
                content: data.reply,
                toolsUsed: data.tools_used,
            };
            set(s => ({ messages: [...s.messages, assistantMsg], isLoading: false }));
        } catch (e) {
            set(s => ({
                messages: s.messages.filter(m => m.id !== userMsg.id),
                isLoading: false,
                error: e instanceof Error ? e.message : 'Something went wrong.',
            }));
        }
    },
}));
