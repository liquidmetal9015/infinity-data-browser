import fs from 'node:fs/promises';
import path from 'node:path';
import type {
    ProcessedUnit,
    ProcessedFaction,
    ProcessedFactionFile,
    ProcessedFactionsFile,
    ProcessedMetadataFile,
} from '@shared/game-model';
import type { Fireteam, FireteamChart } from '@shared/types';

export interface ClassifiedObjective {
    name: string;
    category?: string;
    designatedTroopers?: string[];
}

export class GameDataLoader {
    private static instance: GameDataLoader | null = null;
    private dataDir: string | null = null;
    private initialized = false;
    private initPromise: Promise<void> | null = null;

    units: ProcessedUnit[] = [];
    unitsBySlug: Map<string, ProcessedUnit> = new Map();
    unitsById: Map<number, ProcessedUnit> = new Map();
    unitsByFaction: Map<number, ProcessedUnit[]> = new Map();

    factions: ProcessedFaction[] = [];
    factionsById: Map<number, ProcessedFaction> = new Map();
    fireteamCharts: Map<number, FireteamChart> = new Map();

    metadata: ProcessedMetadataFile | null = null;
    classifieds: ClassifiedObjective[] = [];
    ruleSummaries: Record<string, unknown> = {};

    static getInstance(): GameDataLoader {
        if (!this.instance) this.instance = new GameDataLoader();
        return this.instance;
    }

    async initialize(dataDir: string): Promise<void> {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;
        this.dataDir = dataDir;
        this.initPromise = this.runInit();
        return this.initPromise;
    }

    private async runInit(): Promise<void> {
        await Promise.all([
            this.loadMetadata(),
            this.loadFactionsAndUnits(),
            this.loadClassifieds(),
            this.loadRuleSummaries(),
        ]);
        this.initialized = true;
    }

    private async readJson<T>(rel: string): Promise<T | null> {
        if (!this.dataDir) return null;
        const fullPath = path.join(this.dataDir, rel);
        try {
            const text = await fs.readFile(fullPath, 'utf-8');
            return JSON.parse(text) as T;
        } catch (e) {
            const code = (e as NodeJS.ErrnoException).code;
            if (code !== 'ENOENT') {
                console.warn(`Failed to read ${fullPath}:`, (e as Error).message);
            }
            return null;
        }
    }

    private async loadMetadata(): Promise<void> {
        this.metadata = await this.readJson<ProcessedMetadataFile>('processed/metadata.json');
    }

    private async loadFactionsAndUnits(): Promise<void> {
        const factionsFile = await this.readJson<ProcessedFactionsFile>('processed/factions.json');
        if (!factionsFile) {
            console.warn('GameDataLoader: factions.json not found; agent will operate without catalog data.');
            return;
        }

        this.factions = factionsFile.factions;
        for (const f of this.factions) {
            this.factionsById.set(f.id, f);
            if (f.fireteams) {
                this.fireteamCharts.set(f.id, {
                    spec: f.fireteams.spec,
                    teams: f.fireteams.compositions as unknown as Fireteam[],
                });
            }
        }

        const factionFiles = await Promise.all(
            this.factions.map(f => this.readJson<ProcessedFactionFile>(`processed/${f.slug}.json`)),
        );

        const seenIscs = new Set<string>();
        for (const file of factionFiles) {
            if (!file) continue;
            for (const u of file.units) {
                if (seenIscs.has(u.isc)) continue;
                seenIscs.add(u.isc);
                this.units.push(u);
                this.unitsBySlug.set(u.slug, u);
                this.unitsById.set(u.id, u);
                for (const fid of u.factionIds) {
                    const arr = this.unitsByFaction.get(fid) ?? [];
                    arr.push(u);
                    this.unitsByFaction.set(fid, arr);
                }
            }
        }
    }

    private async loadClassifieds(): Promise<void> {
        const data = await this.readJson<ClassifiedObjective[]>('classifieds.json');
        if (data) this.classifieds = data;
    }

    private async loadRuleSummaries(): Promise<void> {
        const data = await this.readJson<Record<string, unknown>>('rule_summaries.json');
        if (data) this.ruleSummaries = data;
    }

    /** Block until initialize() resolves. Routes that may fire before initialize completes can await this. */
    async ready(): Promise<void> {
        if (this.initialized) return;
        if (this.initPromise) await this.initPromise;
    }
}
