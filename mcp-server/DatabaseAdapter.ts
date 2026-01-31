import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Unit, UnitRaw, DatabaseMetadata, SearchSuggestion, FireteamChart, WikiPage, ITSRules } from './types.js';
import { FactionRegistry, type FactionInfo, type SuperFaction } from './utils.js';

// Replicate logic from src/services/Database.ts, replacing fetch with fs
export class DatabaseAdapter {
    units: Unit[] = [];
    metadata: DatabaseMetadata | null = null;
    factionMap: Map<number, string> = new Map();
    weaponMap: Map<number, string> = new Map();
    skillMap: Map<number, string> = new Map();
    equipmentMap: Map<number, string> = new Map();
    fireteamData: Map<number, FireteamChart> = new Map();
    extrasMap: Map<number, string> = new Map();
    private distanceExtras: Set<number> = new Set();
    private unitsByISC: Map<string, Unit> = new Map();
    private unitsBySlug: Map<string, Unit> = new Map();
    private loadedSlugs: string[] = [];
    factionRegistry: FactionRegistry | null = null;
    private cachedVariants: SearchSuggestion[] | null = null;

    // Wiki Cache
    wikiPages: Map<string, WikiPage> = new Map();
    public wikiLoaded = false;

    // ITS Rules
    public itsRules: ITSRules | null = null;

    private static instance: DatabaseAdapter;
    private dataDir: string;

    constructor() {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        // Assuming mcp-server/dist/DatabaseAdapter.js -> ../../data
        // Or mcp-server/DatabaseAdapter.ts -> ../data
        // We will assume running from project root with 'tsx mcp-server/index.ts'
        this.dataDir = path.join(process.cwd(), 'data');
    }

    static getInstance(): DatabaseAdapter {
        if (!DatabaseAdapter.instance) {
            DatabaseAdapter.instance = new DatabaseAdapter();
        }
        return DatabaseAdapter.instance;
    }

    async init() {
        if (this.metadata) return;
        console.error("Initializing DatabaseAdapter...");

        try {
            const metaPath = path.join(this.dataDir, 'metadata.json');
            const metaContent = await fs.readFile(metaPath, 'utf-8');
            this.metadata = JSON.parse(metaContent);

            this.metadata?.factions.forEach(f => this.factionMap.set(f.id, f.name));
            this.metadata?.weapons.forEach(w => this.weaponMap.set(w.id, w.name));
            this.metadata?.skills.forEach(s => this.skillMap.set(s.id, s.name));
            this.metadata?.equips.forEach(e => this.equipmentMap.set(e.id, e.name));
        } catch (e) {
            console.error("Failed to load metadata", e);
            throw e;
        }

        if (!this.metadata) return;

        const loadResults = await Promise.all(
            this.metadata.factions.map(async (faction) => {
                if (!faction.slug) return null;
                const filePath = path.join(this.dataDir, `${faction.slug}.json`);
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    const data = JSON.parse(content);

                    if (data.filters?.extras) {
                        for (const extra of data.filters.extras) {
                            if (!this.extrasMap.has(extra.id)) {
                                this.extrasMap.set(extra.id, extra.name);
                                if (extra.type === 'DISTANCE') {
                                    this.distanceExtras.add(extra.id);
                                }
                            }
                        }
                    }

                    if (data.fireteamChart) {
                        this.fireteamData.set(faction.id, data.fireteamChart);
                    }

                    this.ingestUnits(data.units);
                    return faction.slug;
                } catch {
                    return null;
                }
            })
        );

        this.loadedSlugs = loadResults.filter((s): s is string => s !== null);
        this.factionRegistry = new FactionRegistry(this.metadata.factions, this.loadedSlugs);
        this.units = Array.from(this.unitsByISC.values());
        console.error(`Database loaded. ${this.units.length} units.`);
    }

    private ingestUnits(rawUnits: UnitRaw[]) {
        for (const u of rawUnits) {
            const existing = this.unitsByISC.get(u.isc);
            if (existing) {
                const existingFactions = new Set(existing.factions);
                u.factions.forEach(fid => existingFactions.add(fid));
                existing.factions = Array.from(existingFactions);
                continue;
            }

            let minPts = Infinity;
            let maxPts = -Infinity;
            const itemsWithModsMap = new Map<string, { id: number; type: 'skill' | 'equipment' | 'weapon'; modifiers: number[] }>();

            const addItemWithMod = (id: number, type: 'skill' | 'equipment' | 'weapon', extra?: number[]) => {
                const mods = extra || [];
                const key = `${type}-${id}-${mods.join(',')}`;
                if (!itemsWithModsMap.has(key)) {
                    itemsWithModsMap.set(key, { id, type, modifiers: mods });
                }
            };

            const unit: Unit = {
                id: u.id,
                isc: u.isc,
                name: u.name,
                factions: u.factions,
                allWeaponIds: new Set(),
                allSkillIds: new Set(),
                allEquipmentIds: new Set(),
                allItemsWithMods: [],
                pointsRange: [0, 0],
                raw: u
            };

            if (u.slug) this.unitsBySlug.set(u.slug, unit);
            this.unitsBySlug.set(u.isc, unit);
            this.unitsBySlug.set(u.isc.toLowerCase().replace(/[^a-z0-9]+/g, '-'), unit);

            u.profileGroups.forEach(pg => {
                pg.profiles.forEach(p => {
                    p.skills?.forEach(s => { unit.allSkillIds.add(s.id); addItemWithMod(s.id, 'skill', s.extra); });
                    p.equip?.forEach(e => { unit.allEquipmentIds.add(e.id); addItemWithMod(e.id, 'equipment', e.extra); });
                    p.weapons?.forEach(w => { unit.allWeaponIds.add(w.id); addItemWithMod(w.id, 'weapon', w.extra); });
                });
                pg.options.forEach(o => {
                    o.skills?.forEach((s: any) => { unit.allSkillIds.add(s.id); addItemWithMod(s.id, 'skill', s.extra); });
                    o.equip?.forEach((e: any) => { unit.allEquipmentIds.add(e.id); addItemWithMod(e.id, 'equipment', e.extra); });
                    o.weapons?.forEach((w: any) => { unit.allWeaponIds.add(w.id); addItemWithMod(w.id, 'weapon', w.extra); });
                    if (o.points !== undefined) {
                        if (o.points < minPts) minPts = o.points;
                        if (o.points > maxPts) maxPts = o.points;
                    }
                });
            });

            for (const item of itemsWithModsMap.values()) {
                let name = '';
                switch (item.type) {
                    case 'skill': name = this.skillMap.get(item.id) || `Skill ${item.id}`; break;
                    case 'equipment': name = this.equipmentMap.get(item.id) || `Equipment ${item.id}`; break;
                    case 'weapon': name = this.weaponMap.get(item.id) || `Weapon ${item.id}`; break;
                }
                unit.allItemsWithMods.push({
                    id: item.id,
                    name,
                    type: item.type,
                    modifiers: item.modifiers
                });
            }

            unit.pointsRange = [minPts === Infinity ? 0 : minPts, maxPts === -Infinity ? 0 : maxPts];
            this.unitsByISC.set(u.isc, unit);
        }
    }

    searchWithModifiers(filters: Array<{
        type: 'weapon' | 'skill' | 'equipment';
        baseId: number;
        modifiers: number[];
        matchAnyModifier: boolean;
    }>, operator: 'and' | 'or'): Unit[] {
        if (filters.length === 0) return [];

        return this.units.filter(unit => {
            const filterResults = filters.map(filter => {
                const matchingItems = unit.allItemsWithMods.filter(item => {
                    if (item.type !== filter.type) return false;
                    if (item.id !== filter.baseId) return false;
                    if (filter.matchAnyModifier) return true;
                    if (filter.modifiers.length === 0 && item.modifiers.length === 0) return true;
                    if (filter.modifiers.length !== item.modifiers.length) return false;
                    return filter.modifiers.every((m, i) => item.modifiers[i] === m);
                });
                return matchingItems.length > 0;
            });

            if (operator === 'and') return filterResults.every(r => r);
            return filterResults.some(r => r);
        });
    }

    getUnitBySlug(slug: string): Unit | undefined {
        return this.unitsBySlug.get(slug);
    }

    getFireteamChart(factionId: number): FireteamChart | undefined {
        return this.fireteamData.get(factionId);
    }

    getExtraName(id: number): string | undefined {
        const name = this.extrasMap.get(id);
        if (!name) return undefined;
        if (this.distanceExtras.has(id)) {
            const match = name.match(/^([+\-]?)(\d+\.?\d*)$/);
            if (match) {
                const sign = match[1] || '';
                const cmValue = parseFloat(match[2]);
                const inchValue = Math.round(cmValue * 0.4);
                return `${sign}${inchValue}"`;
            }
        }
        return name;
    }

    getSuggestions(query: string): SearchSuggestion[] {
        if (!query.trim()) return [];
        // Re-use logic if needed, or simple implementation
        // For server, let's implement basic filtering
        const allVariants = this.getAllItemVariants();
        const q = query.toLowerCase();
        return allVariants.filter(v =>
            v.name.toLowerCase().includes(q) ||
            v.displayName.toLowerCase().includes(q)
        ).slice(0, 50);
    }

    private getAllItemVariants(): SearchSuggestion[] {
        if (this.cachedVariants) return this.cachedVariants;
        // Simplified Logic for MCP adapter
        const variants: SearchSuggestion[] = [];
        const seen = new Set<string>();

        // Add basic items from maps
        this.metadata?.weapons.forEach(w => {
            variants.push({ id: w.id, name: w.name, displayName: w.name, type: 'weapon', modifiers: [], isAnyVariant: false, wiki: w.wiki });
        });
        this.metadata?.skills.forEach(s => {
            variants.push({ id: s.id, name: s.name, displayName: s.name, type: 'skill', modifiers: [], isAnyVariant: false, wiki: s.wiki });
        });
        this.metadata?.equips.forEach(e => {
            variants.push({ id: e.id, name: e.name, displayName: e.name, type: 'equipment', modifiers: [], isAnyVariant: false, wiki: e.wiki });
        });

        this.cachedVariants = variants;
        return variants;
    }

    async loadWiki() {
        if (this.wikiLoaded) return;
        try {
            const wikiDir = path.join(this.dataDir, 'wiki');
            const files = await fs.readdir(wikiDir);

            await Promise.all(files.map(async (file) => {
                if (!file.endsWith('.md')) return;
                const content = await fs.readFile(path.join(wikiDir, file), 'utf-8');
                const slug = file.replace('.md', ''); // This is the safe filename
                // Infer title from first line
                const titleMatch = content.match(/^# (.*)$/m);
                const title = titleMatch ? titleMatch[1].trim() : slug;

                // Reconstruct Source URL if possible, or leave blank?
                // The crawler saves "Source: <url>" in the file.
                const sourceMatch = content.match(/^Source: (.*)$/m);
                const url = sourceMatch ? sourceMatch[1].trim() : `https://infinitythewiki.com/${slug}`; // Fallback

                this.wikiPages.set(slug, {
                    slug,
                    title,
                    content,
                    url
                });
            }));
            this.wikiLoaded = true;
            console.error(`Loaded ${this.wikiPages.size} wiki pages.`);
        } catch (e) {
            console.error("Failed to load wiki cache:", e);
        }
    }

    getWikiPage(urlOrSlug: string): WikiPage | undefined {
        // Try exact match on slug (filename)
        if (this.wikiPages.has(urlOrSlug)) return this.wikiPages.get(urlOrSlug);

        // Try extracting slug from URL
        try {
            const urlObj = new URL(urlOrSlug);
            const pathSlug = urlObj.pathname.split('/').pop() || 'index';
            const safeSlug = pathSlug.replace(/[^a-zA-Z0-9_\-\.\(\)%]/g, '_');
            if (this.wikiPages.has(safeSlug)) return this.wikiPages.get(safeSlug);
        } catch {
            // Not a URL, maybe just a dirty slug?
            const safeSlug = urlOrSlug.replace(/[^a-zA-Z0-9_\-\.\(\)%]/g, '_');
            if (this.wikiPages.has(safeSlug)) return this.wikiPages.get(safeSlug);
        }
        return undefined;
    }

    searchWiki(query: string): WikiPage[] {
        const q = query.toLowerCase();
        const results: { page: WikiPage, score: number }[] = [];

        for (const page of this.wikiPages.values()) {
            let score = 0;
            const titleLower = page.title.toLowerCase();

            if (titleLower === q) score += 100;
            else if (titleLower.startsWith(q)) score += 50;
            else if (titleLower.includes(q)) score += 20;

            if (page.content.toLowerCase().includes(q)) score += 5;

            if (score > 0) {
                results.push({ page, score });
            }
        }

        return results.sort((a, b) => b.score - a.score).map(r => r.page).slice(0, 10);
    }

    async loadITSRules() {
        if (this.itsRules) return;
        try {
            const rulesDir = path.join(this.dataDir, 'its_rules_markdown');
            const metaPath = path.join(rulesDir, 'its_rules_meta.json');
            const contentPath = path.join(rulesDir, 'its_rules.md');

            const [metaContent, mdContent] = await Promise.all([
                fs.readFile(metaPath, 'utf-8'),
                fs.readFile(contentPath, 'utf-8')
            ]);

            const meta = JSON.parse(metaContent);

            this.itsRules = {
                toc: meta.table_of_contents,
                content: mdContent
            };
            console.error("Loaded ITS Rules.");
        } catch (e) {
            console.error("Failed to load ITS Rules:", e);
        }
    }

    getITSRuleSection(query: string) {
        if (!this.itsRules) return null;

        // 1. Find best matching TOC entry
        const q = query.toLowerCase();
        const section = this.itsRules.toc.find(t => t.title.toLowerCase().includes(q) || q.includes(t.title.toLowerCase()));

        if (!section) return null;

        // 2. Extract content
        const startPage = section.page_id;
        const sectionIndex = this.itsRules.toc.indexOf(section);
        const nextSection = this.itsRules.toc[sectionIndex + 1];

        // Find start index
        const startMarker = `<span id="page-${startPage}-0"></span>`;
        let startIndex = this.itsRules.content.indexOf(startMarker);

        // Fallback: if page marker not found try Title Header
        if (startIndex === -1) {
            const titleHeader = `# ${section.title}`;
            startIndex = this.itsRules.content.indexOf(titleHeader);
        }
        if (startIndex === -1) startIndex = 0; // Worst case

        let endIndex = this.itsRules.content.length;

        if (nextSection) {
            // Try to find next section's page marker
            const nextMarker = `<span id="page-${nextSection.page_id}-0"></span>`;
            const nextIndex = this.itsRules.content.indexOf(nextMarker);
            if (nextIndex !== -1 && nextIndex > startIndex) {
                endIndex = nextIndex;
            } else {
                // Try next section title
                const nextTitle = `# ${nextSection.title}`;
                const nextTitleIndex = this.itsRules.content.indexOf(nextTitle);
                if (nextTitleIndex !== -1 && nextTitleIndex > startIndex) {
                    endIndex = nextTitleIndex;
                }
            }
        }

        const content = this.itsRules.content.substring(startIndex, endIndex);
        return {
            title: section.title,
            content: content.trim()
        };
    }

    searchITSRules(query: string) {
        if (!this.itsRules) return [];

        // Simple line-based search for now
        const lines = this.itsRules.content.split('\n');
        const results = [];
        const q = query.toLowerCase();

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(q)) {
                // Get context
                const snippet = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 3)).join('\n');

                // Try to find which header we are under
                let header = "Unknown Section";
                for (let j = i; j >= 0; j--) {
                    if (lines[j].startsWith('#')) {
                        header = lines[j].replace(/#+\s*/, '');
                        break;
                    }
                }

                results.push({
                    header,
                    snippet
                });

                // Skip a bit to avoid many hits in same paragraph
                i += 3;
            }
            if (results.length >= 5) break;
        }
        return results;
    }
}
