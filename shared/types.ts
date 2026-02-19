// ============================================================================
// Core Data Types - Used by both frontend and MCP server
// ============================================================================

export interface Item {
    id: number;
    name: string;
    type: 'WEAPON' | 'SKILL' | 'EQUIPMENT';
    wiki?: string;
}

// Rule summaries for agent context - compact explanations of skills/equipment
export interface RuleSummary {
    name: string;
    summary: string;
}

export interface RuleSummariesData {
    skills: Record<string, RuleSummary>;
    equipment: Record<string, RuleSummary>;
}


export interface Profile {
    id: number;
    name: string;
    skills: { id: number; extra?: number[] }[];
    equip: { id: number; extra?: number[] }[];
    weapons: { id: number; extra?: number[] }[];
    type?: number; // Unit classification (1=LI, 2=MI, etc)
    move: number[];
    cc: number;
    bs: number;
    ph: number;
    wip: number;
    arm: number;
    bts: number;
    w: number;
    s: number;
    str?: boolean; // true if W is Structure
}

export interface Option {
    id: number;
    name: string;
    points: number;
    swc: number;
    skills: { id: number; extra?: number[] }[];
    equip: { id: number; extra?: number[] }[];
    weapons: { id: number; extra?: number[] }[];
}

export interface UnitRaw {
    id: number;
    idArmy?: number;
    isc: string;
    name: string;
    factions: number[];
    profileGroups: {
        id: number;
        isc?: string;
        isco?: string; // Option ISC (name for the group)
        profiles: Profile[];
        options: Option[];
    }[];
    slug?: string;
}

// Represents a skill/equipment with its modifier value(s)
export interface ItemWithModifier {
    id: number;
    name: string;
    type: 'skill' | 'equipment' | 'weapon';
    modifiers: number[];  // The 'extra' values, e.g., [6] for Mimetism(-6)
}

export interface Unit {
    id: number;
    idArmy?: number;
    isc: string;
    name: string;
    factions: number[];
    // Computed Set of IDs for fast lookup
    allWeaponIds: Set<number>;
    allSkillIds: Set<number>;
    allEquipmentIds: Set<number>;
    // Skills/Equipment with their modifiers for detailed search
    allItemsWithMods: ItemWithModifier[];
    // Pre-computed points range [min, max] across all options
    pointsRange: [number, number];
    raw: UnitRaw; // Keep raw data for display
}

export interface DatabaseMetadata {
    factions: {
        id: number;
        parent: number;
        name: string;
        slug: string;
        discontinued: boolean;
        logo: string;
    }[];
    weapons: {
        id: number;
        name: string;
        wiki?: string;
        properties?: string[];
        type?: string;
        burst?: string;
        damage?: string;
        saving?: string;
        savingNum?: string;
        ammunition?: number;
        distance?: {
            short?: { max: number; mod: string };
            med?: { max: number; mod: string };
            long?: { max: number; mod: string };
            max?: { max: number; mod: string };
        } | null;
    }[];
    skills: { id: number; name: string; wiki?: string }[];
    equips: { id: number; name: string; wiki?: string }[];
    ammunitions: { id: number; name: string; wiki?: string }[];
}

export interface SearchSuggestion {
    id: number;
    name: string;              // Base name "Mimetism"
    displayName: string;       // "Mimetism(-6)" or "Mimetism (any)"
    type: 'weapon' | 'skill' | 'equipment';
    modifiers: number[];       // The modifier values
    isAnyVariant: boolean;     // True for the "any" option
    wiki?: string;
}

// ============================================================================
// Fireteam Types
// ============================================================================

export interface FireteamUnit {
    name: string;
    slug: string;
    min: number;
    max: number;
    required?: boolean;
    comment?: string;
}

export interface Fireteam {
    name: string;
    type: string[]; // e.g. ["CORE", "HARIS", "DUO"]
    units: FireteamUnit[];
    obs?: string;
}

export interface FireteamChart {
    spec: Record<string, number>; // e.g. { CORE: 1, HARIS: 1, DUO: 256 }
    desc?: string;
    teams: Fireteam[];
}

export interface FireteamBonus {
    level: number;
    description: string;
    isActive: boolean;
}

// ============================================================================
// Faction Registry Types
// ============================================================================

export interface FactionInfo {
    id: number;
    parentId: number;
    name: string;
    shortName: string;
    slug: string;
    discontinued: boolean;
    logo: string;
    isVanilla: boolean;  // parent === id means it's a "vanilla" or super-faction
    hasData: boolean;    // Whether we have a JSON file for this faction
}

export interface SuperFaction {
    id: number;
    name: string;
    shortName: string;
    vanilla: FactionInfo | null;  // The vanilla version (if exists)
    sectorials: FactionInfo[];    // Child sectorials
}

// ============================================================================
// Wiki & ITS Types (MCP-specific but shared for type compatibility)
// ============================================================================

export interface WikiPage {
    slug: string;
    title: string;
    content: string;
    url: string;
}

export interface ITSRules {
    toc: {
        title: string;
        page_id: number;
    }[];
    content: string;
}

// ============================================================================
// Army List Types (for list building and MCP analysis)
// ============================================================================

export interface HydratedItem {
    name: string;
    wiki?: string;
    modifiers: string[];
    summary?: string;
    stats?: ParsedWeapon;
}

export interface HydratedUnit {
    isc: string;
    name: string;
    points: number;
    swc: number;
    profile: {
        move: string;
        cc: number;
        bs: number;
        ph: number;
        wip: number;
        arm: number;
        bts: number;
        w: number;
        s: number;
        str: boolean;
    };
    weapons: HydratedItem[];
    skills: HydratedItem[];
    equipment: HydratedItem[];
}

export interface HydratedGroup {
    groupNumber: number;
    units: HydratedUnit[];
}

export interface HydratedList {
    faction: string;
    factionSlug: string;
    armyName: string;
    points: number;
    maxPoints: number;
    swc: number;
    maxSwc: number;
    groups: HydratedGroup[];
}

// ============================================================================
// Filter Types (for search)
// ============================================================================

export interface SearchFilter {
    type: 'weapon' | 'skill' | 'equipment' | 'stat';
    baseId?: number;
    modifiers?: number[];
    matchAnyModifier?: boolean;
    stat?: string;
    statOperator?: '>' | '>=' | '=' | '<=' | '<';
    value?: number;
}
// ============================================================================
// Weapon Analysis Types
// ============================================================================

export interface RangeBand {
    start: number;
    end: number;
    mod: number;
    label?: string; // Optional for display, e.g. '0-8"'
}

export interface ParsedWeapon {
    id: number;
    name: string;
    bands: RangeBand[];
    burst: string;
    damage: string;
    saving: string;
    savingNum: string;
    ammunition: string; // resolved name
    properties: string[];
    templateType?: 'small' | 'large' | 'none';
}
