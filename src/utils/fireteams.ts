
import type { Unit, Fireteam, FireteamUnit } from '../types';

export interface FireteamBonus {
    level: number;
    description: string;
    isActive: boolean;
}

export interface UnitFireteamAnalysis {
    canJoin: boolean;
    canPureDuo: boolean;
    canPureHaris: boolean;
    canPureCore: boolean;
    countsAs: string[]; // List of unit names/types this unit counts as
}

/**
 * Parses the comment field to find "Counts as" tags.
 * Also checks if the unit acts as a Wildcard.
 */
export function getUnitTags(name: string, comment?: string): string[] {
    const tags = new Set<string>();

    // Always counts as itself (normalized)
    tags.add(name.toLowerCase());

    if (comment) {
        const lower = comment.toLowerCase();
        // Check for Wildcard
        if (lower.includes('wildcard')) {
            tags.add('wildcard');
        }

        // Parse parenthesis
        const clean = lower.replace(/[()]/g, '');
        const parts = clean.split(/,|counts as/);
        parts.forEach(p => {
            const t = p.trim();
            if (t) tags.add(t);
        });
    }

    return Array.from(tags);
}

/**
 * Calculates the "Fireteam Level" based on the composition and team identity.
 * Rule: Level is determined by the number of models that count as the "Team Unit".
 */
export function calculateFireteamLevel(teamName: string, members: { name: string, comment?: string }[]): number {
    if (members.length === 0) return 0;

    // 1. Identify the Target Unit Type from the Team Name
    // Heuristic: remove " Fireteam", " Duo", etc, and use the first word or the full name.
    // e.g. "Fusilier Fireteam" -> "fusilier"
    // e.g. "Fennecs" -> "fennec" (normalized)
    const normalizedTeamName = teamName.toLowerCase()
        .replace(/ fireteam| core| haris| duo/g, '')
        .trim();

    // 2. Count members that match this type (or are Wildcards)
    let matchingCount = 0;

    // We also need to handle the case where the Team Name doesn't match the units (e.g. "WinterFor").
    // In those cases, usually ALL listed units count.
    // However, to distinguish "Pure" (Level 2+) from "Mixed", we usually need a majority or specific key.
    // For this generic builder, we'll try to find the "Most Common Tag" among members if the Team Name doesn't match?
    // Actually, N4 says: "named after".

    // Let's refine the matching:
    // If a member has a tag that includes the normalizedTeamName (partial match), it counts.
    // e.g. "fennec" matches "fennecs".

    // Edge Case: If normalizedTeamName is vague, maybe check if ANY tag matches?

    members.forEach(m => {
        const tags = getUnitTags(m.name, m.comment);

        const isMatch = tags.some(t => {
            if (t === 'wildcard') return true;
            // distinct fuzzy match
            return normalizedTeamName.includes(t) || t.includes(normalizedTeamName);
        });

        if (isMatch) {
            matchingCount++;
        }
    });

    // Fallback? If matchingCount is low but team size is high, 
    // maybe we failed to guess the team name (e.g. "WinterFor")
    // In a Sectorial Dictionary file, we might assume if they are IN the list, they count?
    // But usually only "keyword" matches get the composition bonus.
    // For now, stricter is safer. If the user builds a "WinterFor" team with "Karhus", 
    // and "Karhu" doesn't matches "WinterFor", they get Level 0/1 bonuses. 
    // This highlights that the team identification is important.

    // Let's stick to the "Counts As" logic. If the roster says "Karhu (WinterFor)", it would match.
    // If it doesn't, maybe they don't get the pure bonus.

    return matchingCount;
}

/**
 * Calculates current bonuses for a given composition
 */
export function getFireteamBonuses(
    team: Fireteam,
    members: { name: string, comment?: string }[]
): FireteamBonus[] {
    // Current Level based on composition
    const levelCount = calculateFireteamLevel(team.name, members);
    const size = members.length;

    // 1. Check strict Team Type restrictions (Size)
    // DUO: Size 2
    // HARIS: Size 3
    // CORE: Size 3-5

    let isSizeValid = false;
    if (team.type.includes('DUO') && size === 2) isSizeValid = true;
    if (team.type.includes('HARIS') && size === 3) isSizeValid = true;
    if (team.type.includes('CORE') && size >= 3 && size <= 5) isSizeValid = true;

    // 2. Check Minimum Unit Requirements (Individual 'min' > 0) and Group Requirements ('required: true')

    let areRequirementsMet = true;

    // Create a map of member counts
    const memberCounts = new Map<string, number>();
    members.forEach(m => {
        const name = m.name.toLowerCase();
        memberCounts.set(name, (memberCounts.get(name) || 0) + 1);
    });

    // A. Strict Min Check
    for (const unitDef of team.units) {
        if (unitDef.min > 0) {
            const count = memberCounts.get(unitDef.name.toLowerCase()) || 0;
            if (count < unitDef.min) {
                areRequirementsMet = false;
                break;
            }
        }
    }

    // B. Group Requirement Check (The "*" rule, represented by required: true)
    // If ANY unit in the team definition is marked 'required: true', 
    // then the team MUST contain at least one of the units from that 'required' set.
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

    const bonuses: FireteamBonus[] = [
        {
            level: 1,
            description: "Coherent Front: One Order activates all members.",
            isActive: isFormed
        },
        {
            level: 2,
            description: "BS Attack (+1 SD)",
            isActive: isFormed && levelCount >= 2
        },
        {
            level: 3,
            description: "+3 Discover and +1 Dodge",
            isActive: isFormed && levelCount >= 3
        },
        {
            level: 4,
            description: "+1 BS",
            isActive: isFormed && levelCount >= 4
        },
        {
            level: 5,
            description: "Sixth Sense",
            isActive: isFormed && levelCount >= 5
        }
    ];

    return bonuses;
}


/**
 * Analyzes a specific unit's ability to fit into a specific fireteam type
 */
export function analyzeUnitForTeam(
    _unit: Unit | undefined,
    team: Fireteam,
    fireteamUnitEntry: FireteamUnit
): { canJoin: boolean, canPureDuo: boolean, canPureHaris: boolean, canPureCore: boolean, countsAs: string[] } {
    const countsAs = getUnitTags(fireteamUnitEntry.name, fireteamUnitEntry.comment);

    // Check match against team name
    const normalizedTeamName = team.name.toLowerCase()
        .replace(/ fireteam| core| haris| duo/g, '')
        .trim();

    const matchesTeam = countsAs.some(t => t === 'wildcard' || t.includes(normalizedTeamName) || normalizedTeamName.includes(t));

    return {
        canJoin: true,
        canPureDuo: matchesTeam && team.type.includes('DUO'),
        canPureHaris: matchesTeam && team.type.includes('HARIS'),
        canPureCore: matchesTeam && team.type.includes('CORE'),
        countsAs
    };
}
