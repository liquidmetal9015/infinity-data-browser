// Fireteam utilities - shared between frontend and MCP server
import type { Unit, Fireteam, FireteamUnit, FireteamBonus, FireteamChart } from './types.js';

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

export interface SlotAssignment {
    memberIndex: number;
    slotIndex: number;
    providedTags: string[];
}

export function assignMembersToSlots(
    team: Fireteam,
    members: { name: string, comment?: string, slug?: string }[]
): SlotAssignment[] | null {
    let bestAssignments: SlotAssignment[] = [];

    const teamTags = getUnitTags(team.name.replace(/ fireteam| core| haris| duo/gi, '').trim(), '');

    function solve(memberIndex: number, currentAssigned: SlotAssignment[], currentCounts: number[]): boolean {
        if (memberIndex === members.length) {
            bestAssignments = [...currentAssigned];
            return true; // Simple greedy is fine for just "can they fit into slots"
        }

        const mTags = getUnitTags(members[memberIndex].name, members[memberIndex].comment);
        const isWildcard = mTags.includes('wildcard');
        const matchesTeam = mTags.some(t => teamTags.some(rt => t.includes(rt) || rt.includes(t)));

        for (let sIdx = 0; sIdx < team.units.length; sIdx++) {
            const slot = team.units[sIdx];
            if (currentCounts[sIdx] >= slot.max) continue;

            let matchesSlot = false;
            let sTags: string[] = [];
            // Native EXACT match via database slug
            if (members[memberIndex].slug && slot.slug && members[memberIndex].slug === slot.slug) {
                matchesSlot = true;
            } else {
                sTags = getUnitTags(slot.name, '');
                matchesSlot = mTags.some(t => sTags.some(rt => t.includes(rt) || rt.includes(t)));
            }

            let canFill = isWildcard || matchesSlot;
            if (!canFill && matchesTeam) {
                if (sTags.length === 0) sTags = getUnitTags(slot.name, '');
                const slotMatchesTeam = sTags.some(st => teamTags.some(tt => st.includes(tt) || tt.includes(st)));
                canFill = slotMatchesTeam;
            }

            if (canFill) {
                currentCounts[sIdx]++;
                const providedTags = [...mTags];
                const slotTagsAll = getUnitTags(slot.name, slot.comment);
                slotTagsAll.forEach(t => {
                    if (!providedTags.includes(t)) providedTags.push(t);
                });

                currentAssigned.push({ memberIndex, slotIndex: sIdx, providedTags });

                if (solve(memberIndex + 1, currentAssigned, currentCounts)) {
                    return true;
                }

                currentAssigned.pop();
                currentCounts[sIdx]--;
            }
        }
        return false;
    }

    const counts = new Array(team.units.length).fill(0);
    const success = solve(0, [], counts);

    if (success) return bestAssignments;
    return null;
}

/**
 * Calculates the "Fireteam Level" based on the composition and team identity.
 * Rule: Level is determined by the number of models that count as the "Team Unit".
 */
export function calculateFireteamLevel(team: Fireteam, members: { name: string, comment?: string, slug?: string }[]): number {
    if (members.length === 0) return 0;

    const assignments = assignMembersToSlots(team, members);
    if (!assignments) return 0;

    const normalizedTeamName = team.name.toLowerCase()
        .replace(/ fireteam| core| haris| duo/g, '')
        .trim();

    let matchingCount = 0;
    assignments.forEach(a => {
        const isMatch = a.providedTags.some(t => {
            if (t === 'wildcard') return true;
            return normalizedTeamName.includes(t) || t.includes(normalizedTeamName);
        });
        if (isMatch) matchingCount++;
    });

    return matchingCount;
}

/**
 * Calculates current bonuses for a given composition
 */
export function getFireteamBonuses(
    team: Fireteam,
    members: { name: string, comment?: string, slug?: string }[]
): FireteamBonus[] {
    const assignments = assignMembersToSlots(team, members);
    if (!assignments) return [];

    // Current Level based on composition
    const levelCount = calculateFireteamLevel(team, members);
    const size = members.length;

    // Check strict Team Type restrictions (Size)
    let minValidSize = 5;
    if (team.type.includes('CORE')) minValidSize = Math.min(minValidSize, 3);
    if (team.type.includes('HARIS')) minValidSize = Math.min(minValidSize, 3);
    if (team.type.includes('DUO')) minValidSize = Math.min(minValidSize, 2);

    let isSizeValid = false;
    if (size >= minValidSize) {
        if (team.type.includes('DUO') && size <= 2) isSizeValid = true;
        if (team.type.includes('HARIS') && size <= 3) isSizeValid = true;
        if (team.type.includes('CORE') && size <= 5) isSizeValid = true;
    }

    // Check Minimum Unit Requirements
    let areRequirementsMet = true;
    const slotCounts = new Array(team.units.length).fill(0);
    assignments.forEach(a => slotCounts[a.slotIndex]++);

    for (let i = 0; i < team.units.length; i++) {
        if (team.units[i].min > 0 && slotCounts[i] < team.units[i].min) {
            areRequirementsMet = false;
            break;
        }
    }

    // Group Requirement Check
    const requiredGroup = team.units.filter(u => u.required);
    if (requiredGroup.length > 0 && areRequirementsMet) {
        let hasRequiredMember = false;
        for (let i = 0; i < team.units.length; i++) {
            if (team.units[i].required && slotCounts[i] > 0) {
                hasRequiredMember = true;
                break;
            }
        }
        if (!hasRequiredMember) {
            areRequirementsMet = false;
        }
    }

    const isFormed = isSizeValid && areRequirementsMet;

    const bonuses: FireteamBonus[] = [];

    // Example Bonus structure (simplified, actual game rules require cross-referencing)
    const bonusChart = [
        { level: 1, desc: 'Coherency' },
        { level: 2, desc: '+1 B (Requires 3+ active members)' },
        { level: 3, desc: '+3 BS (Requires 4+ active members)' },
        { level: 4, desc: 'Sixth Sense (Requires 5 active members)' },
        { level: 5, desc: '+1 BS, Sixth Sense (Requires 5 active members)' }
    ];

    // Assuming DUO just gives Coherency, 3 gives up to Level 2
    // Formed checks:
    bonuses.push({
        level: 1,
        description: bonusChart[0].desc,
        isActive: isFormed && size >= 2
    });

    bonuses.push({
        level: 2,
        description: bonusChart[1].desc,
        isActive: isFormed && size >= 3 && levelCount >= 2
    });

    bonuses.push({
        level: 3,
        description: bonusChart[2].desc,
        isActive: isFormed && size >= 4 && levelCount >= 3
    });

    bonuses.push({
        level: 4,
        description: bonusChart[3].desc,
        isActive: isFormed && size >= 5 && levelCount >= 4
    });

    bonuses.push({
        level: 5,
        description: bonusChart[4].desc,
        isActive: isFormed && size === 5 && levelCount === 5
    });

    return bonuses;
}

export function getMemberWithChartData(
    chart: FireteamChart,
    unitIsc: string,
    unitSlug?: string
): { name: string, comment?: string, slug?: string } {
    let comment = '';

    // Check if the unit is a global wildcard
    const wildcardTeam = chart.teams.find(t => t.name.toLowerCase().includes('wildcard'));
    if (wildcardTeam) {
        // Try slug first, fallback to name
        const wcDef = wildcardTeam.units.find(u =>
            (unitSlug && u.slug && u.slug === unitSlug) ||
            (u.name.toLowerCase() === unitIsc.toLowerCase())
        );
        if (wcDef && wcDef.comment) {
            // It's in the Wildcards list.
            // If the comment explicitly restricts it (e.g. "(Fennec, Kestrel)"), pass the restriction.
            // Otherwise, it's a universal wildcard, so give it the 'wildcard' tag.
            if (wcDef.comment.includes('(')) {
                comment = wcDef.comment;
            } else {
                comment = 'wildcard'; // Inject universal wildcard behavior
            }
        } else if (wcDef) {
            comment = 'wildcard';
        }
    }

    return { name: unitIsc, comment, slug: unitSlug };
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

/**
 * Evaluates possible fireteams from chart given a set of member units and optional selected team info
 */
export function getPossibleFireteams(
    chart: FireteamChart,
    members: { name: string, comment?: string, slug?: string }[]
): Fireteam[] {
    if (members.length === 0) return chart.teams;

    return chart.teams.filter(team => {
        const assignments = assignMembersToSlots(team, members);
        return assignments !== null;
    });
}
