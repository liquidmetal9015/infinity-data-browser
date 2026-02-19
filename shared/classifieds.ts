import type { Unit, Profile, Option } from './types';

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

/**
 * Normalizes a criterion string for comparison.
 * e.g., "Elite Troop" -> "Elite Troop"
 * e.g., "Chain of Command" -> "Chain of Command"
 * e.g., "Doctor" -> "Doctor"
 */
function normalizeCriterion(criterion: string): string {
    return criterion.trim();
}

/**
 * Checks if a specific unit profile meets a single criterion from the designated list.
 * This is the core matching logic.
 */
export function checkCriterion(
    _unit: Unit,
    profile: Profile,
    option: Option,
    criterion: string,
    metadata?: { skills: Map<number, string>; equips: Map<number, string>; }
): boolean {
    const target = normalizeCriterion(criterion);

    // 1. Check Unit Stats/Classification (e.g. "Medium Infantry (MI)")
    // Note: This requires mapping Unit Type ID to string names if not present in UnitRaw
    // For now we might look at the raw type number or if there's a string rep.
    // Assuming for now we check explicit skills/equip since types are IDs.

    // 2. Check Skills (e.g. "Doctor", "Forward Observer", "Chain of Command")
    // We need to look up skill names if we only have IDs.
    // However, the `Unit` type has `allSkillIds` and `allItemsWithMods`.
    // If we don't have the metadata map name->id, we can't easily check by string.
    // So we rely on the `metadata` passed in, matching ID to Name.

    // If we don't have metadata, we can't do string matching reliably unless we have hardcoded IDs.
    // For a robust shared helper, we should ideally pass fully hydrated items or the ID maps.

    if (!metadata) return false;

    // Helper to check if any skill matches the target name
    const hasSkill = (idSet: { id: number }[]) => {
        return idSet.some(s => {
            const name = metadata.skills.get(s.id);
            return name && name.toLowerCase().includes(target.toLowerCase());
        });
    };

    // Check Equipment
    const hasEquip = (idSet: { id: number }[]) => {
        return idSet.some(e => {
            const name = metadata.equips.get(e.id);
            return name && name.toLowerCase().includes(target.toLowerCase());
        });
    };

    // Check Profile Skills
    if (hasSkill(profile.skills)) return true;

    // Check Option Skills (often where "Hacker" or specialized skills live)
    if (hasSkill(option.skills)) return true;

    // Check Equipment (e.g. "Biometric Visor")
    if (hasEquip(profile.equip)) return true;
    if (hasEquip(option.equip)) return true;

    // Special Case: "Elite Troop" / "Veteran"
    // These are often traits or classification types.
    // If unit.type is available and we know the mapping:
    // 1: LI, 2: MI, 3: HI, 4: SK, 5: WB, 6: REM, 7: TAG, 8: IM...
    // We might need a stricter check here. 
    // For MVP, we'll check if the skill/trait exists with that name.

    // Special Case: "Any"
    if (target === "Any") return true;

    return false;
}

/**
 * Analyzes a specific Unit Option (Profile + Loadout) against all Classifieds.
 */
export function getClassifiedsForOption(
    unit: Unit,
    profile: Profile,
    option: Option,
    classifieds: ClassifiedObjective[],
    metadata: { skills: Map<number, string>; equips: Map<number, string>; }
): ClassifiedMatch[] {
    return classifieds.map(cls => {
        // A classified is completable if the unit matches ANY of the designated troopers
        const match = cls.designatedTroopers.find(criteria =>
            checkCriterion(unit, profile, option, criteria, metadata)
        );

        if (match) {
            return {
                objectiveId: cls.id,
                canComplete: true,
                reason: match
            };
        }

        return {
            objectiveId: cls.id,
            canComplete: false,
            reason: ""
        };
    });
}
