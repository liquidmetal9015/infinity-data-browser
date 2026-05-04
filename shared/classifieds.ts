import type { Unit } from './types';
import type { Profile, Loadout, ProfileCategoryId } from './game-model.js';
import { UnitType, ProfileCategory } from './game-model.js';

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

/**
 * Extra context needed for accurate classified matching.
 * When omitted, unit type and category-based criteria won't match.
 */
export interface MatchContext {
    profileGroupCategory?: ProfileCategoryId;
}

// ============================================================================
// Criterion aliases and special cases
// ============================================================================

/**
 * Maps classified criterion strings to the actual data they should match against.
 * Some criteria don't map cleanly to skill/equipment names in CB data.
 */
const CRITERION_ALIASES: Record<string, string> = {
    'MSV': 'Multispectral Visor',
};

/**
 * Unit type criteria — these match against profile.unitType, not skill names.
 */
const UNIT_TYPE_CRITERIA: Record<string, number> = {
    'Medium Infantry (MI)': UnitType.MI,
    'Medium Infantry': UnitType.MI,
    'Heavy Infantry (HI)': UnitType.HI,
    'Heavy Infantry': UnitType.HI,
};

/**
 * Profile group category criteria — match against profileGroup.category.
 */
const CATEGORY_CRITERIA: Record<string, ProfileCategoryId[]> = {
    'Veteran': [ProfileCategory.VETERAN],
    'Elite Troop': [ProfileCategory.ELITE],
    'Elite': [ProfileCategory.ELITE],
};

/**
 * Criteria that are implicitly satisfied by having the Hacker skill.
 * Spotlight is a standard hacking program available to all hacking devices.
 */
const HACKER_IMPLICIT_CRITERIA = new Set([
    'Spotlight Hacking Program',
]);

// ============================================================================
// Logic
// ============================================================================

/**
 * Checks if a specific unit profile meets a single classified criterion.
 *
 * Matching hierarchy:
 * 1. "Any" → always matches
 * 2. Unit type criteria (MI, HI) → check profile.unitType
 * 3. Category criteria (Veteran, Elite) → check profileGroup.category
 * 4. Hacker-implicit criteria (Spotlight) → check for Hacker skill
 * 5. Equipment/weapon name criteria (D-Charges, Biometric Visor) → substring match
 * 6. Skill name criteria (Hacker, Doctor, etc.) → substring match on skills
 * 7. Equipment name match → substring match on equipment
 */
export function checkCriterion(
    _unit: Unit,
    profile: Profile,
    option: Loadout,
    criterion: string,
    context?: MatchContext,
): boolean {
    const target = criterion.trim();

    // 1. Wildcard
    if (target === 'Any') return true;

    // 2. Unit type criteria
    if (target in UNIT_TYPE_CRITERIA) {
        return profile.unitType === UNIT_TYPE_CRITERIA[target];
    }

    // 3. Category criteria (Veteran, Elite)
    if (target in CATEGORY_CRITERIA && context?.profileGroupCategory !== undefined) {
        return CATEGORY_CRITERIA[target].includes(context.profileGroupCategory);
    }

    // 4. Hacker-implicit (Spotlight Hacking Program)
    if (HACKER_IMPLICIT_CRITERIA.has(target)) {
        const hasHacker = (skills: { name: string }[]) =>
            skills.some(s => s.name.toLowerCase() === 'hacker');
        if (hasHacker(profile.skills) || hasHacker(option.skills)) return true;
    }

    // Resolve alias for remaining checks
    const resolvedTarget = CRITERION_ALIASES[target] || target;
    const lowerTarget = resolvedTarget.toLowerCase();

    // 5. Check skills (profile + option)
    const hasSkill = (skills: { name: string }[]) =>
        skills.some(s => s.name.toLowerCase().includes(lowerTarget));

    if (hasSkill(profile.skills)) return true;
    if (hasSkill(option.skills)) return true;

    // 6. Check equipment (profile + option)
    const hasEquip = (equip: { name: string }[]) =>
        equip.some(e => e.name.toLowerCase().includes(lowerTarget));

    if (hasEquip(profile.equipment)) return true;
    if (hasEquip(option.equipment)) return true;

    // 7. Check weapons (profile + option) — needed for D-Charges etc.
    const hasWeapon = (weapons: { name: string }[]) =>
        weapons.some(w => w.name.toLowerCase().includes(lowerTarget));

    if (hasWeapon(profile.weapons)) return true;
    if (hasWeapon(option.weapons)) return true;

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
    context?: MatchContext,
): ClassifiedMatch[] {
    return classifieds.map(cls => {
        const match = cls.designatedTroopers.find(criteria =>
            checkCriterion(unit, profile, option, criteria, context)
        );

        if (match) {
            return { objectiveId: cls.id, canComplete: true, reason: match };
        }

        return { objectiveId: cls.id, canComplete: false, reason: '' };
    });
}
