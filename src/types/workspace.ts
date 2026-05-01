// Workspace Window Management Types

export type WidgetType =
    | 'DICE_CALCULATOR'
    | 'DICE_ANALYTICS'
    | 'CLASSIFIEDS'
    | 'FIRETEAMS'
    | 'RANGES'
    | 'COMPARE'
    | 'SEARCH'
    | 'REFERENCE'
    | 'UNIT_ROSTER'
    | 'UNIT_DETAIL'
    | 'ARMY_LIST';

export interface WindowPosition {
    x: number;
    y: number;
}

export interface WindowSize {
    width: number;
    height: number;
}

export type ToolContextMode = 'list' | 'standalone';

// Per-widget props types — extend this map when a widget needs typed props
export type WidgetPropsMap = {
    DICE_CALCULATOR: { unitSlug?: string; contextMode?: ToolContextMode };
    DICE_ANALYTICS: { contextMode?: ToolContextMode };
    CLASSIFIEDS: { contextMode?: ToolContextMode };
    FIRETEAMS: { contextMode?: ToolContextMode };
    RANGES: never;
    COMPARE: never;
    SEARCH: never;
    REFERENCE: never;
    UNIT_ROSTER: never;
    UNIT_DETAIL: never;
    ARMY_LIST: never;
};
export type AnyWidgetProps = WidgetPropsMap[WidgetType];

export interface WindowState {
    id: string;
    type: WidgetType;
    title: string;
    position: WindowPosition;
    size: WindowSize;
    zIndex: number;
    isMinimized: boolean;
    props?: AnyWidgetProps;
}

export type LayoutMode = 'columns' | 'multi-window' | 'tabbed';

// The three panels that occupy the column slots in 'columns' layout mode
export const COLUMN_PANEL_ORDER: WidgetType[] = ['UNIT_ROSTER', 'UNIT_DETAIL', 'ARMY_LIST'];
// Two-column variant: drop Unit Detail (available on demand)
export const TWO_COLUMN_PANELS: WidgetType[] = ['UNIT_ROSTER', 'ARMY_LIST'];

export function getColumnPanels(count: 2 | 3): WidgetType[] {
    return count === 2 ? TWO_COLUMN_PANELS : COLUMN_PANEL_ORDER;
}

export interface WorkspaceState {
    windows: WindowState[];
    nextZIndex: number;
    layoutMode: LayoutMode;
    maximizedWindowId: string | null;
    columnWidths: number[]; // flex-grow fractions for each active column
    columnCount: 2 | 3;
    activeColumnIndex: number; // used for mobile swipe carousel
}

export type WorkspaceAction =
    | { type: 'OPEN_WINDOW'; widgetType: WidgetType; props?: AnyWidgetProps }
    | { type: 'CLOSE_WINDOW'; windowId: string }
    | { type: 'FOCUS_WINDOW'; windowId: string }
    | { type: 'MINIMIZE_WINDOW'; windowId: string }
    | { type: 'RESTORE_WINDOW'; windowId: string }
    | { type: 'MOVE_WINDOW'; windowId: string; position: WindowPosition }
    | { type: 'RESIZE_WINDOW'; windowId: string; size: WindowSize; position?: WindowPosition }
    | { type: 'RESTORE_STATE'; state: WorkspaceState }
    | { type: 'SET_LAYOUT_MODE'; mode: LayoutMode }
    | { type: 'SET_COLUMN_WIDTHS'; widths: number[] }
    | { type: 'SET_COLUMN_COUNT'; count: 2 | 3 }
    | { type: 'SET_ACTIVE_COLUMN'; index: number }
    | { type: 'TOGGLE_MAXIMIZE'; windowId: string }
    | { type: 'SNAP_WINDOW'; windowId: string; position: 'left' | 'right' };

// Default sizes for each widget type
export const DEFAULT_SIZES: Record<WidgetType, WindowSize> = {
    DICE_CALCULATOR: { width: 550, height: 700 },
    DICE_ANALYTICS: { width: 800, height: 750 },
    CLASSIFIEDS: { width: 900, height: 700 },
    FIRETEAMS: { width: 800, height: 600 },
    RANGES: { width: 900, height: 650 },
    COMPARE: { width: 800, height: 600 },
    SEARCH: { width: 600, height: 500 },
    REFERENCE: { width: 700, height: 600 },
    UNIT_ROSTER: { width: 400, height: 700 },
    UNIT_DETAIL: { width: 500, height: 700 },
    ARMY_LIST: { width: 600, height: 750 },
};

// Display labels for widget types
export const WIDGET_LABELS: Record<WidgetType, string> = {
    DICE_CALCULATOR: 'Dice Calculator',
    DICE_ANALYTICS: 'Dice Analytics',
    CLASSIFIEDS: 'Classifieds',
    FIRETEAMS: 'Fireteams',
    RANGES: 'Weapons',
    COMPARE: 'Factions',
    SEARCH: 'Units',
    REFERENCE: 'Skills & Equipment',
    UNIT_ROSTER: 'Roster',
    UNIT_DETAIL: 'Unit Detail',
    ARMY_LIST: 'Army List',
};

export const MIN_WINDOW_WIDTH = 300;
export const MIN_WINDOW_HEIGHT = 200;
