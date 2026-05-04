// List types for army list building
// Platform-agnostic types used by both frontend and MCP server

import type { Unit } from './types.js';
import type { Profile, Loadout } from './game-model.js';

/**
 * Represents a single unit added to an army list.
 *
 * `unitId` is the canonical identifier — always persisted.
 * `unit` is the resolved Unit object, populated at runtime from the database.
 * When serializing (localStorage, API), only `unitId` is stored; `unit` is
 * rehydrated via `hydrateList()` after loading.
 */
export interface ListUnit {
    /** Unique ID for this list entry */
    id: string;
    /** Canonical unit identifier — used for serialization and hydration */
    unitId: number;
    /** Resolved Unit data — populated at runtime, stripped on serialize */
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
    /** The ID of the fireteam this unit belongs to, if any */
    fireteamId?: string;
    /** A color assigned to the fireteam to visually group them */
    fireteamColor?: string;
    /** Notes indicating fireteam type (e.g., Core, Haris) or role */
    fireteamNotes?: string;
    /** ID of parent unit (for peripheral/attached units like Crabbots) */
    parentId?: string;
    /** True for auto-attached peripheral entries (points don't count toward list total) */
    isPeripheral?: boolean;
}

/**
 * Represents a single fireteam container within a combat group.
 */
export interface FireteamDef {
    id: string;
    color: string;
    notes?: string;
    selectedTeamName?: string;
    selectedTeamType?: string;
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
    /** Explicit fireteams defined in this group (can be empty) */
    fireteams?: FireteamDef[];
}

/**
 * Represents a complete army list.
 */
export interface ArmyList {
    /** Unique ID for this list */
    id: string;
    /** User-defined name for the list */
    name: string;
    /** Optional notes (free-form user text) */
    notes?: string;
    /** User-defined tags for organization */
    tags: string[];
    /** Star rating 0–5 (0 = unrated) */
    rating?: number;
    /** Soft UI lock — when true, the builder hides edit affordances */
    isLocked?: boolean;
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
    /** Backend-assigned ID once saved to the server */
    serverId?: number;
}

/**
 * Helper to calculate total points from a list
 */
export function calculateListPoints(list: ArmyList): number {
    return list.groups.reduce((total, group) =>
        total + group.units.filter(u => !u.isPeripheral).reduce((groupTotal, unit) => groupTotal + Number(unit.points || 0), 0), 0);
}

/**
 * Helper to calculate total SWC from a list
 */
export function calculateListSWC(list: ArmyList): number {
    return list.groups.reduce((total, group) =>
        total + group.units.filter(u => !u.isPeripheral).reduce((groupTotal, unit) => groupTotal + Number(unit.swc || 0), 0), 0);
}

/**
 * Helper to get the profile and option from a unit for a ListUnit
 */
export function getUnitDetails(unit: Unit, profileGroupId: number, profileId: number, optionId: number): {
    profile: Profile | undefined;
    option: Loadout | undefined;
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

// ============================================================================
// Serialization helpers — strip/restore `unit` for persistence
// ============================================================================

/**
 * A dehydrated ListUnit stores only `unitId` (no `unit` field).
 * Used when persisting to localStorage or sending to the API.
 */
export type DehydratedListUnit = Omit<ListUnit, 'unit'>;

export interface DehydratedCombatGroup {
    id: string;
    name: string;
    units: DehydratedListUnit[];
    fireteams?: FireteamDef[];
}

export interface DehydratedArmyList {
    id: string;
    name: string;
    notes?: string;
    tags: string[];
    rating?: number;
    isLocked?: boolean;
    factionId: number;
    pointsLimit: number;
    swcLimit: number;
    groups: DehydratedCombatGroup[];
    createdAt: number;
    updatedAt: number;
    serverId?: number;
}

/**
 * Strip the `unit` field from all ListUnits for compact serialization.
 * The `unitId` field is retained for rehydration.
 */
export function dehydrateList(list: ArmyList): DehydratedArmyList {
    return {
        ...list,
        groups: list.groups.map(g => ({
            ...g,
            units: g.units.map(({ unit: _unit, ...rest }) => rest),
        })),
    };
}

/**
 * Restore `unit` references on all ListUnits from a unit resolver.
 * Returns null for any unit that cannot be resolved (data mismatch).
 */
export function hydrateList(
    dehydrated: DehydratedArmyList,
    resolveUnit: (unitId: number) => Unit | undefined,
): ArmyList | null {
    const groups: CombatGroup[] = dehydrated.groups.map(g => ({
        ...g,
        units: g.units.map(dlu => {
            const unit = resolveUnit(dlu.unitId);
            if (!unit) return null;
            return { ...dlu, unit } as ListUnit;
        }).filter((u): u is ListUnit => u !== null),
    }));

    return { ...dehydrated, groups };
}
