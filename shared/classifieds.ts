import type { Unit } from './types';
import type { Profile, Loadout } from './game-model.js';

// ============================================================================
// Types
// ============================================================================

export interface ClassifiedObjective {
    id: number;
    name: string;
    category: string;
    designatedTroopers: string[];
    objective: string;
    bonus?: string;
    note?: string;
}

export interface ClassifiedMatch {
    objectiveId: number;
    canComplete: boolean;
    reason: string; // e.g. "Hacker", "Veteran", "Elite Troop"
    bonusApplicable?: boolean;
}

// ============================================================================
// Logic
// ============================================================================

function normalizeCriterion(criterion: string): string {
    return criterion.trim();
}

/**
 * Checks if a specific unit profile meets a single criterion.
 * Uses embedded names from processed data — no metadata lookup needed.
 */
export function checkCriterion(
    _unit: Unit,
    profile: Profile,
    option: Loadout,
    criterion: string,
): boolean {
    const target = normalizeCriterion(criterion);

    const hasSkill = (skills: { name: string }[]) =>
        skills.some(s => s.name.toLowerCase().includes(target.toLowerCase()));

    const hasEquip = (equip: { name: string }[]) =>
        equip.some(e => e.name.toLowerCase().includes(target.toLowerCase()));

    if (hasSkill(profile.skills)) return true;
    if (hasSkill(option.skills)) return true;
    if (hasEquip(profile.equipment)) return true;
    if (hasEquip(option.equipment)) return true;

    if (target === 'Any') return true;

    return false;
}

/**
 * Analyzes a specific Unit Option (Profile + Loadout) against all Classifieds.
 */
export function getClassifiedsForOption(
    unit: Unit,
    profile: Profile,
    option: Loadout,
    classifieds: ClassifiedObjective[],
): ClassifiedMatch[] {
    return classifieds.map(cls => {
        const match = cls.designatedTroopers.find(criteria =>
            checkCriterion(unit, profile, option, criteria)
        );

        if (match) {
            return { objectiveId: cls.id, canComplete: true, reason: match };
        }

        return { objectiveId: cls.id, canComplete: false, reason: '' };
    });
}
