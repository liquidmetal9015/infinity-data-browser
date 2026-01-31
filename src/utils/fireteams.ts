// Re-export fireteam utilities from shared module
// Maintains backwards compatibility for existing imports

export {
    getUnitTags,
    calculateFireteamLevel,
    getFireteamBonuses,
    analyzeUnitForTeam,
} from '../../shared/fireteams';

export type {
    UnitFireteamAnalysis,
} from '../../shared/fireteams';

export type {
    Fireteam,
    FireteamUnit,
    FireteamBonus,
    FireteamChart,
} from '../../shared/types';
