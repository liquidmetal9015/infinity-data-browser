/**
 * Format a move value (array of two numbers, already in inches from ETL)
 * Returns formatted string like "4-4" or "6-2"
 */
export function formatMove(move: number[]): string {
    if (!Array.isArray(move) || move.length !== 2) {
        return '-';
    }
    return `${move[0]}-${move[1]}`;
}
