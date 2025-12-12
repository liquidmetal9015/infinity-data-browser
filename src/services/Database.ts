import type { Unit, UnitRaw, DatabaseMetadata, SearchSuggestion, FireteamChart } from '../types';
import { FactionRegistry, type FactionInfo, type SuperFaction } from '../utils/factions';

export interface IDatabase {
    units: Unit[];
    metadata: DatabaseMetadata | null;
    init(): Promise<void>;
    searchWithModifiers(filters: Array<{
        type: 'weapon' | 'skill' | 'equipment';
        baseId: number;
        modifiers: number[];
        matchAnyModifier: boolean;
    }>, operator: 'and' | 'or'): Unit[];
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
}

export class DatabaseImplementation implements IDatabase {
    units: Unit[] = [];
    metadata: DatabaseMetadata | null = null;

    // Maps ID -> Name
    factionMap: Map<number, string> = new Map();
    weaponMap: Map<number, string> = new Map();
    skillMap: Map<number, string> = new Map();
    equipmentMap: Map<number, string> = new Map();

    // Maps ID -> Wiki URL
    weaponWikiMap: Map<number, string> = new Map();
    skillWikiMap: Map<number, string> = new Map();
    equipmentWikiMap: Map<number, string> = new Map();

    // Map Faction ID -> FireteamChart
    fireteamData: Map<number, FireteamChart> = new Map();

    // Extras map: ID -> display string (e.g., 6 -> "-3", 7 -> "-6")
    extrasMap: Map<number, string> = new Map();

    // Deduplication map: ISC -> Unit
    private unitsByISC: Map<string, Unit> = new Map();
    // Helper map: Slug -> Unit (for fireteam resolution)
    private unitsBySlug: Map<string, Unit> = new Map();

    // Loaded faction slugs (files we actually found)
    private loadedSlugs: string[] = [];

    // Faction registry with grouping and short names
    factionRegistry: FactionRegistry | null = null;

    private static instance: DatabaseImplementation;

    constructor() { }

    static getInstance(): DatabaseImplementation {
        if (!DatabaseImplementation.instance) {
            DatabaseImplementation.instance = new DatabaseImplementation();
        }
        return DatabaseImplementation.instance;
    }

    async init() {
        if (this.metadata) return; // Already initialized

        console.log("Initializing Database...");

        // 1. Load Metadata
        try {
            const metaRes = await fetch(import.meta.env.BASE_URL + 'data/metadata.json');
            this.metadata = await metaRes.json();

            this.metadata?.factions.forEach(f => this.factionMap.set(f.id, f.name));
            this.metadata?.weapons.forEach(w => {
                this.weaponMap.set(w.id, w.name);
                if (w.wiki) this.weaponWikiMap.set(w.id, w.wiki);
            });
            this.metadata?.skills.forEach(s => {
                this.skillMap.set(s.id, s.name);
                if (s.wiki) this.skillWikiMap.set(s.id, s.wiki);
            });
            this.metadata?.equips.forEach(e => {
                this.equipmentMap.set(e.id, e.name);
                if (e.wiki) this.equipmentWikiMap.set(e.id, e.wiki);
            });
        } catch (e) {
            console.error("Failed to load metadata", e);
            throw e;
        }

        // 2. Load Army Files (including extras mappings)
        if (!this.metadata) return;

        const loadResults = await Promise.all(
            this.metadata.factions.map(async (faction) => {
                if (!faction.slug) return null;
                const filename = `${import.meta.env.BASE_URL}data/${faction.slug}.json`;
                try {
                    const res = await fetch(filename);
                    if (!res.ok) return null;
                    const data = await res.json();

                    // Load extras mapping from this file
                    if (data.filters?.extras) {
                        for (const extra of data.filters.extras) {
                            if (!this.extrasMap.has(extra.id)) {
                                this.extrasMap.set(extra.id, extra.name);
                            }
                        }
                    }


                    if (data.fireteamChart) {
                        // Store fireteam chart for this faction
                        this.fireteamData.set(faction.id, data.fireteamChart);
                    }

                    this.ingestUnits(data.units);
                    return faction.slug;
                } catch {
                    return null;
                }
            })
        );

        // Track which slugs we actually loaded
        this.loadedSlugs = loadResults.filter((s): s is string => s !== null);

        // 3. Build faction registry with loaded slugs
        this.factionRegistry = new FactionRegistry(
            this.metadata.factions,
            this.loadedSlugs
        );

        // Convert deduped map to array
        this.units = Array.from(this.unitsByISC.values());
        console.log(`Database loaded. ${this.units.length} unique units. ${this.loadedSlugs.length} factions with data.`);
    }

    private ingestUnits(rawUnits: UnitRaw[]) {
        for (const u of rawUnits) {
            // Check if unit already exists (by ISC)
            const existing = this.unitsByISC.get(u.isc);

            if (existing) {
                // Merge faction lists
                const existingFactions = new Set(existing.factions);
                u.factions.forEach(fid => existingFactions.add(fid));
                existing.factions = Array.from(existingFactions);
                continue;
            }

            // Compute points range
            let minPts = Infinity;
            let maxPts = -Infinity;

            // Track items with modifiers (for deduplication)
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

            // Index by slug if available, otherwise by ISC (slugified)
            if (u.slug) {
                this.unitsBySlug.set(u.slug, unit);
            }
            // Also store by ISC as fallback
            this.unitsBySlug.set(u.isc, unit);
            // And a simple lower-case slug
            this.unitsBySlug.set(u.isc.toLowerCase().replace(/[^a-z0-9]+/g, '-'), unit);

            // Compute Access (weapons, skills, equipment) and points
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
                    o.skills?.forEach((s: any) => {
                        unit.allSkillIds.add(s.id);
                        addItemWithMod(s.id, 'skill', s.extra);
                    });
                    o.equip?.forEach((e: any) => {
                        unit.allEquipmentIds.add(e.id);
                        addItemWithMod(e.id, 'equipment', e.extra);
                    });
                    o.weapons?.forEach((w: any) => {
                        unit.allWeaponIds.add(w.id);
                        addItemWithMod(w.id, 'weapon', w.extra);
                    });

                    // Track points range
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

            // Set points range (default to 0 if no options found)
            unit.pointsRange = [
                minPts === Infinity ? 0 : minPts,
                maxPts === -Infinity ? 0 : maxPts
            ];


            this.unitsByISC.set(u.isc, unit);
        }
    }

    // Modifier-aware search
    searchWithModifiers(filters: Array<{
        type: 'weapon' | 'skill' | 'equipment';
        baseId: number;
        modifiers: number[];
        matchAnyModifier: boolean;
    }>, operator: 'and' | 'or'): Unit[] {
        if (filters.length === 0) {
            return [];
        }

        return this.units.filter(unit => {
            const filterResults = filters.map(filter => {
                // Find matching items in the unit
                const matchingItems = unit.allItemsWithMods.filter(item => {
                    if (item.type !== filter.type) return false;
                    if (item.id !== filter.baseId) return false;

                    // If matchAnyModifier is true, any variant matches
                    if (filter.matchAnyModifier) return true;

                    // Otherwise, modifiers must match exactly
                    if (filter.modifiers.length === 0 && item.modifiers.length === 0) return true;
                    if (filter.modifiers.length !== item.modifiers.length) return false;
                    return filter.modifiers.every((m, i) => item.modifiers[i] === m);
                });

                return matchingItems.length > 0;
            });

            if (operator === 'and') {
                return filterResults.every(r => r);
            } else {
                return filterResults.some(r => r);
            }
        });
    }

    getFactionName(id: number): string {
        return this.factionMap.get(id) || `Unknown (${id})`;
    }

    // Get short faction name
    getFactionShortName(id: number): string {
        return this.factionRegistry?.getShortName(id) || this.getFactionName(id);
    }

    // Get faction info
    getFactionInfo(id: number): FactionInfo | undefined {
        return this.factionRegistry?.getFaction(id);
    }

    // Get grouped factions for filtering UI
    getGroupedFactions(): SuperFaction[] {
        return this.factionRegistry?.getGroupedFactions() || [];
    }

    // Check if faction has data
    factionHasData(id: number): boolean {
        return this.factionRegistry?.hasData(id) || false;
    }

    // Get search suggestions
    getSuggestions(query: string): SearchSuggestion[] {
        if (!query.trim()) return [];

        const allVariants = this.getAllItemVariants();
        const q = query.toLowerCase();

        const matches = allVariants.filter(v =>
            v.name.toLowerCase().includes(q) ||
            v.displayName.toLowerCase().includes(q)
        );

        // Sort: exact matches first, then "any" variants, then by name
        return matches.sort((a, b) => {
            const aLower = a.name.toLowerCase();
            const bLower = b.name.toLowerCase();

            // Exact match on base name
            if (aLower === q && bLower !== q) return -1;
            if (bLower === q && aLower !== q) return 1;

            // "Any" variants (isAnyVariant=true) come first among same-named items
            if (a.isAnyVariant && !b.isAnyVariant && a.name === b.name) return -1;
            if (!a.isAnyVariant && b.isAnyVariant && a.name === b.name) return 1;

            // Base items (no modifiers) come next among same-named items
            const aIsBase = a.modifiers.length === 0;
            const bIsBase = b.modifiers.length === 0;
            if (aIsBase && !bIsBase && a.name === b.name) return -1;
            if (!aIsBase && bIsBase && a.name === b.name) return 1;

            // Group by name, then by modifier
            const nameCompare = a.name.localeCompare(b.name);
            if (nameCompare !== 0) return nameCompare;

            // Within same name, sort by modifier value
            const aMod = a.modifiers[0] || 0;
            const bMod = b.modifiers[0] || 0;
            return bMod - aMod;  // Higher modifiers first (e.g., -6 before -3)
        });
    }

    private cachedVariants: SearchSuggestion[] | null = null;

    private getAllItemVariants(): SearchSuggestion[] {
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

        // Also add "any variant" options for items that have modifiers
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

        // Add "any" variant for items with modifiers
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

    private formatModifier(mods: number[]): string {
        if (mods.length === 0) return '';
        const parts = mods.map(modId => {
            const displayValue = this.extrasMap.get(modId);
            return displayValue ? `(${displayValue})` : `(${modId})`;
        });
        return parts.join(' ');
    }

    getFireteamChart(factionId: number): FireteamChart | undefined {
        return this.fireteamData.get(factionId);
    }

    getUnitBySlug(slug: string): Unit | undefined {
        return this.unitsBySlug.get(slug);
    }

    getWikiLink(type: 'weapon' | 'skill' | 'equipment', id: number): string | undefined {
        switch (type) {
            case 'weapon': return this.weaponWikiMap.get(id);
            case 'skill': return this.skillWikiMap.get(id);
            case 'equipment': return this.equipmentWikiMap.get(id);
        }
    }
}

// Deprecated export for backward compatibility during refactor
export const Database = DatabaseImplementation;

