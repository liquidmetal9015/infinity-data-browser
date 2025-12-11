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
}

export interface Option {
    id: int;
    name: string;
    points: number;
    swc: number;
    skills: { id: int }[];
    equip: { id: int }[];
    weapons: { id: int }[];
}

export interface UnitRaw {
    id: int;
    isc: string;
    name: string;
    factions: int[];
    profileGroups: {
        id: int;
        profiles: Profile[];
        options: Option[];
    }[];
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
    weapons: { id: int; name: string }[];
    skills: { id: int; name: string }[];
    equips: { id: int; name: string }[];
}

// Helper type for int
type int = number;
