// Classification constants for Infinity unit types
// Verified mapping from profile.unitType values in faction data

export const CLASSIFICATION_LABELS: Record<number, string> = {
    1: 'LI', 2: 'MI', 3: 'HI', 4: 'TAG', 5: 'REM', 6: 'SK', 7: 'WB', 8: 'VH'
};

export const CLASSIFICATION_COLORS: Record<number, string> = {
    1: '#94a3b8', // LI - slate
    2: '#60a5fa', // MI - blue
    3: '#f59e0b', // HI - amber
    4: '#ef4444', // TAG - red
    5: '#22c55e', // REM - green
    6: '#8b5cf6', // SK - purple
    7: '#ec4899', // WB - pink
    8: '#06b6d4', // VH - cyan
};

// Roster grouping order
export const CLASSIFICATION_ORDER = [1, 2, 3, 4, 5, 6, 7, 8]; // LI, MI, HI, TAG, REM, SK, WB, VH

/**
 * Determines if a profileGroup within a unit is a peripheral (e.g., Crabbot, Auxbot).
 */
export function isPeripheralGroup(unit: { raw: { profileGroups: { isPeripheral?: boolean }[] } }, groupIndex: number): boolean {
    const pg = unit.raw.profileGroups[groupIndex];
    return pg?.isPeripheral ?? false;
}
