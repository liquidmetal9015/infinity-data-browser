// FetchDatabase - Browser implementation using fetch()
// Extends BaseDatabase with browser-specific data loading

import type { DatabaseMetadata, FireteamChart, FactionInfo, SuperFaction, SearchSuggestion, Unit } from '@shared/types';
import { BaseDatabase, type FactionDataFile, type SearchFilter } from '../../shared/BaseDatabase';
import type { ParsedWeapon } from '../../shared/types';
import type { ClassifiedObjective } from '../../shared/classifieds';

import api from './api';

interface BulkFactionEntry extends FactionDataFile {
    faction: {
        id: number;
        name: string;
        slug: string;
        parent_id: number | null;
        is_vanilla: boolean;
        discontinued: boolean;
        logo: string;
    };
}

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

    private allFactionData: Record<string, FactionDataFile> | null = null;

    protected async loadMetadata(): Promise<DatabaseMetadata> {
        const [metaRes, bulkJson] = await Promise.all([
            api.GET('/api/metadata'),
            fetch('/api/factions/all/legacy').then(r => r.ok ? r.json() as Promise<Record<string, BulkFactionEntry>> : Promise.resolve({} as Record<string, BulkFactionEntry>)),
        ]);

        if (metaRes.error) throw new Error(`Failed to load metadata: ${metaRes.error}`);

        this.allFactionData = Object.fromEntries(
            Object.entries(bulkJson).map(([slug, entry]) => [slug, { units: entry.units, fireteamChart: entry.fireteamChart, filters: entry.filters }])
        );

        const factions: DatabaseMetadata['factions'] = Object.values(bulkJson).map(entry => ({
            id: entry.faction.id,
            parent: entry.faction.parent_id ?? entry.faction.id,
            name: entry.faction.name,
            slug: entry.faction.slug,
            discontinued: entry.faction.discontinued,
            logo: entry.faction.logo,
        }));

        return {
            ...metaRes.data,
            factions,
            equips: metaRes.data.equipment,
        };
    }

    protected async loadClassifieds(): Promise<ClassifiedObjective[]> {
        const res = await fetch(import.meta.env.BASE_URL + 'data/classifieds.json');
        if (!res.ok) {
            console.warn(`Failed to load classifieds.json: ${res.status}`);
            return [];
        }
        return res.json();
    }

    protected async loadFactionData(slug: string): Promise<FactionDataFile | null> {
        return this.allFactionData?.[slug] ?? null;
    }
}

// Deprecated export for backward compatibility
export const Database = DatabaseImplementation;
