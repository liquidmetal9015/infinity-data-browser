import fs from 'node:fs/promises';
import path from 'node:path';

interface MetadataEntry { id?: number; name?: string }
interface MetadataFile {
    weapons?: MetadataEntry[];
    skills?: MetadataEntry[];
    equipment?: MetadataEntry[];
}

export interface ClassifiedObjective {
    name: string;
    category?: string;
    designatedTroopers?: string[];
}

export class GameDataLoader {
    private static instance: GameDataLoader | null = null;
    private dataDir: string | null = null;
    private initialized = false;

    metadata: MetadataFile = {};
    classifieds: ClassifiedObjective[] = [];
    ruleSummaries: Record<string, unknown> = {};

    static getInstance(): GameDataLoader {
        if (!this.instance) this.instance = new GameDataLoader();
        return this.instance;
    }

    async initialize(dataDir: string): Promise<void> {
        if (this.initialized) return;
        this.dataDir = dataDir;
        await this.loadMetadata();
        await this.loadClassifieds();
        await this.loadRuleSummaries();
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
        const data = await this.readJson<MetadataFile>('processed/metadata.json');
        if (data) this.metadata = data;
    }

    private async loadClassifieds(): Promise<void> {
        const data = await this.readJson<ClassifiedObjective[]>('classifieds.json');
        if (data) this.classifieds = data;
    }

    private async loadRuleSummaries(): Promise<void> {
        const data = await this.readJson<Record<string, unknown>>('rule_summaries.json');
        if (data) this.ruleSummaries = data;
    }
}
