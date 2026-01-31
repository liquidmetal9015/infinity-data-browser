// Re-export types and utilities from shared module
// This maintains backwards compatibility for existing imports

export type {
    Item,
    Profile,
    Option,
    UnitRaw,
    ItemWithModifier,
    Unit,
    DatabaseMetadata,
    SearchSuggestion,
    FireteamUnit,
    Fireteam,
    FireteamChart,
    FireteamBonus,
    FactionInfo,
    SuperFaction,
    WikiPage,
    ITSRules,
    HydratedItem,
    HydratedUnit,
    HydratedGroup,
    HydratedList,
    SearchFilter,
} from '../shared/types.js';

// Army code types are in armyCode module
export type {
    DecodedArmyList,
    DecodedCombatGroup,
    DecodedMember,
    EncodableArmyList,
} from '../shared/armyCode.js';

// Re-export classes
export { FactionRegistry } from '../shared/factions.js';

// Re-export functions
export {
    getUnitTags,
    calculateFireteamLevel,
    getFireteamBonuses,
    analyzeUnitForTeam,
} from '../shared/fireteams.js';

export {
    decodeArmyCode,
    encodeArmyList,
    isValidArmyCode,
} from '../shared/armyCode.js';
