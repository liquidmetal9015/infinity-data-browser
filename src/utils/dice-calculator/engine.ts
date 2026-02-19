// Re-export dice engine from shared module
// Maintains backwards compatibility for existing imports

export {
    createInfinityDie,
    solveF2F,
    calculateExpectedWounds,
    calculateF2F,
} from '../../../shared/dice-engine';

export type {
    InfinityF2FOutcome,
    WoundResults,
    F2FResult,
    CombatantInput,
} from '../../../shared/dice-engine';
