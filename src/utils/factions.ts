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

        // First pass: create FactionInfo for each faction
        for (const raw of rawFactions) {
            const info: FactionInfo = {
                id: raw.id,
                parentId: raw.parent,
                name: raw.name,
                shortName: deriveShortName(raw.name),
                slug: raw.slug,
                discontinued: raw.discontinued,
                logo: raw.logo,
                isVanilla: raw.id === raw.parent,
                hasData: this.validFactionSlugs.has(raw.slug)
            };
            this.factions.set(raw.id, info);
        }

        // Second pass: build SuperFaction structure
        for (const faction of this.factions.values()) {
            if (faction.isVanilla) {
                // This is a super-faction
                if (!this.superFactions.has(faction.id)) {
                    this.superFactions.set(faction.id, {
                        id: faction.id,
                        name: faction.name,
                        shortName: faction.shortName,
                        vanilla: faction.hasData ? faction : null,
                        sectorials: []
                    });
                }
            } else {
                // This is a sectorial - add to parent's sectorials
                let parent = this.superFactions.get(faction.parentId);
                if (!parent) {
                    // Parent doesn't exist yet, create placeholder
                    const parentFaction = this.factions.get(faction.parentId);
                    parent = {
                        id: faction.parentId,
                        name: parentFaction?.name || 'Unknown',
                        shortName: parentFaction?.shortName || '?',
                        vanilla: parentFaction?.hasData ? parentFaction : null,
                        sectorials: []
                    };
                    this.superFactions.set(faction.parentId, parent);
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
