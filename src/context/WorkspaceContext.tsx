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
import { DEFAULT_SIZES, WIDGET_LABELS, MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT } from '../types/workspace';

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

function getInitialPlacement(windows: WindowState[], type: WidgetType): { position: WindowPosition, size: WindowSize } {
    const defaultSize = DEFAULT_SIZES[type];

    if (typeof window === 'undefined') {
        return { position: getCascadePosition(windows), size: { ...defaultSize } };
    }

    // Bounds check to ensure it fits on screen (leave room for launcher/padding)
    const maxWidth = Math.max(MIN_WINDOW_WIDTH, window.innerWidth - 40);
    const maxHeight = Math.max(MIN_WINDOW_HEIGHT, window.innerHeight - 100);

    const size = {
        width: Math.min(defaultSize.width, maxWidth),
        height: Math.min(defaultSize.height, maxHeight)
    };

    if (windows.length === 0) {
        // First window: Center it
        return {
            position: {
                x: Math.max(0, (window.innerWidth - size.width) / 2),
                y: Math.max(0, (window.innerHeight - size.height) / 2 - 30) // slightly higher than true center
            },
            size
        };
    }

    // Fallback to cascade
    return {
        position: getCascadePosition(windows),
        size
    };
}

// ============================================================================
// Reducer (pure, testable)
// ============================================================================

export const initialState: WorkspaceState = {
    windows: [],
    nextZIndex: 1,
    layoutMode: typeof window !== 'undefined' && window.innerWidth < 768 ? 'tabbed' : 'multi-window',
    maximizedWindowId: null,
};

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
    switch (action.type) {
        case 'OPEN_WINDOW': {
            // Check if a window of this type already exists. If so, just focus and restore it.
            const existingWindow = state.windows.find(w => w.type === action.widgetType);
            if (existingWindow) {
                // If it's already focused and not minimized (and properly maximized if in tabbed mode), do nothing
                if (
                    existingWindow.zIndex === state.nextZIndex - 1 &&
                    !existingWindow.isMinimized &&
                    !(state.layoutMode === 'tabbed' && state.maximizedWindowId !== existingWindow.id)
                ) {
                    return state;
                }

                return {
                    ...state,
                    windows: state.windows.map(w =>
                        w.id === existingWindow.id
                            ? { ...w, zIndex: state.nextZIndex, isMinimized: false, props: action.props || w.props }
                            : w
                    ),
                    nextZIndex: state.nextZIndex + 1,
                    maximizedWindowId: state.layoutMode === 'tabbed' ? existingWindow.id : state.maximizedWindowId,
                };
            }

            // Otherwise, open a new instance (there shouldn't be multiple instances anymore)
            const placement = getInitialPlacement(state.windows, action.widgetType);
            const newWindow: WindowState = {
                id: generateId(),
                type: action.widgetType,
                title: WIDGET_LABELS[action.widgetType],
                position: placement.position,
                size: placement.size,
                zIndex: state.nextZIndex,
                isMinimized: false,
                props: action.props,
            };
            return {
                ...state,
                windows: [...state.windows, newWindow],
                nextZIndex: state.nextZIndex + 1,
                maximizedWindowId: state.layoutMode === 'tabbed' ? newWindow.id : state.maximizedWindowId,
            };
        }

        case 'CLOSE_WINDOW': {
            const newWindows = state.windows.filter(w => w.id !== action.windowId);
            let nextMaximized = state.maximizedWindowId;
            if (state.maximizedWindowId === action.windowId) {
                if (newWindows.length > 0) {
                    const topWindow = [...newWindows].sort((a, b) => b.zIndex - a.zIndex)[0];
                    nextMaximized = topWindow.id;
                } else {
                    nextMaximized = null;
                }
            }
            return {
                ...state,
                windows: newWindows,
                maximizedWindowId: nextMaximized,
            };
        }

        case 'FOCUS_WINDOW': {
            const targetWindow = state.windows.find(w => w.id === action.windowId);
            if (!targetWindow) return state;
            // Skip if already on top and not minimized, unless in tabbed mode and it's not maximized
            if (targetWindow.zIndex === state.nextZIndex - 1 && !targetWindow.isMinimized && !(state.layoutMode === 'tabbed' && state.maximizedWindowId !== action.windowId)) {
                return state;
            }
            return {
                ...state,
                windows: state.windows.map(w =>
                    w.id === action.windowId
                        ? { ...w, zIndex: state.nextZIndex, isMinimized: false }
                        : w
                ),
                nextZIndex: state.nextZIndex + 1,
                maximizedWindowId: state.layoutMode === 'tabbed' ? action.windowId : state.maximizedWindowId,
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
                ...state,
                windows: state.windows.map(w =>
                    w.id === action.windowId
                        ? { ...w, isMinimized: false, zIndex: state.nextZIndex }
                        : w
                ),
                nextZIndex: state.nextZIndex + 1,
                maximizedWindowId: state.layoutMode === 'tabbed' ? action.windowId : state.maximizedWindowId,
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
                    w.id === action.windowId ? { ...w, size: action.size, position: action.position ?? w.position } : w
                ),
            };
        }

        case 'RESTORE_STATE': {
            return action.state;
        }

        case 'SET_LAYOUT_MODE': {
            return {
                ...state,
                layoutMode: action.mode,
                maximizedWindowId: action.mode === 'multi-window' ? null : state.maximizedWindowId,
            };
        }

        case 'TOGGLE_MAXIMIZE': {
            if (state.layoutMode === 'multi-window') {
                return {
                    ...state,
                    layoutMode: 'tabbed',
                    maximizedWindowId: action.windowId,
                    windows: state.windows.map(w =>
                        w.id === action.windowId
                            ? { ...w, zIndex: state.nextZIndex, isMinimized: false }
                            : w
                    ),
                    nextZIndex: state.nextZIndex + 1,
                };
            } else {
                if (state.maximizedWindowId === action.windowId) {
                    return {
                        ...state,
                        layoutMode: 'multi-window',
                        maximizedWindowId: null,
                    };
                } else {
                    return {
                        ...state,
                        maximizedWindowId: action.windowId,
                        windows: state.windows.map(w =>
                            w.id === action.windowId
                                ? { ...w, zIndex: state.nextZIndex, isMinimized: false }
                                : w
                        ),
                        nextZIndex: state.nextZIndex + 1,
                    };
                }
            }
        }

        case 'SNAP_WINDOW': {
            if (typeof window === 'undefined') return state;

            return {
                ...state,
                windows: state.windows.map(w => {
                    if (w.id !== action.windowId) return w;

                    const halfWidth = window.innerWidth / 2;
                    const availableHeight = window.innerHeight - 60; // Leave room for launcher

                    return {
                        ...w,
                        size: {
                            width: halfWidth,
                            height: availableHeight
                        },
                        position: {
                            x: action.position === 'left' ? 0 : halfWidth,
                            y: 0
                        },
                        isMinimized: false,
                        zIndex: state.nextZIndex
                    };
                }),
                nextZIndex: state.nextZIndex + 1,
                maximizedWindowId: state.layoutMode === 'tabbed' ? action.windowId : state.maximizedWindowId,
            };
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
            const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
            return {
                ...parsed,
                layoutMode: parsed.layoutMode || (isMobile ? 'tabbed' : 'multi-window'),
                maximizedWindowId: parsed.maximizedWindowId ?? null,
            } as WorkspaceState;
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
    resizeWindow: (windowId: string, size: WindowSize, position?: WindowPosition) => void;
    setLayoutMode: (mode: 'multi-window' | 'tabbed') => void;
    toggleMaximize: (windowId: string) => void;
    snapWindow: (windowId: string, position: 'left' | 'right') => void;
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

    const resizeWindow = useCallback((windowId: string, size: WindowSize, position?: WindowPosition) => {
        dispatch({ type: 'RESIZE_WINDOW', windowId, size, position });
    }, []);

    const setLayoutMode = useCallback((mode: 'multi-window' | 'tabbed') => {
        dispatch({ type: 'SET_LAYOUT_MODE', mode });
    }, []);

    const toggleMaximize = useCallback((windowId: string) => {
        dispatch({ type: 'TOGGLE_MAXIMIZE', windowId });
    }, []);

    const snapWindow = useCallback((windowId: string, position: 'left' | 'right') => {
        dispatch({ type: 'SNAP_WINDOW', windowId, position });
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
            setLayoutMode,
            toggleMaximize,
            snapWindow,
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
