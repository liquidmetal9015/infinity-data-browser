import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GlobalFactionStore {
    globalFactionId: number | null;
    setGlobalFactionId: (id: number | null) => void;
}

export const useGlobalFactionStore = create<GlobalFactionStore>()(
    persist(
        (set) => ({
            globalFactionId: null,
            setGlobalFactionId: (id) => set({ globalFactionId: id }),
        }),
        {
            name: 'infinity-global-faction',
        }
    )
);
