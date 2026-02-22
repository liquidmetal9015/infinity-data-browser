// Workspace Window Management Types

export type WidgetType =
    | 'LIST_BUILDER'
    | 'DICE_CALCULATOR'
    | 'CLASSIFIEDS'
    | 'FIRETEAMS'
    | 'RANGES'
    | 'COMPARE'
    | 'SEARCH'
    | 'REFERENCE'
    | 'UNIT_SEARCH';

export interface WindowPosition {
    x: number;
    y: number;
}

export interface WindowSize {
    width: number;
    height: number;
}

export interface WindowState {
    id: string;
    type: WidgetType;
    title: string;
    position: WindowPosition;
    size: WindowSize;
    zIndex: number;
    isMinimized: boolean;
    props?: Record<string, any>;
}

export interface WorkspaceState {
    windows: WindowState[];
    nextZIndex: number;
}

export type WorkspaceAction =
    | { type: 'OPEN_WINDOW'; widgetType: WidgetType; props?: Record<string, any> }
    | { type: 'CLOSE_WINDOW'; windowId: string }
    | { type: 'FOCUS_WINDOW'; windowId: string }
    | { type: 'MINIMIZE_WINDOW'; windowId: string }
    | { type: 'RESTORE_WINDOW'; windowId: string }
    | { type: 'MOVE_WINDOW'; windowId: string; position: WindowPosition }
    | { type: 'RESIZE_WINDOW'; windowId: string; size: WindowSize }
    | { type: 'RESTORE_STATE'; state: WorkspaceState };

// Default sizes for each widget type
export const DEFAULT_SIZES: Record<WidgetType, WindowSize> = {
    LIST_BUILDER: { width: 700, height: 750 },
    DICE_CALCULATOR: { width: 550, height: 700 },
    CLASSIFIEDS: { width: 900, height: 700 },
    FIRETEAMS: { width: 800, height: 600 },
    RANGES: { width: 900, height: 650 },
    COMPARE: { width: 800, height: 600 },
    SEARCH: { width: 600, height: 500 },
    REFERENCE: { width: 700, height: 600 },
    UNIT_SEARCH: { width: 500, height: 500 },
};

// Display labels for widget types
export const WIDGET_LABELS: Record<WidgetType, string> = {
    LIST_BUILDER: 'List Builder',
    DICE_CALCULATOR: 'Dice Calculator',
    CLASSIFIEDS: 'Classifieds',
    FIRETEAMS: 'Fireteams',
    RANGES: 'Weapons',
    COMPARE: 'Compare',
    SEARCH: 'Search',
    REFERENCE: 'Reference',
    UNIT_SEARCH: 'Units',
};

export const MIN_WINDOW_WIDTH = 300;
export const MIN_WINDOW_HEIGHT = 200;
