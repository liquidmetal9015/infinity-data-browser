// FetchDatabase - Browser implementation using fetch()
// Extends BaseDatabase with browser-specific data loading

import type { DatabaseMetadata, FireteamChart, FactionInfo, SuperFaction, SearchSuggestion, Unit } from '@shared/types';
import { BaseDatabase, type FactionDataFile, type SearchFilter } from '../../shared/BaseDatabase';
import type { ParsedWeapon } from '../../shared/types';
import type { ClassifiedObjective } from '../../shared/classifieds';

// Re-export interface for backwards compatibility
import api from './api';

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
    factionMap: Map<number, string>;
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
        try {
            const [metaRes, facRes] = await Promise.all([
                api.get('/api/metadata'),
                api.get('/api/factions')
            ]);

            return {
                ...metaRes.data,
                factions: facRes.data,
                equips: metaRes.data.equipment
            };
        } catch (e) {
            throw new Error(`Failed to load metadata from API: ${e}`);
        }
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
        try {
            const res = await api.get(`/api/factions/${slug}/legacy`);
            return res.data;
        } catch {
            return null;
        }
    }
}

// Deprecated export for backward compatibility
export const Database = DatabaseImplementation;
