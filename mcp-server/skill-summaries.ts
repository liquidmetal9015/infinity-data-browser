/**
 * Skill Summary Extraction Utility
 * Parses wiki markdown files and extracts one-line summaries for skills and equipment
 */

import { promises as fs } from 'fs';
import * as path from 'path';

interface SkillSummary {
    name: string;
    summary: string;
    type: 'skill' | 'equipment' | 'ammo' | 'state';
    wikiSlug: string;
}

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

let skillSummariesCache: Map<string, SkillSummary> | null = null;

/**
 * Get a one-line summary for a skill or equipment
 */
export function getSkillSummary(name: string): string | undefined {
    // Normalize the name
    const normalizedName = name.replace(/[-_]/g, ' ').trim();

    // Check built-in summaries first (case-insensitive)
    for (const [key, summary] of Object.entries(BUILT_IN_SUMMARIES)) {
        if (key.toLowerCase() === normalizedName.toLowerCase() ||
            normalizedName.toLowerCase().includes(key.toLowerCase())) {
            return summary;
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
        if (summary) {
            result.set(name, summary);
        }
    }

    return result;
}

/**
 * Parse wiki markdown to extract the EFFECTS section
 */
export function extractEffectsFromWiki(content: string): string | undefined {
    // Look for EFFECTS section
    const effectsMatch = content.match(/EFFECTS\s*\n([\s\S]*?)(?=\n(?:REQUIREMENTS|SEE ALSO|REMEMBER|IMPORTANT|\*\*\[|FAQs|---)|$)/i);

    if (effectsMatch) {
        const effects = effectsMatch[1]
            .replace(/\*\s+/g, '')  // Remove bullet points
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove markdown links
            .replace(/\n+/g, ' ')  // Join lines
            .trim();

        // Return first sentence or first 200 chars
        const firstSentence = effects.match(/^[^.!?]+[.!?]/);
        if (firstSentence) {
            return firstSentence[0].trim();
        }
        return effects.substring(0, 200).trim() + '...';
    }

    return undefined;
}

/**
 * Load and cache skill summaries from wiki files
 * This is more expensive so only call when needed
 */
export async function loadSkillSummariesFromWiki(wikiDir: string): Promise<Map<string, SkillSummary>> {
    if (skillSummariesCache) {
        return skillSummariesCache;
    }

    skillSummariesCache = new Map();

    try {
        const files = await fs.readdir(wikiDir);

        for (const file of files) {
            if (!file.endsWith('.md')) continue;

            const filePath = path.join(wikiDir, file);
            const content = await fs.readFile(filePath, 'utf-8');

            // Extract title from first line
            const titleMatch = content.match(/^#\s+(.+)/);
            if (!titleMatch) continue;

            const title = titleMatch[1];
            const effects = extractEffectsFromWiki(content);

            if (effects) {
                skillSummariesCache.set(title.toLowerCase(), {
                    name: title,
                    summary: effects,
                    type: 'skill',
                    wikiSlug: file.replace('.md', '')
                });
            }
        }
    } catch (e) {
        console.error('Failed to load wiki summaries:', e);
    }

    return skillSummariesCache;
}

/**
 * Enrich unit skills with summaries
 * Used by get_unit_profile to add contextual rule explanations
 */
export function enrichSkillsWithSummaries(skills: Array<{ name: string;[key: string]: any }>): Array<{ name: string; summary?: string;[key: string]: any }> {
    return skills.map(skill => {
        const summary = getSkillSummary(skill.name);
        return summary ? { ...skill, summary } : skill;
    });
}
