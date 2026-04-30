// Workspace Zustand Store - manages open windows, positions, z-index, persistence
import { create } from 'zustand';
import type {
    WidgetType,
    LayoutMode,
    WindowState,
    WorkspaceState,
    WorkspaceAction,
    WindowPosition,
    WindowSize,
    AnyWidgetProps,
} from '../types/workspace';
import { DEFAULT_SIZES, WIDGET_LABELS, MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT, getColumnPanels } from '../types/workspace';

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

function computeColumnWindowPositions(state: WorkspaceState): WindowState[] {
    if (typeof window === 'undefined') return state.windows;

    const WINDOW_GAP = 6;
    const DIVIDER = 5;
    const vw = window.innerWidth;
    const vh = window.innerHeight - 60;

    const panels = getColumnPanels(state.columnCount ?? 3);
    const widths = state.columnWidths ?? panels.map(() => 1);
    const total = widths.reduce((a, b) => a + b, 0);
    const totalColPx = vw - DIVIDER * (panels.length - 1);

    let x = 0;
    return panels.map((type, i) => {
        const colPx = Math.round(totalColPx * (widths[i] / total));
        const winState: WindowState = {
            id: state.windows.find(w => w.type === type)?.id ?? generateId(),
            type,
            title: WIDGET_LABELS[type],
            position: { x: x + WINDOW_GAP, y: WINDOW_GAP },
            size: {
                width: Math.max(MIN_WINDOW_WIDTH, colPx - WINDOW_GAP * 2),
                height: Math.max(MIN_WINDOW_HEIGHT, vh - WINDOW_GAP * 2),
            },
            zIndex: state.nextZIndex + i,
            isMinimized: false,
        };
        x += colPx + DIVIDER;
        return winState;
    });
}

function getInitialPlacement(windows: WindowState[], type: WidgetType): { position: WindowPosition, size: WindowSize } {
    const defaultSize = DEFAULT_SIZES[type];

    if (typeof window === 'undefined') {
        return { position: getCascadePosition(windows), size: { ...defaultSize } };
    }

    const maxWidth = Math.max(MIN_WINDOW_WIDTH, window.innerWidth - 40);
    const maxHeight = Math.max(MIN_WINDOW_HEIGHT, window.innerHeight - 100);

    const size = {
        width: Math.min(defaultSize.width, maxWidth),
        height: Math.min(defaultSize.height, maxHeight)
    };

    if (windows.length === 0) {
        return {
            position: {
                x: Math.max(0, (window.innerWidth - size.width) / 2),
                y: Math.max(0, (window.innerHeight - size.height) / 2 - 30)
            },
            size
        };
    }

    return { position: getCascadePosition(windows), size };
}

// ============================================================================
// Reducer (pure, testable)
// ============================================================================

export const initialState: WorkspaceState = {
    windows: [],
    nextZIndex: 1,
    layoutMode: 'columns',
    maximizedWindowId: null,
    columnWidths: [1, 1, 1],
    columnCount: 3,
    activeColumnIndex: 0,
};

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
    switch (action.type) {
        case 'OPEN_WINDOW': {
            const existingWindow = state.windows.find(w => w.type === action.widgetType);
            if (existingWindow) {
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
            return { ...state, windows: newWindows, maximizedWindowId: nextMaximized };
        }

        case 'FOCUS_WINDOW': {
            const targetWindow = state.windows.find(w => w.id === action.windowId);
            if (!targetWindow) return state;
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

        case 'SET_COLUMN_WIDTHS': {
            return { ...state, columnWidths: action.widths };
        }

        case 'SET_COLUMN_COUNT': {
            const newWidths = action.count === 2 ? [1, 1] : [1, 1, 1];
            const maxIndex = action.count - 1;
            return {
                ...state,
                columnCount: action.count,
                columnWidths: newWidths,
                activeColumnIndex: Math.min(state.activeColumnIndex, maxIndex),
            };
        }

        case 'SET_ACTIVE_COLUMN': {
            const maxIndex = (state.columnCount ?? 3) - 1;
            return { ...state, activeColumnIndex: Math.max(0, Math.min(action.index, maxIndex)) };
        }

        case 'SET_LAYOUT_MODE': {
            if (action.mode === 'multi-window' && state.layoutMode === 'columns') {
                const columnWindows = computeColumnWindowPositions(state);
                const activePanels = new Set(getColumnPanels(state.columnCount ?? 3));
                const otherWindows = state.windows.filter(w => !activePanels.has(w.type));
                return {
                    ...state,
                    layoutMode: 'multi-window',
                    maximizedWindowId: null,
                    windows: [...otherWindows, ...columnWindows],
                    nextZIndex: state.nextZIndex + columnWindows.length,
                };
            }
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
                    return { ...state, layoutMode: 'multi-window', maximizedWindowId: null };
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
                    const availableHeight = window.innerHeight - 60;
                    return {
                        ...w,
                        size: { width: halfWidth, height: availableHeight },
                        position: { x: action.position === 'left' ? 0 : halfWidth, y: 0 },
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
        if (parsed && Array.isArray(parsed.windows) && typeof parsed.nextZIndex === 'number') {
            const columnCount: 2 | 3 = parsed.columnCount === 2 ? 2 : 3;
            return {
                ...parsed,
                layoutMode: parsed.layoutMode || 'columns',
                maximizedWindowId: parsed.maximizedWindowId ?? null,
                columnWidths: parsed.columnWidths ?? (columnCount === 2 ? [1, 1] : [1, 1, 1]),
                columnCount,
                activeColumnIndex: parsed.activeColumnIndex ?? 0,
            } as WorkspaceState;
        }
    } catch {
        // Silently fail
    }
    return null;
}

// ============================================================================
// Store
// ============================================================================

interface WorkspaceStore extends WorkspaceState {
    openWindow: (widgetType: WidgetType, props?: AnyWidgetProps) => void;
    closeWindow: (windowId: string) => void;
    focusWindow: (windowId: string) => void;
    minimizeWindow: (windowId: string) => void;
    restoreWindow: (windowId: string) => void;
    moveWindow: (windowId: string, position: WindowPosition) => void;
    resizeWindow: (windowId: string, size: WindowSize, position?: WindowPosition) => void;
    setLayoutMode: (mode: LayoutMode) => void;
    toggleMaximize: (windowId: string) => void;
    snapWindow: (windowId: string, position: 'left' | 'right') => void;
    setColumnWidths: (widths: number[]) => void;
    setColumnCount: (count: 2 | 3) => void;
    setActiveColumn: (index: number) => void;
}

function applyAction(state: WorkspaceStore, action: WorkspaceAction): WorkspaceState {
    return workspaceReducer(
        {
            windows: state.windows,
            nextZIndex: state.nextZIndex,
            layoutMode: state.layoutMode,
            maximizedWindowId: state.maximizedWindowId,
            columnWidths: state.columnWidths,
            columnCount: state.columnCount,
            activeColumnIndex: state.activeColumnIndex,
        },
        action
    );
}

export const useWorkspaceStore = create<WorkspaceStore>()((set) => ({
    // Initial state from localStorage or defaults
    ...(loadFromStorage() || initialState),

    // Actions
    openWindow: (widgetType, props?) => set(s => applyAction(s, { type: 'OPEN_WINDOW', widgetType, props })),
    closeWindow: (windowId) => set(s => applyAction(s, { type: 'CLOSE_WINDOW', windowId })),
    focusWindow: (windowId) => set(s => applyAction(s, { type: 'FOCUS_WINDOW', windowId })),
    minimizeWindow: (windowId) => set(s => applyAction(s, { type: 'MINIMIZE_WINDOW', windowId })),
    restoreWindow: (windowId) => set(s => applyAction(s, { type: 'RESTORE_WINDOW', windowId })),
    moveWindow: (windowId, position) => set(s => applyAction(s, { type: 'MOVE_WINDOW', windowId, position })),
    resizeWindow: (windowId, size, position?) => set(s => applyAction(s, { type: 'RESIZE_WINDOW', windowId, size, position })),
    setLayoutMode: (mode) => set(s => applyAction(s, { type: 'SET_LAYOUT_MODE', mode })),
    toggleMaximize: (windowId) => set(s => applyAction(s, { type: 'TOGGLE_MAXIMIZE', windowId })),
    snapWindow: (windowId, position) => set(s => applyAction(s, { type: 'SNAP_WINDOW', windowId, position })),
    setColumnWidths: (widths) => set(s => applyAction(s, { type: 'SET_COLUMN_WIDTHS', widths })),
    setColumnCount: (count) => set(s => applyAction(s, { type: 'SET_COLUMN_COUNT', count })),
    setActiveColumn: (index) => set(s => applyAction(s, { type: 'SET_ACTIVE_COLUMN', index })),
}));

// Persist to localStorage on every state change
useWorkspaceStore.subscribe((state) => {
    saveToStorage({
        windows: state.windows,
        nextZIndex: state.nextZIndex,
        layoutMode: state.layoutMode,
        maximizedWindowId: state.maximizedWindowId,
        columnWidths: state.columnWidths,
        columnCount: state.columnCount,
        activeColumnIndex: state.activeColumnIndex,
    });
});
