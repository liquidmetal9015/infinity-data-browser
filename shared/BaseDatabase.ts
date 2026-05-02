import { parseWeapon } from './weapon-utils.js';
import type { ParsedWeapon } from './types.js';
import type {
    Unit,
    DatabaseMetadata,
    SearchSuggestion,
    FireteamChart,
    FactionInfo,
    SuperFaction,
    SearchFilter,
    RuleSummariesData,
    RuleSummary,
} from './types.js';
import type {
    ProcessedUnit,
    ProcessedFactionFile,
    ProcessedMetadataFile,
    ProcessedFactionsFile,
} from './game-model.js';
import { FactionRegistry } from './factions.js';

// Re-export SearchFilter for convenience
export type { SearchFilter };

// ============================================================================
// Abstract Base Database
// ============================================================================

export abstract class BaseDatabase {
    units: Unit[] = [];
    metadata: DatabaseMetadata | null = null;

    // Maps ID -> Name (still needed for wiki link lookups)
    factionMap: Map<number, string> = new Map();
    weaponMap: Map<number, string> = new Map();
    skillMap: Map<number, string> = new Map();
    equipmentMap: Map<number, string> = new Map();

    // Detailed Weapon Stats (Parsed)
    weaponDetailsMap: Map<number, ParsedWeapon> = new Map();

    // Maps ID -> Wiki URL
    weaponWikiMap: Map<number, string> = new Map();
    skillWikiMap: Map<number, string> = new Map();
    equipmentWikiMap: Map<number, string> = new Map();

    // Map Faction ID -> FireteamChart
    fireteamData: Map<number, FireteamChart> = new Map();

    // Deduplication map: ISC -> Unit
    protected unitsByISC: Map<string, Unit> = new Map();
    // Helper map: Slug -> Unit
    protected unitsBySlug: Map<string, Unit> = new Map();
    // ID-based lookup: ID -> Unit (handles deduplicated IDs)
    protected unitIdMap: Map<number, Unit> = new Map();

    // Loaded faction slugs
    protected loadedSlugs: string[] = [];

    // Faction registry
    factionRegistry: FactionRegistry | null = null;

    // Cached suggestions
    protected cachedVariants: SearchSuggestion[] | null = null;

    // Rule summaries for agent context (optional)
    protected ruleSummaries: RuleSummariesData | null = null;

    // ========================================================================
    // Abstract methods - implemented by platform-specific subclasses
    // ========================================================================

    protected abstract loadMetadataFiles(): Promise<{ meta: ProcessedMetadataFile; factions: ProcessedFactionsFile }>;
    protected abstract loadFactionData(slug: string): Promise<ProcessedFactionFile | null>;

    // ========================================================================
    // Shared initialization logic
    // ========================================================================

    async init(): Promise<void> {
        if (this.metadata) return; // Already initialized

        console.log('Initializing Database...');

        // 1. Load Metadata + Factions list
        let metaFiles: { meta: ProcessedMetadataFile; factions: ProcessedFactionsFile };
        try {
            metaFiles = await this.loadMetadataFiles();
        } catch (e) {
            console.error('Failed to load metadata', e);
            throw e;
        }

        // Build DatabaseMetadata from processed files
        this.metadata = this.buildDatabaseMetadata(metaFiles.meta, metaFiles.factions);
        this.processMetadata(this.metadata);

        // 2. Load Faction Files
        const loadResults = await Promise.all(
            this.metadata.factions.map(async (faction) => {
                if (!faction.slug) return null;
                try {
                    const data = await this.loadFactionData(faction.slug);
                    if (!data) return null;

                    // Store fireteam chart
                    if (data.faction.fireteams) {
                        const chart: FireteamChart = {
                            spec: data.faction.fireteams.spec,
                            teams: data.faction.fireteams.compositions,
                        };
                        this.fireteamData.set(faction.id, chart);
                    }

                    this.ingestUnits(data.units);
                    return faction.slug;
                } catch {
                    return null;
                }
            })
        );

        // Track loaded slugs
        this.loadedSlugs = loadResults.filter((s): s is string => s !== null);

        // 3. Build faction registry
        this.factionRegistry = new FactionRegistry(
            this.metadata.factions,
            this.loadedSlugs
        );

        // Convert deduped map to array
        this.units = Array.from(this.unitsByISC.values());
        console.log(`Database loaded. ${this.units.length} unique units. ${this.loadedSlugs.length} factions with data.`);
    }

    // ========================================================================
    // Adapt processed files → DatabaseMetadata
    // ========================================================================

    private buildDatabaseMetadata(
        meta: ProcessedMetadataFile,
        factionsFile: ProcessedFactionsFile,
    ): DatabaseMetadata {
        return {
            factions: factionsFile.factions.map(f => ({
                id: f.id,
                parent: f.parentId ?? f.id, // null parentId means self-parent (vanilla)
                name: f.name,
                slug: f.slug,
                discontinued: f.discontinued,
                logo: f.logo,
            })),
            weapons: meta.weapons.map(w => ({
                id: w.id,
                name: w.name,
                wiki: w.wikiUrl,
                type: w.weaponType,
                burst: w.burst,
                damage: w.damage,
                saving: w.saving,
                savingNum: w.savingNum,
                ammunition: w.ammunition,
                properties: w.properties,
                distance: w.distance as DatabaseMetadata['weapons'][number]['distance'],
            })),
            skills: meta.skills.map(s => ({ id: s.id, name: s.name, wiki: s.wikiUrl })),
            equips: meta.equipment.map(e => ({ id: e.id, name: e.name, wiki: e.wikiUrl })),
            ammunitions: meta.ammunitions.map(a => ({ id: a.id, name: a.name, wiki: a.wikiUrl })),
        };
    }

    // ========================================================================
    // Metadata processing
    // ========================================================================

    protected processMetadata(metadata: DatabaseMetadata): void {
        metadata.factions.forEach(f => this.factionMap.set(f.id, f.name));

        metadata.weapons.forEach(w => {
            this.weaponMap.set(w.id, w.name);
            if (w.wiki) this.weaponWikiMap.set(w.id, w.wiki);

            const parsed = parseWeapon(w, metadata.ammunitions);
            if (parsed) {
                this.weaponDetailsMap.set(w.id, parsed);
            }
        });

        metadata.skills.forEach(s => {
            this.skillMap.set(s.id, s.name);
            if (s.wiki) this.skillWikiMap.set(s.id, s.wiki);
        });
        metadata.equips.forEach(e => {
            this.equipmentMap.set(e.id, e.name);
            if (e.wiki) this.equipmentWikiMap.set(e.id, e.wiki);
        });
    }

    getWeaponDetails(id: number): ParsedWeapon | undefined {
        return this.weaponDetailsMap.get(id);
    }

    // ========================================================================
    // Unit ingestion - shared logic
    // ========================================================================

    protected ingestUnits(processedUnits: ProcessedUnit[]): void {
        for (const u of processedUnits) {
            const existing = this.unitsByISC.get(u.isc);

            if (existing) {
                // Merge faction lists
                const existingFactions = new Set(existing.factions);
                u.factionIds.forEach(fid => existingFactions.add(fid));
                existing.factions = Array.from(existingFactions);
                this.unitIdMap.set(u.id, existing);
                continue;
            }

            const itemsWithModsMap = new Map<string, { id: number; type: 'skill' | 'equipment' | 'weapon'; name: string; modifiers: string[] }>();

            const addItem = (id: number, type: 'skill' | 'equipment' | 'weapon', name: string, modifiers: string[]) => {
                const key = `${type}-${id}-${modifiers.join(',')}`;
                if (!itemsWithModsMap.has(key)) {
                    itemsWithModsMap.set(key, { id, type, name, modifiers });
                }
            };

            const unit: Unit = {
                id: u.id,
                isc: u.isc,
                name: u.name,
                factions: [...u.factionIds],
                allWeaponIds: new Set(),
                allSkillIds: new Set(),
                allEquipmentIds: new Set(),
                allItemsWithMods: [],
                pointsRange: [0, 0],
                raw: u,
            };

            // Index by slug
            if (u.slug) this.unitsBySlug.set(u.slug, unit);
            this.unitsBySlug.set(u.isc, unit);
            this.unitsBySlug.set(u.isc.toLowerCase().replace(/[^a-z0-9]+/g, '-'), unit);

            let minPts = Infinity;
            let maxPts = -Infinity;

            for (const pg of u.profileGroups) {
                for (const p of pg.profiles) {
                    for (const s of p.skills) {
                        unit.allSkillIds.add(s.id);
                        addItem(s.id, 'skill', s.name, s.modifiers);
                    }
                    for (const e of p.equipment) {
                        unit.allEquipmentIds.add(e.id);
                        addItem(e.id, 'equipment', e.name, e.modifiers);
                    }
                    for (const w of p.weapons) {
                        unit.allWeaponIds.add(w.id);
                        addItem(w.id, 'weapon', w.name, w.modifiers);
                    }
                }

                for (const o of pg.options) {
                    for (const s of o.skills) {
                        unit.allSkillIds.add(s.id);
                        addItem(s.id, 'skill', s.name, s.modifiers);
                    }
                    for (const e of o.equipment) {
                        unit.allEquipmentIds.add(e.id);
                        addItem(e.id, 'equipment', e.name, e.modifiers);
                    }
                    for (const w of o.weapons) {
                        unit.allWeaponIds.add(w.id);
                        addItem(w.id, 'weapon', w.name, w.modifiers);
                    }

                    // Only count non-disabled options toward points range
                    if (!pg.isPeripheral && !o.disabled && o.points > 0) {
                        if (o.points < minPts) minPts = o.points;
                        if (o.points > maxPts) maxPts = o.points;
                    }
                }
            }

            unit.allItemsWithMods = Array.from(itemsWithModsMap.values());
            unit.pointsRange = [
                minPts === Infinity ? 0 : minPts,
                maxPts === -Infinity ? 0 : maxPts,
            ];

            this.unitsByISC.set(u.isc, unit);
            this.unitIdMap.set(u.id, unit);
        }
    }

    // ========================================================================
    // Search methods - shared logic
    // ========================================================================

    searchWithModifiers(filters: SearchFilter[], operator: 'and' | 'or'): Unit[] {
        if (filters.length === 0) return [];

        return this.units.filter(unit => {
            const filterResults = filters.map(filter => {
                if (filter.type === 'stat') return true;

                const matchingItems = unit.allItemsWithMods.filter(item => {
                    if (item.type !== filter.type) return false;
                    if (item.id !== filter.baseId) return false;

                    if (filter.matchAnyModifier) return true;

                    const filterMods = filter.modifiers ?? [];
                    if (filterMods.length === 0 && item.modifiers.length === 0) return true;
                    if (filterMods.length !== item.modifiers.length) return false;
                    return filterMods.every((m, i) => item.modifiers[i] === m);
                });

                return matchingItems.length > 0;
            });

            return operator === 'and'
                ? filterResults.every(r => r)
                : filterResults.some(r => r);
        });
    }

    // ========================================================================
    // Faction methods
    // ========================================================================

    getFactionName(id: number): string {
        return this.factionMap.get(id) || `Unknown (${id})`;
    }

    getFactionShortName(id: number): string {
        return this.factionRegistry?.getShortName(id) || this.getFactionName(id);
    }

    getFactionInfo(id: number): FactionInfo | undefined {
        return this.factionRegistry?.getFaction(id);
    }

    getGroupedFactions(): SuperFaction[] {
        return this.factionRegistry?.getGroupedFactions() || [];
    }

    factionHasData(id: number): boolean {
        return this.factionRegistry?.hasData(id) || false;
    }

    // ========================================================================
    // Suggestions
    // ========================================================================

    getSuggestions(query: string): SearchSuggestion[] {
        if (!query.trim()) return [];

        const allVariants = this.getAllItemVariants();
        const q = query.toLowerCase();

        const matches = allVariants.filter(v =>
            v.name.toLowerCase().includes(q) ||
            v.displayName.toLowerCase().includes(q)
        );

        return matches.sort((a, b) => {
            const aLower = a.name.toLowerCase();
            const bLower = b.name.toLowerCase();

            if (aLower === q && bLower !== q) return -1;
            if (bLower === q && aLower !== q) return 1;

            if (a.isAnyVariant && !b.isAnyVariant && a.name === b.name) return -1;
            if (!a.isAnyVariant && b.isAnyVariant && a.name === b.name) return 1;

            const aIsBase = a.modifiers.length === 0;
            const bIsBase = b.modifiers.length === 0;
            if (aIsBase && !bIsBase && a.name === b.name) return -1;
            if (!aIsBase && bIsBase && a.name === b.name) return 1;

            return a.name.localeCompare(b.name);
        });
    }

    protected getAllItemVariants(): SearchSuggestion[] {
        if (this.cachedVariants) return this.cachedVariants;

        const variants = new Map<string, SearchSuggestion>();

        for (const unit of this.units) {
            for (const item of unit.allItemsWithMods) {
                const modKey = item.modifiers.join(',');
                const key = `${item.type}-${item.id}-${modKey}`;

                if (!variants.has(key)) {
                    const displayName = item.modifiers.length > 0
                        ? `${item.name}(${item.modifiers.join(', ')})`
                        : item.name;
                    variants.set(key, {
                        id: item.id,
                        name: item.name,
                        displayName,
                        type: item.type,
                        modifiers: item.modifiers,
                        isAnyVariant: false,
                    });
                }
            }
        }

        // Add "any variant" options for items that have modifier variants
        const baseItems = new Map<string, { id: number; name: string; type: 'weapon' | 'skill' | 'equipment'; hasModifiers: boolean }>();
        for (const v of variants.values()) {
            const baseKey = `${v.type}-${v.id}`;
            if (!baseItems.has(baseKey)) {
                baseItems.set(baseKey, { id: v.id, name: v.name, type: v.type, hasModifiers: false });
            }
            if (v.modifiers.length > 0) {
                baseItems.get(baseKey)!.hasModifiers = true;
            }
        }

        for (const [baseKey, item] of baseItems.entries()) {
            if (item.hasModifiers) {
                variants.set(`${baseKey}-any`, {
                    id: item.id,
                    name: item.name,
                    displayName: `${item.name} (any)`,
                    type: item.type,
                    modifiers: [],
                    isAnyVariant: true,
                });
            }
        }

        this.cachedVariants = Array.from(variants.values());
        return this.cachedVariants;
    }

    // ========================================================================
    // Utility methods
    // ========================================================================

    getFireteamChart(factionId: number): FireteamChart | undefined {
        return this.fireteamData.get(factionId);
    }

    getUnitBySlug(slug: string): Unit | undefined {
        return this.unitsBySlug.get(slug);
    }

    getUnitById(id: number): Unit | undefined {
        return this.unitIdMap.get(id);
    }

    getWikiLink(type: 'weapon' | 'skill' | 'equipment', id: number): string | undefined {
        switch (type) {
            case 'weapon': return this.weaponWikiMap.get(id);
            case 'skill': return this.skillWikiMap.get(id);
            case 'equipment': return this.equipmentWikiMap.get(id);
        }
    }

    /** @deprecated Modifiers are now stored as display strings directly on items */
    getExtraName(_id: number): string | undefined {
        return undefined;
    }

    // ========================================================================
    // Rule Summaries (for agent context enrichment)
    // ========================================================================

    setRuleSummaries(data: RuleSummariesData): void {
        this.ruleSummaries = data;
    }

    getRuleSummary(type: 'skill' | 'equipment', id: number): RuleSummary | undefined {
        if (!this.ruleSummaries) return undefined;
        const idStr = String(id);
        return type === 'skill' ? this.ruleSummaries.skills[idStr] : this.ruleSummaries.equipment[idStr];
    }

    hasRuleSummaries(): boolean {
        return this.ruleSummaries !== null;
    }
}
