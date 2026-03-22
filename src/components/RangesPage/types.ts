// Types for Ranges/Weapons Page
import type { ParsedWeapon } from '../../../shared/types';
export type { RangeBand, ParsedWeapon } from '../../../shared/types';

// Standard range bands in inches
export const RANGE_BANDS = [
    { start: 0, end: 8, label: '0-8"' },
    { start: 8, end: 16, label: '8-16"' },
    { start: 16, end: 24, label: '16-24"' },
    { start: 24, end: 32, label: '24-32"' },
    { start: 32, end: 40, label: '32-40"' },
    { start: 40, end: 48, label: '40-48"' },
    { start: 48, end: 96, label: '48-96"' },
];

export interface BestWeaponInfo {
    band: { start: number; end: number; label: string };
    weapon: ParsedWeapon | null;
    mod: number;
    diff: number;
}
