// Faction utilities and data structures

export interface FactionInfo {
    id: number;
    parentId: number;
    name: string;
    shortName: string;
    slug: string;
    discontinued: boolean;
    logo: string;
    isVanilla: boolean;  // parent === id means it's a "vanilla" or super-faction
    hasData: boolean;    // Whether we have a JSON file for this faction
}

export interface SuperFaction {
    id: number;
    name: string;
    shortName: string;
    vanilla: FactionInfo | null;  // The vanilla version (if exists)
    sectorials: FactionInfo[];    // Child sectorials
}

// Short name mappings - derive short names from full names
const SHORT_NAME_OVERRIDES: Record<string, string> = {
    'PanOceania': 'PanO',
    'Shock Army of Acontecimento': 'Acontecimento',
    'Military Orders': 'MO',
    'Neoterran Capitaline Army': 'Neoterra',
    'Varuna Immediate Reaction Division': 'Varuna',
    "Svalarheima's Winter Force": 'Svalarheima',
    'Kestrel Colonial Force': 'Kestrel',
    'Yu Jing': 'Yu Jing',
    'Imperial Service': 'ISS',
    'Invincible Army': 'IA',
    'White Banner': 'White Banner',
    'Ariadna': 'Ariadna',
    'Caledonian Highlander Army': 'Caledonia',
    'Force de Réponse Rapide Merovingienne': 'Merovingienne',
    'USAriadna Ranger Force': 'USAriadna',
    'Tartary Army Corps': 'Tartary',
    'Kosmoflot': 'Kosmoflot',
    'Haqqislam': 'Haqq',
    'Hassassin Bahram': 'Hassassins',
    'Qapu Khalqi': 'QK',
    'Ramah Taskforce': 'Ramah',
    'Nomads': 'Nomads',
    'Jurisdictional Command of Corregidor': 'Corregidor',
    'Jurisdictional Command of Bakunin': 'Bakunin',
    'Jurisdictional Command of Tunguska': 'Tunguska',
    'Combined Army': 'CA',
    'Morat Aggression Force': 'Morats',
    'Shasvastii Expeditionary Force': 'Shas',
    'Onyx Contact Force': 'Onyx',
    'ALEPH': 'ALEPH',
    'Steel Phalanx': 'Steel Phalanx',
    'Operations Subsection of the S.S.S.': 'OSS',
    'O-12': 'O-12',
    'Starmada': 'Starmada',
    'Torchlight Brigade': 'Torchlight',
    'Tohaa': 'Tohaa',
    'Non-Aligned Armies': 'NA2',
    'Foreign Company': 'Foreign Co.',
    'Ikari Company': 'Ikari',
    'Dahshat Company': 'Dahshat',
    'Druze Bayram Security': 'Druze',
    'StarCo. Free Company of the Star': 'StarCo',
    'White Company': 'White Co.',
    'Japanese Secessionist Army': 'JSA',
    'Shindenbutai': 'Shinden',
};

// Derive a short name from full name if not in overrides
function deriveShortName(fullName: string): string {
    if (SHORT_NAME_OVERRIDES[fullName]) {
        return SHORT_NAME_OVERRIDES[fullName];
    }

    // Try to extract a meaningful short name
    // Remove common suffixes
    let short = fullName
        .replace(/\s+(Force|Army|Division|Corps|Company|Taskforce|Brigade|Command)$/i, '')
        .replace(/^(Jurisdictional Command of|Operations Subsection of the)\s+/i, '');

    // If still too long, take first word or first two words
    const words = short.split(/\s+/);
    if (short.length > 15 && words.length > 1) {
        short = words[0];
    }

    return short;
}

export class FactionRegistry {
    private factions: Map<number, FactionInfo> = new Map();
    private superFactions: Map<number, SuperFaction> = new Map();
    private validFactionSlugs: Set<string> = new Set();

    constructor(
        rawFactions: Array<{
            id: number;
            parent: number;
            name: string;
            slug: string;
            discontinued: boolean;
            logo: string;
        }>,
        availableSlugs: string[]  // Slugs from JSON files we have
    ) {
        // Build set of valid slugs
        this.validFactionSlugs = new Set(availableSlugs);
        const processedSlugs = new Set<string>();

        // First pass: create FactionInfo for each faction, deduplicating by slug
        for (const raw of rawFactions) {
            if (processedSlugs.has(raw.slug)) continue;
            processedSlugs.add(raw.slug);

            // Fix parent ID for Reinforcements (ids ending in 91 usually parented to x01)
            // e.g. 191 (PanO Reinf) -> 101 (PanO)
            let parentId = raw.parent;
            if (parentId % 100 === 91) {
                // Try to map to the main faction (x01)
                const mainId = Math.floor(parentId / 100) * 100 + 1;
                // Special case: 991 (NA2/Mercs) -> 901 (Non-Aligned)
                // Special case: 1091 (Teams Gladius / O-12) -> 1001 (O-12)
                parentId = mainId;
            }

            // Special handling for JSA (1101) to be under Non-Aligned (901) or standalone?
            // Metadata puts JSA at 1101 with parent 1101. It often sits apart or under NA2.
            // For now, leave as is (Standalone).

            const info: FactionInfo = {
                id: raw.id,
                parentId: parentId,
                name: raw.name,
                shortName: deriveShortName(raw.name),
                slug: raw.slug,
                discontinued: raw.discontinued,
                logo: `/logos/factions/${raw.slug}.svg`,
                isVanilla: raw.id === raw.parent, // Use original parent for vanilla check? No, rely on mapped ID.
                hasData: this.validFactionSlugs.has(raw.slug)
            };

            // Re-evaluate isVanilla after remapping? 
            // If we remapped parent, then `id !== parent` usually.
            // Exception: If we remapped a vanilla faction's parent... but vanilla has id==parent.
            // Reinforcements (199) had parent 191. Remapped to 101. 199 != 101. So not vanilla. Correct.

            this.factions.set(raw.id, info);
        }

        // Second pass: build SuperFaction structure
        for (const faction of this.factions.values()) {
            // Check if this faction is a root/vanilla faction
            // A faction is a root if:
            // 1. It marks itself as vanilla (id == raw.parent from before?) 
            //    Wait, we need to trust the remapped parent.
            //    If we remapped 199 to 101, then 101 is the parent.
            //    101 is PanO. PanO (101) has parent 101.

            // We need to find the "SuperFaction" object for the parentId

            // If the faction IS the super faction (id === parentId)
            if (faction.id === faction.parentId) {
                if (!this.superFactions.has(faction.id)) {
                    this.superFactions.set(faction.id, {
                        id: faction.id,
                        name: faction.name,
                        shortName: faction.shortName,
                        vanilla: faction.hasData ? faction : null,
                        sectorials: []
                    });
                } else {
                    // We might have created a placeholder already?
                    const sf = this.superFactions.get(faction.id)!;
                    sf.name = faction.name;
                    sf.shortName = faction.shortName;
                    sf.vanilla = faction.hasData ? faction : null;
                }
            } else {
                // This is a child faction/sectorial
                let parent = this.superFactions.get(faction.parentId);

                if (!parent) {
                    // Parent doesn't exist yet, we must find it or create a placeholder
                    const parentFaction = this.factions.get(faction.parentId);

                    if (parentFaction) {
                        // The parent exists in our registry, just hasn't been processed into SuperFactions yet?
                        // Or maybe we process in order.
                        parent = {
                            id: faction.parentId,
                            name: parentFaction.name,
                            shortName: parentFaction.shortName,
                            vanilla: parentFaction.hasData ? parentFaction : null,
                            sectorials: []
                        };
                        this.superFactions.set(faction.parentId, parent);
                    } else {
                        // Parent key exists but no faction info (e.g. NA2 parent 900? Metadata says 901->900)
                        // Wait, NA2 (901) has parent 900 in metadata.
                        // Faction 900 doesn't exist.
                        // So NA2 is a child of 900?
                        // If 900 doesn't exist, NA2 becomes an orphan or we create 900.
                        // Ideally NA2 (901) should be a root.

                        // Fix for NA2:
                        if (faction.parentId === 900 && faction.id === 901) {
                            // Treat NA2 as root
                            this.superFactions.set(faction.id, {
                                id: faction.id,
                                name: faction.name,
                                shortName: faction.shortName,
                                vanilla: faction.hasData ? faction : null,
                                sectorials: []
                            });
                            continue; // Done with NA2
                        }

                        // Fallback placeholder
                        parent = {
                            id: faction.parentId,
                            name: `Unknown (${faction.parentId})`,
                            shortName: '?',
                            vanilla: null,
                            sectorials: []
                        };
                        this.superFactions.set(faction.parentId, parent);
                    }
                }

                if (faction.hasData) {
                    parent.sectorials.push(faction);
                }
            }
        }

        // Sort sectorials by name within each super-faction
        for (const sf of this.superFactions.values()) {
            sf.sectorials.sort((a, b) => a.name.localeCompare(b.name));
        }
    }

    getFaction(id: number): FactionInfo | undefined {
        return this.factions.get(id);
    }

    getShortName(id: number): string {
        return this.factions.get(id)?.shortName || 'Unknown';
    }

    getName(id: number): string {
        return this.factions.get(id)?.name || 'Unknown';
    }

    hasData(id: number): boolean {
        return this.factions.get(id)?.hasData || false;
    }

    getParentId(id: number): number | undefined {
        return this.factions.get(id)?.parentId;
    }

    // Get all factions that have data, grouped by super-faction
    getGroupedFactions(): SuperFaction[] {
        return Array.from(this.superFactions.values())
            .filter(sf => sf.vanilla || sf.sectorials.length > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    // Get all valid faction IDs (those with data)
    getValidFactionIds(): number[] {
        return Array.from(this.factions.values())
            .filter(f => f.hasData)
            .map(f => f.id);
    }

    // Get all faction IDs under a super-faction (including vanilla + all sectorials)
    getSuperFactionIds(superFactionId: number): number[] {
        const sf = this.superFactions.get(superFactionId);
        if (!sf) return [];

        const ids: number[] = [];
        if (sf.vanilla) ids.push(sf.vanilla.id);
        sf.sectorials.forEach(s => ids.push(s.id));
        return ids;
    }
}
