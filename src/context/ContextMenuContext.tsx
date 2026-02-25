import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface ContextMenuItem {
    label?: string;
    action: () => void;
    icon?: ReactNode;
    divider?: boolean;
    destructive?: boolean;
}

interface ContextMenuState {
    isOpen: boolean;
    position: { x: number; y: number };
    items: ContextMenuItem[];
}

interface ContextMenuContextType extends ContextMenuState {
    showMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
    hideMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined);

export const ContextMenuProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<ContextMenuState>({
        isOpen: false,
        position: { x: 0, y: 0 },
        items: [],
    });

    const showMenu = useCallback((x: number, y: number, items: ContextMenuItem[]) => {
        setState({
            isOpen: true,
            position: { x, y },
            items,
        });
    }, []);

    const hideMenu = useCallback(() => {
        setState((prev) => ({ ...prev, isOpen: false }));
    }, []);

    return (
        <ContextMenuContext.Provider value={{ ...state, showMenu, hideMenu }}>
            {children}
        </ContextMenuContext.Provider>
    );
};

export const useContextMenu = (): ContextMenuContextType => {
    const context = useContext(ContextMenuContext);
    if (!context) {
        throw new Error('useContextMenu must be used within a ContextMenuProvider');
    }
    return context;
};
