// FetchDatabase - Browser implementation using fetch()
// Extends BaseDatabase with browser-specific data loading

import type { DatabaseMetadata, FireteamChart, FactionInfo, SuperFaction, SearchSuggestion, Unit } from '@shared/types';
import { BaseDatabase, type SearchFilter } from '../../shared/BaseDatabase';
import type { ParsedWeapon } from '../../shared/types';
import type { ClassifiedObjective } from '../../shared/classifieds';
import type { ProcessedFactionFile, ProcessedMetadataFile, ProcessedFactionsFile } from '../../shared/game-model';

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
    weaponMap: Map<number, string>;
    skillMap: Map<number, string>;
    equipmentMap: Map<number, string>;
    getWikiLink(type: 'weapon' | 'skill' | 'equipment', id: number): string | undefined;
    getFireteamChart(factionId: number): FireteamChart | undefined;
    getUnitBySlug(slug: string): Unit | undefined;
    getWeaponDetails(id: number): ParsedWeapon | undefined;
}

export class DatabaseImplementation extends BaseDatabase implements IDatabase {
    private static instance: DatabaseImplementation;
    public classifieds: ClassifiedObjective[] = [];

    private readonly dataBase: string;

    constructor() {
        super();
        // BASE_URL is set by Vite (e.g. "/" in dev, "/app/" in production)
        this.dataBase = `${import.meta.env.BASE_URL}data/processed`;
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
            console.error('Failed to load classifieds', e);
        }
    }

    // ========================================================================
    // Platform-specific: Load via fetch() from static processed files
    // ========================================================================

    protected async loadMetadataFiles(): Promise<{ meta: ProcessedMetadataFile; factions: ProcessedFactionsFile }> {
        const [metaRes, factionsRes] = await Promise.all([
            fetch(`${this.dataBase}/metadata.json`),
            fetch(`${this.dataBase}/factions.json`),
        ]);

        if (!metaRes.ok) throw new Error(`Failed to load metadata: ${metaRes.status}`);
        if (!factionsRes.ok) throw new Error(`Failed to load factions: ${factionsRes.status}`);

        const [meta, factions] = await Promise.all([
            metaRes.json() as Promise<ProcessedMetadataFile>,
            factionsRes.json() as Promise<ProcessedFactionsFile>,
        ]);

        return { meta, factions };
    }

    protected async loadFactionData(slug: string): Promise<ProcessedFactionFile | null> {
        const res = await fetch(`${this.dataBase}/${slug}.json`);
        if (!res.ok) return null;
        return res.json() as Promise<ProcessedFactionFile>;
    }

    protected async loadClassifieds(): Promise<ClassifiedObjective[]> {
        const res = await fetch(`${import.meta.env.BASE_URL}data/classifieds.json`);
        if (!res.ok) {
            console.warn(`Failed to load classifieds.json: ${res.status}`);
            return [];
        }
        return res.json();
    }
}

// Deprecated export for backward compatibility
export const Database = DatabaseImplementation;
