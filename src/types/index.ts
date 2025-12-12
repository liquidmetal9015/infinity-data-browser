export interface Item {
    id: int;
    name: string;
    type: 'WEAPON' | 'SKILL' | 'EQUIPMENT';
    wiki?: string;
}

export interface Profile {
    id: int;
    name: string;
    skills: { id: int; extra?: any }[];
    equip: { id: int; extra?: any }[]; // Note: Source JSON uses 'equip' in some places, 'equipment' in models
    weapons: { id: int; extra?: any }[];
    type?: int; // Unit classification (1=LI, 2=MI, etc)
    // Stats
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
    id: int;
    name: string;
    points: number;
    swc: number;
    skills: { id: int; extra?: number[] }[];
    equip: { id: int; extra?: number[] }[];
    weapons: { id: int; extra?: number[] }[];
}

export interface UnitRaw {
    id: int;
    isc: string;
    name: string;
    factions: int[];
    profileGroups: {
        id: int;
        isc?: string;
        isco?: string; // Option ISC (name for the group)
        profiles: Profile[];
        options: Option[];
    }[];
    slug?: string;
}

// Represents a skill/equipment with its modifier value(s)
export interface ItemWithModifier {
    id: int;
    name: string;
    type: 'skill' | 'equipment' | 'weapon';
    modifiers: number[];  // The 'extra' values, e.g., [6] for Mimetism(-6)
}

export interface Unit {
    id: int;
    isc: string;
    name: string;
    factions: int[];
    // Computed Set of IDs for fast lookup
    allWeaponIds: Set<int>;
    allSkillIds: Set<int>;
    allEquipmentIds: Set<int>;
    // Skills/Equipment with their modifiers for detailed search
    allItemsWithMods: ItemWithModifier[];
    // Pre-computed points range [min, max] across all options
    pointsRange: [number, number];
    raw: UnitRaw; // Keep raw data for display
}

export interface DatabaseMetadata {
    factions: {
        id: int;
        parent: int;
        name: string;
        slug: string;
        discontinued: boolean;
        logo: string;
    }[];
    weapons: {
        id: int;
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
    skills: { id: int; name: string; wiki?: string }[];
    equips: { id: int; name: string; wiki?: string }[];
    ammunitions: { id: int; name: string; wiki?: string }[];
}

// Helper type for int
type int = number;

export interface SearchSuggestion {
    id: int;
    name: string;              // Base name "Mimetism"
    displayName: string;       // "Mimetism(-6)" or "Mimetism (any)"
    type: 'weapon' | 'skill' | 'equipment';
    modifiers: number[];       // The modifier values
    isAnyVariant: boolean;     // True for the "any" option
}

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
