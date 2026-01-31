// Re-export utilities from shared module
// MCP server now uses shared implementations

export {
    getUnitTags,
    calculateFireteamLevel,
    getFireteamBonuses,
    analyzeUnitForTeam,
} from '../shared/fireteams.js';

export type { UnitFireteamAnalysis } from '../shared/fireteams.js';

export { FactionRegistry } from '../shared/factions.js';

export type {
    Fireteam,
    FireteamUnit,
    FireteamBonus,
    FireteamChart,
    FactionInfo,
    SuperFaction,
} from '../shared/types.js';
