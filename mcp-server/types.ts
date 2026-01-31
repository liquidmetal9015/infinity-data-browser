export interface Item {
    id: number;
    name: string;
    type: 'WEAPON' | 'SKILL' | 'EQUIPMENT';
    wiki?: string;
}

export interface Profile {
    id: number;
    name: string;
    skills: { id: number; extra?: number[] }[];
    equip: { id: number; extra?: number[] }[];
    weapons: { id: number; extra?: number[] }[];
    type?: number;
    move: number[];
    cc: number;
    bs: number;
    ph: number;
    wip: number;
    arm: number;
    bts: number;
    w: number;
    s: number;
    str?: boolean;
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
    isc: string;
    name: string;
    factions: number[];
    profileGroups: {
        id: number;
        isc?: string;
        isco?: string;
        profiles: Profile[];
        options: Option[];
    }[];
    slug?: string;
}

export interface ItemWithModifier {
    id: number;
    name: string;
    type: 'skill' | 'equipment' | 'weapon';
    modifiers: number[];
}

export interface Unit {
    id: number;
    isc: string;
    name: string;
    factions: number[];
    allWeaponIds: Set<number>;
    allSkillIds: Set<number>;
    allEquipmentIds: Set<number>;
    allItemsWithMods: ItemWithModifier[];
    pointsRange: [number, number];
    raw: UnitRaw;
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
        ammunition?: number;
    }[];
    skills: { id: number; name: string; wiki?: string }[];
    equips: { id: number; name: string; wiki?: string }[];
    ammunitions: { id: number; name: string; wiki?: string }[];
}

export interface SearchSuggestion {
    id: number;
    name: string;
    displayName: string;
    type: 'weapon' | 'skill' | 'equipment';
    modifiers: number[];
    isAnyVariant: boolean;
    wiki?: string;
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
    type: string[];
    units: FireteamUnit[];
    obs?: string;
}

export interface FireteamChart {
    spec: Record<string, number>;
    desc?: string;
    teams: Fireteam[];
}

// Faction Registry Types
export interface SuperFaction {
    id: number;
    name: string;
    vanilla: FactionInfo | undefined;
    sectorials: FactionInfo[];
}

export interface FactionInfo {
    id: number;
    name: string;
    slug: string;
    logo: string;
    parent: number;
    hasData: boolean;
}

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
