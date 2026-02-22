// Workspace Context - manages open windows, positions, z-index, persistence
import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from 'react';
import type {
    WidgetType,
    WindowState,
    WorkspaceState,
    WorkspaceAction,
    WindowPosition,
    WindowSize,
} from '../types/workspace';
import { DEFAULT_SIZES, WIDGET_LABELS } from '../types/workspace';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'infinity-workspace-state';
const CASCADE_OFFSET = 30;

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
    return `win_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getCascadePosition(existingWindows: WindowState[]): WindowPosition {
    const baseX = 50;
    const baseY = 50;
    const offset = existingWindows.length * CASCADE_OFFSET;
    return {
        x: baseX + (offset % 300),
        y: baseY + (offset % 200),
    };
}

// ============================================================================
// Reducer (pure, testable)
// ============================================================================

export const initialState: WorkspaceState = {
    windows: [],
    nextZIndex: 1,
};

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
    switch (action.type) {
        case 'OPEN_WINDOW': {
            const newWindow: WindowState = {
                id: generateId(),
                type: action.widgetType,
                title: WIDGET_LABELS[action.widgetType],
                position: getCascadePosition(state.windows),
                size: { ...DEFAULT_SIZES[action.widgetType] },
                zIndex: state.nextZIndex,
                isMinimized: false,
                props: action.props,
            };
            return {
                windows: [...state.windows, newWindow],
                nextZIndex: state.nextZIndex + 1,
            };
        }

        case 'CLOSE_WINDOW': {
            return {
                ...state,
                windows: state.windows.filter(w => w.id !== action.windowId),
            };
        }

        case 'FOCUS_WINDOW': {
            const targetWindow = state.windows.find(w => w.id === action.windowId);
            if (!targetWindow) return state;
            // Skip if already on top and not minimized
            if (targetWindow.zIndex === state.nextZIndex - 1 && !targetWindow.isMinimized) {
                return state;
            }
            return {
                windows: state.windows.map(w =>
                    w.id === action.windowId
                        ? { ...w, zIndex: state.nextZIndex, isMinimized: false }
                        : w
                ),
                nextZIndex: state.nextZIndex + 1,
            };
        }

        case 'MINIMIZE_WINDOW': {
            return {
                ...state,
                windows: state.windows.map(w =>
                    w.id === action.windowId ? { ...w, isMinimized: true } : w
                ),
            };
        }

        case 'RESTORE_WINDOW': {
            return {
                windows: state.windows.map(w =>
                    w.id === action.windowId
                        ? { ...w, isMinimized: false, zIndex: state.nextZIndex }
                        : w
                ),
                nextZIndex: state.nextZIndex + 1,
            };
        }

        case 'MOVE_WINDOW': {
            return {
                ...state,
                windows: state.windows.map(w =>
                    w.id === action.windowId ? { ...w, position: action.position } : w
                ),
            };
        }

        case 'RESIZE_WINDOW': {
            return {
                ...state,
                windows: state.windows.map(w =>
                    w.id === action.windowId ? { ...w, size: action.size } : w
                ),
            };
        }

        case 'RESTORE_STATE': {
            return action.state;
        }

        default:
            return state;
    }
}

// ============================================================================
// localStorage Persistence
// ============================================================================

function saveToStorage(state: WorkspaceState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Silently fail (quota exceeded, etc.)
    }
}

function loadFromStorage(): WorkspaceState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Basic shape validation
        if (parsed && Array.isArray(parsed.windows) && typeof parsed.nextZIndex === 'number') {
            return parsed as WorkspaceState;
        }
    } catch {
        // Silently fail
    }
    return null;
}

// ============================================================================
// Context
// ============================================================================

interface WorkspaceContextValue {
    state: WorkspaceState;
    dispatch: React.Dispatch<WorkspaceAction>;
    openWindow: (widgetType: WidgetType, props?: Record<string, any>) => void;
    closeWindow: (windowId: string) => void;
    focusWindow: (windowId: string) => void;
    minimizeWindow: (windowId: string) => void;
    restoreWindow: (windowId: string) => void;
    moveWindow: (windowId: string, position: WindowPosition) => void;
    resizeWindow: (windowId: string, size: WindowSize) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(workspaceReducer, initialState, () => {
        return loadFromStorage() || initialState;
    });

    // Persist to localStorage on every change
    useEffect(() => {
        saveToStorage(state);
    }, [state]);

    const openWindow = useCallback((widgetType: WidgetType, props?: Record<string, any>) => {
        dispatch({ type: 'OPEN_WINDOW', widgetType, props });
    }, []);

    const closeWindow = useCallback((windowId: string) => {
        dispatch({ type: 'CLOSE_WINDOW', windowId });
    }, []);

    const focusWindow = useCallback((windowId: string) => {
        dispatch({ type: 'FOCUS_WINDOW', windowId });
    }, []);

    const minimizeWindow = useCallback((windowId: string) => {
        dispatch({ type: 'MINIMIZE_WINDOW', windowId });
    }, []);

    const restoreWindow = useCallback((windowId: string) => {
        dispatch({ type: 'RESTORE_WINDOW', windowId });
    }, []);

    const moveWindow = useCallback((windowId: string, position: WindowPosition) => {
        dispatch({ type: 'MOVE_WINDOW', windowId, position });
    }, []);

    const resizeWindow = useCallback((windowId: string, size: WindowSize) => {
        dispatch({ type: 'RESIZE_WINDOW', windowId, size });
    }, []);

    return (
        <WorkspaceContext.Provider value={{
            state,
            dispatch,
            openWindow,
            closeWindow,
            focusWindow,
            minimizeWindow,
            restoreWindow,
            moveWindow,
            resizeWindow,
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
}

// ============================================================================
// Hook
// ============================================================================

export function useWorkspace(): WorkspaceContextValue {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
}
