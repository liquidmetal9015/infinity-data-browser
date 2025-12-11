import type { Unit, UnitRaw, DatabaseMetadata } from '../types';
import { FactionRegistry, type FactionInfo, type SuperFaction } from '../utils/factions';

export class Database {
    units: Unit[] = [];
    metadata: DatabaseMetadata | null = null;

    // Maps ID -> Name
    factionMap: Map<number, string> = new Map();
    weaponMap: Map<number, string> = new Map();
    skillMap: Map<number, string> = new Map();
    equipmentMap: Map<number, string> = new Map();

    // Extras map: ID -> display string (e.g., 6 -> "-3", 7 -> "-6")
    extrasMap: Map<number, string> = new Map();

    // Deduplication map: ISC -> Unit
    private unitsByISC: Map<string, Unit> = new Map();

    // Loaded faction slugs (files we actually found)
    private loadedSlugs: string[] = [];

    // Faction registry with grouping and short names
    factionRegistry: FactionRegistry | null = null;

    private static instance: Database;

    private constructor() { }

    static getInstance(): Database {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }

    async init() {
        if (this.metadata) return; // Already initialized

        console.log("Initializing Database...");

        // 1. Load Metadata
        try {
            const metaRes = await fetch(import.meta.env.BASE_URL + 'data/metadata.json');
            this.metadata = await metaRes.json();

            this.metadata?.factions.forEach(f => this.factionMap.set(f.id, f.name));
            this.metadata?.weapons.forEach(w => this.weaponMap.set(w.id, w.name));
            this.metadata?.skills.forEach(s => this.skillMap.set(s.id, s.name));
            this.metadata?.equips.forEach(e => this.equipmentMap.set(e.id, e.name));
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

    // Legacy search method (OR logic only)
    search(criteria: { weapon?: string; skill?: string; equip?: string }) {
        const weaponIds = this.findIds(criteria.weapon, this.weaponMap);
        const skillIds = this.findIds(criteria.skill, this.skillMap);
        const equipIds = this.findIds(criteria.equip, this.equipmentMap);

        if (weaponIds.length === 0 && skillIds.length === 0 && equipIds.length === 0) {
            return [];
        }

        return this.units.filter(u => {
            if (weaponIds.some(id => u.allWeaponIds.has(id))) return true;
            if (skillIds.some(id => u.allSkillIds.has(id))) return true;
            if (equipIds.some(id => u.allEquipmentIds.has(id))) return true;
            return false;
        });
    }

    // New advanced search with AND/OR support and modifier matching
    searchAdvanced(filters: Array<{
        type: 'weapon' | 'skill' | 'equipment';
        matchedIds: number[];
    }>, operator: 'and' | 'or'): Unit[] {
        if (filters.length === 0) {
            return [];
        }

        return this.units.filter(unit => {
            const filterResults = filters.map(filter => {
                switch (filter.type) {
                    case 'weapon':
                        return filter.matchedIds.some(id => unit.allWeaponIds.has(id));
                    case 'skill':
                        return filter.matchedIds.some(id => unit.allSkillIds.has(id));
                    case 'equipment':
                        return filter.matchedIds.some(id => unit.allEquipmentIds.has(id));
                    default:
                        return false;
                }
            });

            if (operator === 'and') {
                return filterResults.every(r => r);
            } else {
                return filterResults.some(r => r);
            }
        });
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

    private findIds(query: string | undefined, map: Map<number, string>): number[] {
        if (!query) return [];
        const q = query.toLowerCase();
        const ids: number[] = [];
        for (const [id, name] of map.entries()) {
            if (name.toLowerCase().includes(q)) {
                ids.push(id);
            }
        }
        return ids;
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
}
