/**
 * Conversion utilities for Infinity game measurements
 * Infinity uses 5cm = 2 inches conversion
 */

const CM_TO_INCH_RATIO = 2 / 5; // 0.4

/**
 * Convert centimeters to inches using Infinity's 5cm = 2" ratio
 */
export function cmToInches(cm: number): number {
    return cm * CM_TO_INCH_RATIO;
}

/**
 * Format a distance value in cm as inches
 * Always shows as integer (Infinity uses whole inch values)
 */
export function formatDistance(cm: number): string {
    return Math.round(cmToInches(cm)).toString();
}

/**
 * Format a move value (array of two numbers) from cm to inches
 * Returns formatted string like "4-4" or "6-2"
 */
export function formatMove(move: number[]): string {
    if (!Array.isArray(move) || move.length !== 2) {
        return '-';
    }
    return `${formatDistance(move[0])}-${formatDistance(move[1])}`;
}
