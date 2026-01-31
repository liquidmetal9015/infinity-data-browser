// Re-export list types from shared module
// Maintains backwards compatibility for existing imports

export type {
    ListUnit,
    CombatGroup,
    ArmyList,
} from '../../shared/listTypes';

export {
    calculateListPoints,
    calculateListSWC,
    getUnitDetails,
    generateId,
} from '../../shared/listTypes';
