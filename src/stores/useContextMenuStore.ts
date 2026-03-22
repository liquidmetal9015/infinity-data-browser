import { create } from 'zustand';
import type { ReactNode } from 'react';

export interface ContextMenuItem {
    label?: string;
    action: () => void;
    icon?: ReactNode;
    divider?: boolean;
    destructive?: boolean;
}

interface ContextMenuStore {
    isOpen: boolean;
    position: { x: number; y: number };
    items: ContextMenuItem[];
    showMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
    hideMenu: () => void;
}

export const useContextMenuStore = create<ContextMenuStore>()((set) => ({
    isOpen: false,
    position: { x: 0, y: 0 },
    items: [],
    showMenu: (x, y, items) => set({ isOpen: true, position: { x, y }, items }),
    hideMenu: () => set({ isOpen: false }),
}));
