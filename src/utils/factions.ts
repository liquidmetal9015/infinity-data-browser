// Re-export FactionRegistry from shared module
// Maintains backwards compatibility for existing imports

export { FactionRegistry } from '../../shared/factions';
export type { FactionInfo, SuperFaction } from '../../shared/types';
