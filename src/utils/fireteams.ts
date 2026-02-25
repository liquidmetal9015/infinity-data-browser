// Re-export fireteam utilities from shared module
// Maintains backwards compatibility for existing imports

export {
    getUnitTags,
    calculateFireteamLevel,
    getFireteamBonuses,
    analyzeUnitForTeam,
    getPossibleFireteams,
    assignMembersToSlots,
    getMemberWithChartData,
} from '../../shared/fireteams';

export type {
    UnitFireteamAnalysis,
    SlotAssignment,
} from '../../shared/fireteams';

export type {
    Fireteam,
    FireteamUnit,
    FireteamBonus,
    FireteamChart,
} from '../../shared/types';
