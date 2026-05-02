/**
 * Skill Summary Utility
 * Provides one-line summaries for skills and equipment for agent context
 */

// Pre-built summaries for common skills/equipment that agents need to understand
// These are carefully distilled from the wiki to be accurate and concise
const BUILT_IN_SUMMARIES: Record<string, string> = {
    // Defensive Skills
    'Mimetism': 'Enemies take a negative MOD (shown in parentheses, e.g. -3 or -6) to BS Attacks and Discover against this unit. Does not apply in CC.',
    'ODD': 'Optical Disruption Device. Works like Mimetism (-6), but is cancelled by Multispectral Visor L2+.',
    'Camouflage': 'Deploys as Camo marker, -3 to enemy attacks. Can use Surprise Attack for additional -3.',
    'TO Camouflage': 'Thermo-Optical Camo. Deploys as Camo marker, -6 to enemy attacks. Requires MSV2+ to ignore.',
    'Cover': 'Partial Cover gives -3 to attacker and +3 to defender Saving Roll.',

    // Offensive Skills
    'Surprise Attack': 'When attacking from Camouflage/Impersonation, apply -3 MOD to enemy in Face-to-Face rolls.',
    'Marksmanship': 'Ignore Cover ARM bonus. Shock ammo forces Unconscious→Dead.',
    'Berserk': 'CC boost but no ARO allowed. +6 CC, +3 Damage, -3 to enemy.',
    'Natural Born Warrior': 'Ignores Martial Arts, Guard, Berserk, Protheion CC bonuses.',
    'Martial Arts': 'Various CC bonuses depending on level (L1-L5). Check wiki for specific effects.',

    // Movement Skills  
    'Super-Jump': 'Can jump vertically up to second MOV value and land safely.',
    'Climbing Plus': 'Can climb vertical surfaces at normal speed without rolls.',
    'Infiltration': 'Deploy in your half up to midline. May attempt PH roll to deploy further.',
    'Forward Deployment': 'Deploy further forward (distance in parentheses, e.g. L1 = 4", L2 = 8").',
    'Airborne Deployment': 'Enter from any table edge after Turn 1. May use Combat Jump.',

    // Specialist Skills
    'Doctor': 'WIP roll to heal Unconscious allies. Can use MediKit for +3.',
    'Engineer': 'WIP roll to repair structures/equipment. Can fix REMs and TAGs.',
    'Hacker': 'Can perform hacking programs through Hacking Area (8" + Repeaters).',
    'Forward Observer': 'Apply Targeted state to enemy (WIP roll, Spotlight program).',
    'Specialist Operative': 'Can complete all Classified Objectives and interact with objectives.',
    'Paramedic': 'Can use MediKit to heal Unconscious allies (WIP roll).',

    // Visors
    'Multispectral Visor L1': 'Ignore one level of Mimetism (e.g., -6 becomes -3).',
    'Multispectral Visor L2': 'Ignore Mimetism, ODD, and Camouflage benefits. See through Smoke.',
    'Multispectral Visor L3': 'Ignore all visual mods including Zero Visibility.',
    'X-Visor': 'Halve negative Range MODs (round up).',
    '360 Visor': 'Full 360° Line of Fire. Cannot be Surprised.',

    // Immunity
    'Total Immunity': 'Immune to special ammunition effects (Shock, AP, DA, etc.).',
    'Bioimmunity': 'Immune to Shock and Bio-weapons. May ignore one Unconscious result per game.',

    // Orders & Training
    'Tactical Awareness': 'Generates an extra Tactical Order for personal use.',
    'NCO': 'Can use Lieutenant Special Order as Tactical Order.',
    'Regular': 'Contributes Order to Combat Group pool.',
    'Irregular': 'Order only usable by this trooper, not added to pool.',
    'Impetuous': 'Must move toward enemy at start of turn (Impetuous Phase). Extra Order.',
    'Frenzy': 'Becomes Impetuous after causing a Wound.',

    // Protective
    'Dogged': 'When reaching 0 Wounds, stay active until taking another Wound or turn ends.',
    'No Wound Incapacitation': 'Ignore first Unconscious result, stay active until another Wound.',
    'Religious Troop': 'Cannot use Guts Roll to dive for cover. Immune to retreat effects.',
    'Courage': 'Automatically pass Guts Rolls.',

    // Equipment
    'Repeater': 'Extends Hacking Area. Friendly hackers can hack through it.',
    'Pitcher': 'Deployable Repeater thrown via Speculative Attack.',
    'Sensor': 'WIP roll to discover all camo markers within 8".',
    'TinBot': 'Provides defensive bonuses (type in parentheses, e.g. Firewall -3).',

    // States
    'Camouflaged State': 'Represented by Camo marker. -3 to enemy attacks. Revealed when attacking or discovered.',
    'Targeted State': '+3 to BS Attacks against. -3 to Reset. Enables Guided attacks.',
    'Unconscious State': 'Cannot act. Can be healed by Doctor/Paramedic or killed by Coup de Grâce.',
    'Immobilized-A': 'Cannot move, declare AROs, or reset. Still fights in CC if engaged.',
    'Isolated State': 'Irregular order, cannot use Command Tokens, hackers cannot affect.',

    // Ammunition
    'Shock': 'Unconscious becomes Dead. Bypasses NWI and Dogged.',
    'AP': 'Armor Piercing. Halve ARM value before Saving Roll.',
    'DA': 'Double Action. Target makes 2 Saving Rolls per hit.',
    'EXP': 'Explosive. Target makes 3 Saving Rolls per hit.',
    'T2': 'Target loses 2 Wounds per failed save instead of 1.',
    'Plasma': 'Combines AP+DA. Halve ARM and 2 saves.',
};

// Keys sorted longest-first to prevent shorter keys from matching as substrings
// (e.g., "Martial Arts" must match before "Arts" if both existed)
const SORTED_KEYS = Object.keys(BUILT_IN_SUMMARIES).sort((a, b) => b.length - a.length);

/**
 * Get a one-line summary for a skill or equipment
 */
export function getSkillSummary(name: string): string | undefined {
    const normalizedName = name.replace(/[-_]/g, ' ').trim().toLowerCase();

    for (const key of SORTED_KEYS) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === normalizedName || normalizedName.includes(lowerKey)) {
            return BUILT_IN_SUMMARIES[key];
        }
    }

    return undefined;
}

/**
 * Get summaries for multiple skills at once
 */
export function getSkillSummaries(names: string[]): Map<string, string> {
    const result = new Map<string, string>();
    for (const name of names) {
        const summary = getSkillSummary(name);
        if (summary) result.set(name, summary);
    }
    return result;
}

/**
 * Enrich unit skills with summaries
 * Used by get_unit_profile to add contextual rule explanations
 */
export function enrichSkillsWithSummaries(skills: Array<{ name: string } & Record<string, unknown>>): Array<{ name: string; summary?: string } & Record<string, unknown>> {
    return skills.map(skill => {
        const summary = getSkillSummary(skill.name);
        return summary ? { ...skill, summary } : skill;
    });
}
