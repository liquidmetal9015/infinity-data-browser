import { parseWeapon } from './weapon-utils.js';
import type { ParsedWeapon } from './types.js';
import type {
    Unit,
    UnitRaw,
    DatabaseMetadata,
    SearchSuggestion,
    FireteamChart,
    FactionInfo,
    SuperFaction,
    SearchFilter,
    RuleSummariesData,
    RuleSummary,
} from './types.js';
import { FactionRegistry } from './factions.js';

// ============================================================================
// Types for data loading
// ============================================================================

export interface FactionDataFile {
    units: UnitRaw[];
    filters?: {
        extras?: Array<{ id: number; name: string; type?: string }>;
    };
    fireteamChart?: FireteamChart;
}

// Re-export SearchFilter for convenience
export type { SearchFilter };

// ============================================================================
// Abstract Base Database
// ============================================================================

export abstract class BaseDatabase {
    units: Unit[] = [];
    metadata: DatabaseMetadata | null = null;

    // Maps ID -> Name
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

    // Extras map: ID -> display string (e.g., 6 -> "-3")
    extrasMap: Map<number, string> = new Map();
    protected distanceExtras: Set<number> = new Set();

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

    protected abstract loadMetadata(): Promise<DatabaseMetadata>;
    protected abstract loadFactionData(slug: string): Promise<FactionDataFile | null>;

    // ========================================================================
    // Shared initialization logic
    // ========================================================================

    async init(): Promise<void> {
        if (this.metadata) return; // Already initialized

        console.log("Initializing Database...");

        // 1. Load Metadata
        try {
            this.metadata = await this.loadMetadata();
            this.processMetadata(this.metadata);
        } catch (e) {
            console.error("Failed to load metadata", e);
            throw e;
        }

        // 2. Load Army Files
        if (!this.metadata) return;

        const loadResults = await Promise.all(
            this.metadata.factions.map(async (faction) => {
                if (!faction.slug) return null;
                try {
                    const data = await this.loadFactionData(faction.slug);
                    if (!data) return null;

                    // Load extras mapping
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

                    // Store fireteam chart
                    if (data.fireteamChart) {
                        this.fireteamData.set(faction.id, data.fireteamChart);
                    }

                    // Ingest units
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
    // Metadata processing
    // ========================================================================

    protected processMetadata(metadata: DatabaseMetadata): void {
        metadata.factions.forEach(f => this.factionMap.set(f.id, f.name));

        metadata.weapons.forEach(w => {
            this.weaponMap.set(w.id, w.name);
            if (w.wiki) this.weaponWikiMap.set(w.id, w.wiki);

            // Parse full weapon stats
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

    // Add Getter for Weapon Details
    getWeaponDetails(id: number): ParsedWeapon | undefined {
        return this.weaponDetailsMap.get(id);
    }

    // ... (rest of methods)


    // ========================================================================
    // Unit ingestion - shared logic
    // ========================================================================

    protected ingestUnits(rawUnits: UnitRaw[]): void {
        for (const u of rawUnits) {
            const existing = this.unitsByISC.get(u.isc);

            if (existing) {
                // Merge faction lists
                const existingFactions = new Set(existing.factions);
                u.factions.forEach(fid => existingFactions.add(fid));
                existing.factions = Array.from(existingFactions);
                // Map this ID to the existing unit as well
                this.unitIdMap.set(u.id, existing);
                continue;
            }

            // Compute points range
            let minPts = Infinity;
            let maxPts = -Infinity;

            // Track items with modifiers
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
                idArmy: u.idArmy,
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

            // Index by slug
            if (u.slug) {
                this.unitsBySlug.set(u.slug, unit);
            }
            this.unitsBySlug.set(u.isc, unit);
            this.unitsBySlug.set(u.isc.toLowerCase().replace(/[^a-z0-9]+/g, '-'), unit);

            // Process profile groups
            u.profileGroups.forEach(pg => {
                pg.profiles.forEach(p => {
                    p.skills?.forEach(s => {
                        unit.allSkillIds.add(s.id);
                        addItemWithMod(s.id, 'skill', s.extra);
                    });
                    p.equip?.forEach(e => {
                        unit.allEquipmentIds.add(e.id);
                        addItemWithMod(e.id, 'equipment', e.extra);
                    });
                    p.weapons?.forEach(w => {
                        unit.allWeaponIds.add(w.id);
                        addItemWithMod(w.id, 'weapon', w.extra);
                    });
                });
                pg.options.forEach(o => {
                    o.skills?.forEach((s: { id: number; extra?: number[] }) => {
                        unit.allSkillIds.add(s.id);
                        addItemWithMod(s.id, 'skill', s.extra);
                    });
                    o.equip?.forEach((e: { id: number; extra?: number[] }) => {
                        unit.allEquipmentIds.add(e.id);
                        addItemWithMod(e.id, 'equipment', e.extra);
                    });
                    o.weapons?.forEach((w: { id: number; extra?: number[] }) => {
                        unit.allWeaponIds.add(w.id);
                        addItemWithMod(w.id, 'weapon', w.extra);
                    });

                    if (o.points !== undefined) {
                        if (o.points < minPts) minPts = o.points;
                        if (o.points > maxPts) maxPts = o.points;
                    }
                });
            });

            // Populate allItemsWithMods with names
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

            unit.pointsRange = [
                minPts === Infinity ? 0 : minPts,
                maxPts === -Infinity ? 0 : maxPts
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
                // Skip stat filters - they're handled differently
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

            const nameCompare = a.name.localeCompare(b.name);
            if (nameCompare !== 0) return nameCompare;

            const aMod = a.modifiers[0] || 0;
            const bMod = b.modifiers[0] || 0;
            return bMod - aMod;
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
                    const modDisplay = this.formatModifier(item.modifiers);
                    variants.set(key, {
                        id: item.id,
                        name: item.name,
                        displayName: modDisplay ? `${item.name}${modDisplay}` : item.name,
                        type: item.type,
                        modifiers: item.modifiers,
                        isAnyVariant: false
                    });
                }
            }
        }

        // Add "any variant" options
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
                    isAnyVariant: true
                });
            }
        }

        this.cachedVariants = Array.from(variants.values());
        return this.cachedVariants;
    }

    protected formatModifier(mods: number[]): string {
        if (mods.length === 0) return '';
        const parts = mods.map(modId => {
            const displayValue = this.getExtraName(modId);
            return displayValue ? `(${displayValue})` : `(${modId})`;
        });
        return parts.join(' ');
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

    getExtraName(id: number): string | undefined {
        const name = this.extrasMap.get(id);
        if (!name) return undefined;

        // Convert distance modifiers from cm to inches
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

    // ========================================================================
    // Rule Summaries (for agent context enrichment)
    // ========================================================================

    setRuleSummaries(data: RuleSummariesData): void {
        this.ruleSummaries = data;
    }

    getRuleSummary(type: 'skill' | 'equipment', id: number): RuleSummary | undefined {
        if (!this.ruleSummaries) return undefined;
        const idStr = String(id);
        if (type === 'skill') {
            return this.ruleSummaries.skills[idStr];
        } else {
            return this.ruleSummaries.equipment[idStr];
        }
    }

    hasRuleSummaries(): boolean {
        return this.ruleSummaries !== null;
    }
}

