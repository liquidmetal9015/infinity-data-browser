import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppMode = 'builder' | 'explorer';

interface AppModeStore {
    appMode: AppMode;
    lastBuilderPath: string;
    lastExplorerPath: string;
    setAppMode: (mode: AppMode) => void;
    setLastPath: (mode: AppMode, path: string) => void;
}

export const useAppModeStore = create<AppModeStore>()(
    persist(
        (set) => ({
            appMode: 'builder',
            lastBuilderPath: '/',
            lastExplorerPath: '/search',
            setAppMode: (mode) => set({ appMode: mode }),
            setLastPath: (mode, path) =>
                mode === 'builder'
                    ? set({ lastBuilderPath: path })
                    : set({ lastExplorerPath: path }),
        }),
        {
            name: 'infinity-app-mode',
        }
    )
);
