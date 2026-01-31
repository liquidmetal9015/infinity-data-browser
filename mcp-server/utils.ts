import type { Fireteam, FireteamUnit, FireteamChart, DatabaseMetadata, FactionInfo, SuperFaction } from './types.js';

export interface FireteamBonus {
    level: number;
    description: string;
    isActive: boolean;
}

export function getUnitTags(name: string, comment?: string): string[] {
    const tags = new Set<string>();
    tags.add(name.toLowerCase());

    if (comment) {
        const lower = comment.toLowerCase();
        if (lower.includes('wildcard')) {
            tags.add('wildcard');
        }
        const clean = lower.replace(/[()]/g, '');
        const parts = clean.split(/,|counts as/);
        parts.forEach(p => {
            const t = p.trim();
            if (t) tags.add(t);
        });
    }
    return Array.from(tags);
}

export function calculateFireteamLevel(teamName: string, members: { name: string, comment?: string }[]): number {
    if (members.length === 0) return 0;
    const normalizedTeamName = teamName.toLowerCase()
        .replace(/ fireteam| core| haris| duo/g, '')
        .trim();

    let matchingCount = 0;
    members.forEach(m => {
        const tags = getUnitTags(m.name, m.comment);
        const isMatch = tags.some(t => {
            if (t === 'wildcard') return true;
            return normalizedTeamName.includes(t) || t.includes(normalizedTeamName);
        });
        if (isMatch) matchingCount++;
    });
    return matchingCount;
}

export function getFireteamBonuses(
    team: Fireteam,
    members: { name: string, comment?: string }[]
): FireteamBonus[] {
    const levelCount = calculateFireteamLevel(team.name, members);
    const size = members.length;

    let isSizeValid = false;
    if (team.type.includes('DUO') && size === 2) isSizeValid = true;
    if (team.type.includes('HARIS') && size === 3) isSizeValid = true;
    if (team.type.includes('CORE') && size >= 3 && size <= 5) isSizeValid = true;

    // A. Strict Min Check
    let areRequirementsMet = true;
    const memberCounts = new Map<string, number>();
    members.forEach(m => {
        const name = m.name.toLowerCase();
        memberCounts.set(name, (memberCounts.get(name) || 0) + 1);
    });

    for (const unitDef of team.units) {
        if (unitDef.min > 0) {
            const count = memberCounts.get(unitDef.name.toLowerCase()) || 0;
            if (count < unitDef.min) {
                areRequirementsMet = false;
                break;
            }
        }
    }

    // B. Group Requirement Check
    const requiredGroup = team.units.filter(u => u.required);
    if (requiredGroup.length > 0) {
        let hasRequiredMember = false;
        for (const reqUnit of requiredGroup) {
            const count = memberCounts.get(reqUnit.name.toLowerCase()) || 0;
            if (count > 0) {
                hasRequiredMember = true;
                break;
            }
        }
        if (!hasRequiredMember) {
            areRequirementsMet = false;
        }
    }

    const isFormed = isSizeValid && areRequirementsMet;

    return [
        { level: 1, description: "Coherent Front: One Order activates all members.", isActive: isFormed },
        { level: 2, description: "BS Attack (+1 SD)", isActive: isFormed && levelCount >= 2 },
        { level: 3, description: "+3 Discover and +1 Dodge", isActive: isFormed && levelCount >= 3 },
        { level: 4, description: "+1 BS", isActive: isFormed && levelCount >= 4 },
        { level: 5, description: "Sixth Sense", isActive: isFormed && levelCount >= 5 }
    ];
}

// Export types for use in DatabaseAdapter
export { type FactionInfo, type SuperFaction } from './types.js';

export class FactionRegistry {
    private factions: FactionInfo[] = [];
    private loadedSlugsSet: Set<string>;

    constructor(metadataFactions: DatabaseMetadata['factions'], loadedSlugs: string[]) {
        this.loadedSlugsSet = new Set(loadedSlugs);
        this.factions = metadataFactions.map(f => ({
            id: f.id,
            name: f.name,
            slug: f.slug,
            logo: f.logo,
            parent: f.parent,
            hasData: this.loadedSlugsSet.has(f.slug)
        }));
    }

    getAllFactions(): FactionInfo[] {
        return this.factions;
    }

    getFaction(id: number): FactionInfo | undefined {
        return this.factions.find(f => f.id === id);
    }

    hasData(id: number): boolean {
        return this.getFaction(id)?.hasData || false;
    }

    getShortName(id: number): string {
        const f = this.getFaction(id);
        if (!f) return `Unknown (${id})`;
        return f.name.replace(/Jurisdictional Command of |Shock Army of |Force de Réponse Rapide |Joint |Immediate Reaction Division/g, '');
    }

    getGroupedFactions(): SuperFaction[] {
        // Group by parent
        // Use logic similar to frontend if needed
        const parents = this.factions.filter(f => f.id === f.parent);
        return parents.map(p => ({
            id: p.id,
            name: p.name,
            vanilla: p,
            sectorials: this.factions.filter(f => f.parent === p.id && f.id !== f.parent)
        }));
    }
}
