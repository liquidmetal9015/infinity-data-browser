// Widget Registry - Maps WidgetType to component, icon, and metadata
import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
    Search, Library, Activity, Users, Layers,
    ClipboardList, Calculator, Target, BarChart,
    Info,
} from 'lucide-react';
import type { WidgetType, WindowSize } from '../../types/workspace';
import { DEFAULT_SIZES, WIDGET_LABELS } from '../../types/workspace';

// Active panel imports
import { UnitRosterPanel } from '../Panels/UnitRosterPanel';
import { UnitDetailPanel } from '../Panels/UnitDetailPanel';
import { ArmyListPanel } from '../Panels/ArmyListPanel';

// Optimization tool imports — opened as floating windows
import { FireteamsPage } from '../../pages/FireteamsPage';
import { DiceCalculatorPage } from '../../pages/DiceCalculatorPage';
import { DiceAnalyticsPage } from '../../pages/DiceAnalyticsPage';
import { ClassifiedsPage } from '../../pages/ClassifiedsPage';

// Legacy/unused widget stubs (exploration pages now have proper routes)
import { SearchPage } from '../../pages/SearchPage';
import { ReferencePage } from '../../pages/ReferencePage';
import { RangesPage } from '../../pages/RangesPage';
import { ComparePage } from '../../pages/ComparePage';

export interface WidgetRegistryEntry {
    component: ComponentType<object>;
    label: string;
    icon: LucideIcon;
    defaultSize: WindowSize;
}

export const widgetRegistry: Record<WidgetType, WidgetRegistryEntry> = {
    // Active list-builder panels
    UNIT_ROSTER: {
        component: UnitRosterPanel,
        label: WIDGET_LABELS.UNIT_ROSTER,
        icon: Search,
        defaultSize: DEFAULT_SIZES.UNIT_ROSTER,
    },
    UNIT_DETAIL: {
        component: UnitDetailPanel,
        label: WIDGET_LABELS.UNIT_DETAIL,
        icon: Info,
        defaultSize: DEFAULT_SIZES.UNIT_DETAIL,
    },
    ARMY_LIST: {
        component: ArmyListPanel,
        label: WIDGET_LABELS.ARMY_LIST,
        icon: ClipboardList,
        defaultSize: DEFAULT_SIZES.ARMY_LIST,
    },

    // Optimization tools — launchable as floating windows
    FIRETEAMS: {
        component: FireteamsPage,
        label: WIDGET_LABELS.FIRETEAMS,
        icon: Layers,
        defaultSize: DEFAULT_SIZES.FIRETEAMS,
    },
    DICE_CALCULATOR: {
        component: DiceCalculatorPage,
        label: WIDGET_LABELS.DICE_CALCULATOR,
        icon: Calculator,
        defaultSize: DEFAULT_SIZES.DICE_CALCULATOR,
    },
    DICE_ANALYTICS: {
        component: DiceAnalyticsPage,
        label: WIDGET_LABELS.DICE_ANALYTICS,
        icon: BarChart,
        defaultSize: DEFAULT_SIZES.DICE_ANALYTICS,
    },
    CLASSIFIEDS: {
        component: ClassifiedsPage,
        label: WIDGET_LABELS.CLASSIFIEDS,
        icon: Target,
        defaultSize: DEFAULT_SIZES.CLASSIFIEDS,
    },

    // Exploration pages — these now have proper routes; widget entries kept for type completeness
    SEARCH: {
        component: SearchPage,
        label: WIDGET_LABELS.SEARCH,
        icon: Search,
        defaultSize: DEFAULT_SIZES.SEARCH,
    },
    REFERENCE: {
        component: ReferencePage,
        label: WIDGET_LABELS.REFERENCE,
        icon: Library,
        defaultSize: DEFAULT_SIZES.REFERENCE,
    },
    RANGES: {
        component: RangesPage,
        label: WIDGET_LABELS.RANGES,
        icon: Activity,
        defaultSize: DEFAULT_SIZES.RANGES,
    },
    COMPARE: {
        component: ComparePage,
        label: WIDGET_LABELS.COMPARE,
        icon: Users,
        defaultSize: DEFAULT_SIZES.COMPARE,
    },
};

// Panel widgets — shown in columns layout (always visible), and as tabs in other modes
export const PANEL_WIDGETS: WidgetType[] = [
    'UNIT_ROSTER',
    'UNIT_DETAIL',
    'ARMY_LIST',
];

// Tool widgets — launchable as floating windows from the NavBar
export const TOOL_WIDGETS: WidgetType[] = [
    'FIRETEAMS',
    'RANGES',
    'DICE_CALCULATOR',
    'DICE_ANALYTICS',
    'CLASSIFIEDS',
];

// Legacy export — PANEL_WIDGETS is now the source of truth for the columns layout
export const LAUNCHER_WIDGETS = PANEL_WIDGETS;
