// List types for army list building
// Platform-agnostic types used by both frontend and MCP server

import type { Unit, Profile, Option } from './types.js';

/**
 * Represents a single unit added to an army list.
 */
export interface ListUnit {
    /** Unique ID for this list entry */
    id: string;
    /** Reference to the base Unit data */
    unit: Unit;
    /** The selected profile group ID */
    profileGroupId: number;
    /** The selected profile ID within the group */
    profileId: number;
    /** The selected option ID */
    optionId: number;
    /** Cached points cost for this specific option */
    points: number;
    /** Cached SWC cost for this specific option */
    swc: number;
}

/**
 * Represents a Combat Group in an Infinity army list.
 */
export interface CombatGroup {
    /** Unique ID for this combat group */
    id: string;
    /** Display name (e.g., "Combat Group 1") */
    name: string;
    /** Units in this combat group */
    units: ListUnit[];
}

/**
 * Represents a complete army list.
 */
export interface ArmyList {
    /** Unique ID for this list */
    id: string;
    /** User-defined name for the list */
    name: string;
    /** The faction ID this list is built for */
    factionId: number;
    /** Target points limit (e.g., 300) */
    pointsLimit: number;
    /** Target SWC limit (usually pointsLimit / 50) */
    swcLimit: number;
    /** Combat groups in this list */
    groups: CombatGroup[];
    /** Timestamp when created */
    createdAt: number;
    /** Timestamp when last modified */
    updatedAt: number;
}

/**
 * Helper to calculate total points from a list
 */
export function calculateListPoints(list: ArmyList): number {
    return list.groups.reduce((total, group) =>
        total + group.units.reduce((groupTotal, unit) => groupTotal + Number(unit.points || 0), 0), 0);
}

/**
 * Helper to calculate total SWC from a list
 */
export function calculateListSWC(list: ArmyList): number {
    return list.groups.reduce((total, group) =>
        total + group.units.reduce((groupTotal, unit) => groupTotal + Number(unit.swc || 0), 0), 0);
}

/**
 * Helper to get the profile and option from a unit for a ListUnit
 */
export function getUnitDetails(unit: Unit, profileGroupId: number, profileId: number, optionId: number): {
    profile: Profile | undefined;
    option: Option | undefined;
} {
    const profileGroup = unit.raw.profileGroups.find(pg => pg.id === profileGroupId);
    const profile = profileGroup?.profiles.find(p => p.id === profileId);
    const option = profileGroup?.options.find(o => o.id === optionId);
    return { profile, option };
}

/**
 * Generate a unique ID for list items
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
