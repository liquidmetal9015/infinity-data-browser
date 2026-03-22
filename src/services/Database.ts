// FetchDatabase - Browser implementation using fetch()
// Extends BaseDatabase with browser-specific data loading

import type { DatabaseMetadata, FireteamChart, FactionInfo, SuperFaction, SearchSuggestion, Unit } from '@shared/types';
import { BaseDatabase, type FactionDataFile, type SearchFilter } from '../../shared/BaseDatabase';
import type { ParsedWeapon } from '../../shared/types';
import type { ClassifiedObjective } from '../../shared/classifieds';

// Re-export interface for backwards compatibility
export interface IDatabase {
    units: Unit[];
    metadata: DatabaseMetadata | null;
    classifieds: ClassifiedObjective[];
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
    getWeaponDetails(id: number): ParsedWeapon | undefined;
}

export class DatabaseImplementation extends BaseDatabase implements IDatabase {
    private static instance: DatabaseImplementation;
    public classifieds: ClassifiedObjective[] = [];

    constructor() {
        super();
    }

    static getInstance(): DatabaseImplementation {
        if (!DatabaseImplementation.instance) {
            DatabaseImplementation.instance = new DatabaseImplementation();
        }
        return DatabaseImplementation.instance;
    }

    public async init(): Promise<void> {
        await super.init();
        try {
            this.classifieds = await this.loadClassifieds();
        } catch (e) {
            console.error("Failed to load classifieds", e);
        }
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

    protected async loadClassifieds(): Promise<ClassifiedObjective[]> {
        const res = await fetch(import.meta.env.BASE_URL + 'data/classifieds.json');
        if (!res.ok) {
            // fallback or empty if missing
            console.warn(`Failed to load classifieds.json: ${res.status}`);
            return [];
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
