// Common types for dice calculator components
import type { RangeBand } from '../../../shared/types';
export type { RangeBand };

export interface WeaponPreset {
    name: string;
    sv: number;
    ps: number;
    ammo: string;
    burst: number;
}

export interface ArmorPreset {
    name: string;
    armor: number;
}

export interface WeaponProfile {
    burst: number;
    damage: string;
    ammo: string[];
    bands: RangeBand[];
}

// Standard presets
export const WEAPON_PRESETS: WeaponPreset[] = [
    { name: 'Combi', sv: 0, ps: 13, ammo: 'N', burst: 3 },
    { name: 'Rifle', sv: 0, ps: 13, ammo: 'N', burst: 3 },
    { name: 'HMG', sv: 0, ps: 15, ammo: 'N', burst: 4 },
    { name: 'Spitfire', sv: 0, ps: 14, ammo: 'N', burst: 4 },
    { name: 'Sniper', sv: 0, ps: 15, ammo: 'DA', burst: 2 },
    { name: 'Missile', sv: 0, ps: 14, ammo: 'EXP', burst: 2 },
    { name: 'Pistol', sv: 0, ps: 11, ammo: 'N', burst: 2 },
];

export const ARMOR_PRESETS: ArmorPreset[] = [
    { name: 'LI', armor: 0 },
    { name: 'MI', armor: 2 },
    { name: 'HI', armor: 4 },
    { name: 'TAG', armor: 7 },
];

export const AMMO_LIST = ['N', 'DA', 'EXP', 'T2', 'PLASMA'];
