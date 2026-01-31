// FetchDatabase - Browser implementation using fetch()
// Extends BaseDatabase with browser-specific data loading

import type { DatabaseMetadata, FireteamChart, FactionInfo, SuperFaction, SearchSuggestion, Unit } from '../types';
import { BaseDatabase, type FactionDataFile, type SearchFilter } from '../../shared/BaseDatabase';

// Re-export interface for backwards compatibility
export interface IDatabase {
    units: Unit[];
    metadata: DatabaseMetadata | null;
    init(): Promise<void>;
    searchWithModifiers(filters: SearchFilter[], operator: 'and' | 'or'): Unit[];
    getFactionName(id: number): string;
    getFactionShortName(id: number): string;
    getFactionInfo(id: number): FactionInfo | undefined;
    getGroupedFactions(): SuperFaction[];
    factionHasData(id: number): boolean;
    getSuggestions(query: string): SearchSuggestion[];
    extrasMap: Map<number, string>;
    weaponMap: Map<number, string>;
    skillMap: Map<number, string>;
    equipmentMap: Map<number, string>;
    getWikiLink(type: 'weapon' | 'skill' | 'equipment', id: number): string | undefined;
    getFireteamChart(factionId: number): FireteamChart | undefined;
    getUnitBySlug(slug: string): Unit | undefined;
    getExtraName(id: number): string | undefined;
}

export class DatabaseImplementation extends BaseDatabase implements IDatabase {
    private static instance: DatabaseImplementation;

    constructor() {
        super();
    }

    static getInstance(): DatabaseImplementation {
        if (!DatabaseImplementation.instance) {
            DatabaseImplementation.instance = new DatabaseImplementation();
        }
        return DatabaseImplementation.instance;
    }

    // ========================================================================
    // Platform-specific: Load via fetch()
    // ========================================================================

    protected async loadMetadata(): Promise<DatabaseMetadata> {
        const res = await fetch(import.meta.env.BASE_URL + 'data/metadata.json');
        if (!res.ok) {
            throw new Error(`Failed to load metadata: ${res.status}`);
        }
        return res.json();
    }

    protected async loadFactionData(slug: string): Promise<FactionDataFile | null> {
        const filename = `${import.meta.env.BASE_URL}data/${slug}.json`;
        try {
            const res = await fetch(filename);
            if (!res.ok) return null;
            return res.json();
        } catch {
            return null;
        }
    }
}

// Deprecated export for backward compatibility
export const Database = DatabaseImplementation;
