// Widget Registry - Maps WidgetType to component, icon, and metadata
import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
    Search, Library, Activity, Users, Layers,
    ClipboardList, Calculator, Target, BarChart
} from 'lucide-react';
import type { WidgetType, WindowSize } from '../../types/workspace';
import { DEFAULT_SIZES, WIDGET_LABELS } from '../../types/workspace';

// Lazy imports for page components
import { SearchPage } from '../../pages/SearchPage';
import { ReferencePage } from '../../pages/ReferencePage';
import { RangesPage } from '../../pages/RangesPage';
import { ComparePage } from '../../pages/ComparePage';
import { FireteamsPage } from '../../pages/FireteamsPage';
import { ListBuilderPage } from '../../pages/ListBuilderPage';
import { DiceCalculatorPage } from '../../pages/DiceCalculatorPage';
import { DiceAnalyticsPage } from '../../pages/DiceAnalyticsPage';
import { ClassifiedsPage } from '../../pages/ClassifiedsPage';

export interface WidgetRegistryEntry {
    component: ComponentType<any>;
    label: string;
    icon: LucideIcon;
    defaultSize: WindowSize;
}

export const widgetRegistry: Record<WidgetType, WidgetRegistryEntry> = {
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
    FIRETEAMS: {
        component: FireteamsPage,
        label: WIDGET_LABELS.FIRETEAMS,
        icon: Layers,
        defaultSize: DEFAULT_SIZES.FIRETEAMS,
    },
    LIST_BUILDER: {
        component: ListBuilderPage,
        label: WIDGET_LABELS.LIST_BUILDER,
        icon: ClipboardList,
        defaultSize: DEFAULT_SIZES.LIST_BUILDER,
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
};

// Widget types shown in the launcher (in display order)
export const LAUNCHER_WIDGETS: WidgetType[] = [
    'LIST_BUILDER',
    'DICE_CALCULATOR',
    'DICE_ANALYTICS',
    'CLASSIFIEDS',
    'FIRETEAMS',
    'RANGES',
    'COMPARE',
    'SEARCH',
    'REFERENCE',
];
