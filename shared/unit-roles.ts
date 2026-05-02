// unit-roles.ts - Unit classification logic for MCP tools
// Classifies units by combat role: gunfighter, melee, specialist, etc.

import type { Unit, DatabaseMetadata } from './types';
import { UnitType } from './game-model.js';
import type { Profile, Loadout as Option, WeaponInstance } from './game-model.js';

export type UnitRole =
    | 'gunfighter'
    | 'melee'
    | 'specialist'
    | 'button_pusher'
    | 'skirmisher'
    | 'heavy'
    | 'support'
    | 'hack_target'
    | 'order_generator';

export interface RoleScore {
    role: UnitRole;
    score: number;
    reasons: string[];
}

export interface UnitRoleAnalysis {
    unitName: string;
    unitIsc: string;
    profileName: string;
    optionName: string;
    points: number;
    swc: number;
    roles: RoleScore[];
    primaryRole: UnitRole;
}

// Skill IDs for common abilities (these would need to match metadata)
const SPECIALIST_SKILLS = new Set([
    'doctor', 'engineer', 'forward observer', 'hacker', 'paramedic',
    'chain of command', 'lieutenant'
]);

const CAMO_SKILLS = new Set([
    'camouflage', 'ch: camouflage', 'ch: mimetism', 'ch: limited camouflage',
    'impersonation', 'holoechoes', 'decoy'
]);

const INFILTRATION_SKILLS = new Set([
    'infiltration', 'superior infiltration', 'forward deployment',
    'airborne deployment', 'mechanized deployment'
]);

const MARTIAL_ARTS_SKILLS = new Set([
    'martial arts', 'ma arts', 'protheion', 'natural born warrior',
    'berserker', 'frenzy', 'i-khol'
]);

const HEAVY_WEAPON_TYPES = new Set([
    'hmg', 'heavy machine gun', 'heavy rocket launcher', 'missile launcher',
    'multi hmg', 'mk12', 'spitfire', 'mg', 'tag', 'hyper-rapid magnetic cannon'
]);

/**
 * Classify a unit profile+option by combat role.
 */
export function classifyUnit(
    unit: Unit,
    profile: Profile,
    option: Option,
    metadata?: DatabaseMetadata,
): UnitRoleAnalysis {
    const roles: RoleScore[] = [];

    // Extract skill names from embedded SkillInstance names
    const skillNames = new Set<string>();
    for (const s of [...profile.skills, ...option.skills]) {
        skillNames.add(s.name.toLowerCase());
    }

    // Extract weapon info — WeaponInstance only carries id/name/modifiers, so
    // burst/damage/distance must come from metadata. If metadata is not
    // provided (some callers don't have it in scope), fall back to a
    // name-based heuristic that still classifies HMG-style heavy weapons.
    const weaponDefById = new Map<number, DatabaseMetadata['weapons'][number]>();
    if (metadata) {
        for (const w of metadata.weapons) weaponDefById.set(w.id, w);
    }
    const allWeapons: WeaponInstance[] = [...(profile.weapons || []), ...option.weapons];
    const weapons = allWeapons.map(w => {
        const def = weaponDefById.get(w.id);
        return {
            name: w.name.toLowerCase(),
            burst: parseInt(def?.burst || '1') || 1,
            damage: parseInt(def?.damage || '0') || 0,
            ranged: !!(def?.distance && def.distance.med && def.distance.med.max > 0),
        };
    });

    // Gunfighter score
    const gunfighterScore = scoreGunfighter(profile, weapons);
    if (gunfighterScore.score > 0) roles.push(gunfighterScore);

    // Melee score
    const meleeScore = scoreMelee(profile, weapons, skillNames);
    if (meleeScore.score > 0) roles.push(meleeScore);

    // Specialist score
    const specialistScore = scoreSpecialist(skillNames);
    if (specialistScore.score > 0) roles.push(specialistScore);

    // Button pusher (cheap specialist)
    const buttonPusherScore = scoreButtonPusher(option, skillNames);
    if (buttonPusherScore.score > 0) roles.push(buttonPusherScore);

    // Skirmisher
    const skirmisherScore = scoreSkirmisher(skillNames);
    if (skirmisherScore.score > 0) roles.push(skirmisherScore);

    // Heavy
    const heavyScore = scoreHeavy(profile, weapons);
    if (heavyScore.score > 0) roles.push(heavyScore);

    // Support
    const supportScore = scoreSupport(skillNames);
    if (supportScore.score > 0) roles.push(supportScore);

    // Hack target
    const hackTargetScore = scoreHackTarget(profile);
    if (hackTargetScore.score > 0) roles.push(hackTargetScore);

    // Order generator
    const orderGenScore = scoreOrderGenerator(option);
    if (orderGenScore.score > 0) roles.push(orderGenScore);

    // Sort by score
    roles.sort((a, b) => b.score - a.score);

    return {
        unitName: unit.name,
        unitIsc: unit.isc,
        profileName: profile.name,
        optionName: option.name,
        points: option.points,
        swc: option.swc || 0,
        roles,
        primaryRole: roles[0]?.role || 'order_generator'
    };
}

function scoreGunfighter(
    profile: Profile,
    weapons: Array<{ name: string; burst: number; damage: number; ranged: boolean }>
): RoleScore {
    const reasons: string[] = [];
    let score = 0;

    // High BS
    if (profile.bs >= 14) {
        score += 30;
        reasons.push(`BS ${profile.bs}`);
    } else if (profile.bs >= 12) {
        score += 15;
        reasons.push(`BS ${profile.bs}`);
    }

    // Good ranged weapons
    const bestRangedWeapon = weapons.filter(w => w.ranged).sort((a, b) => (b.burst * b.damage) - (a.burst * a.damage))[0];
    if (bestRangedWeapon) {
        if (bestRangedWeapon.burst >= 4) {
            score += 25;
            reasons.push(`High burst weapon (${bestRangedWeapon.name})`);
        } else if (bestRangedWeapon.burst >= 3) {
            score += 15;
            reasons.push(`${bestRangedWeapon.name}`);
        }
        if (bestRangedWeapon.damage >= 15) {
            score += 10;
            reasons.push(`High damage (${bestRangedWeapon.damage})`);
        }
    }

    // Survivability
    if (profile.w >= 2) {
        score += 10;
        reasons.push(`${profile.w}W`);
    }
    if (profile.arm >= 3) {
        score += 5;
        reasons.push(`ARM ${profile.arm}`);
    }

    return { role: 'gunfighter', score, reasons };
}

function scoreMelee(
    profile: Profile,
    weapons: Array<{ name: string; burst: number; damage: number; ranged: boolean }>,
    skillNames: Set<string>
): RoleScore {
    const reasons: string[] = [];
    let score = 0;

    // High CC
    if (profile.cc >= 20) {
        score += 30;
        reasons.push(`CC ${profile.cc}`);
    } else if (profile.cc >= 15) {
        score += 15;
        reasons.push(`CC ${profile.cc}`);
    }

    // Martial Arts
    for (const skill of skillNames) {
        for (const ma of MARTIAL_ARTS_SKILLS) {
            if (skill.includes(ma)) {
                score += 20;
                reasons.push(skill);
                break;
            }
        }
    }

    // CC weapons
    const ccWeapons = weapons.filter(w => !w.ranged);
    if (ccWeapons.length > 0) {
        const best = ccWeapons.sort((a, b) => b.damage - a.damage)[0];
        if (best.damage >= 13) {
            score += 15;
            reasons.push(`${best.name} (DAM ${best.damage})`);
        }
    }

    return { role: 'melee', score, reasons };
}

function scoreSpecialist(skillNames: Set<string>): RoleScore {
    const reasons: string[] = [];
    let score = 0;

    for (const skill of skillNames) {
        for (const specialist of SPECIALIST_SKILLS) {
            if (skill.includes(specialist)) {
                score += 50;
                reasons.push(skill);
            }
        }
    }

    return { role: 'specialist', score, reasons };
}

function scoreButtonPusher(option: Option, skillNames: Set<string>): RoleScore {
    const reasons: string[] = [];
    let score = 0;

    // Must be a specialist
    let isSpecialist = false;
    for (const skill of skillNames) {
        for (const specialist of SPECIALIST_SKILLS) {
            if (skill.includes(specialist)) {
                isSpecialist = true;
                break;
            }
        }
    }

    if (!isSpecialist) return { role: 'button_pusher', score: 0, reasons: [] };

    // Cheap
    if (option.points <= 15) {
        score += 40;
        reasons.push(`Cheap (${option.points}pts)`);
    } else if (option.points <= 25) {
        score += 20;
        reasons.push(`${option.points}pts`);
    }

    return { role: 'button_pusher', score, reasons };
}

function scoreSkirmisher(skillNames: Set<string>): RoleScore {
    const reasons: string[] = [];
    let score = 0;

    // Camo
    for (const skill of skillNames) {
        for (const camo of CAMO_SKILLS) {
            if (skill.includes(camo)) {
                score += 25;
                reasons.push(skill);
                break;
            }
        }
    }

    // Infiltration
    for (const skill of skillNames) {
        for (const inf of INFILTRATION_SKILLS) {
            if (skill.includes(inf)) {
                score += 25;
                reasons.push(skill);
                break;
            }
        }
    }

    return { role: 'skirmisher', score, reasons };
}

function scoreHeavy(
    profile: Profile,
    weapons: Array<{ name: string; burst: number; damage: number; ranged: boolean }>
): RoleScore {
    const reasons: string[] = [];
    let score = 0;

    // Type (HI, TAG)
    if (profile.unitType === UnitType.HI) {
        score += 20;
        reasons.push('Heavy Infantry');
    }
    if (profile.unitType === UnitType.TAG) {
        score += 40;
        reasons.push('TAG');
    }

    // Heavy weapons
    for (const w of weapons) {
        for (const hw of HEAVY_WEAPON_TYPES) {
            if (w.name.includes(hw)) {
                score += 20;
                reasons.push(w.name);
                break;
            }
        }
    }

    // High armor
    if (profile.arm >= 5) {
        score += 15;
        reasons.push(`ARM ${profile.arm}`);
    }

    return { role: 'heavy', score, reasons };
}

function scoreSupport(skillNames: Set<string>): RoleScore {
    const reasons: string[] = [];
    let score = 0;

    if (skillNames.has('doctor') || [...skillNames].some(s => s.includes('doctor'))) {
        score += 40;
        reasons.push('Doctor');
    }
    if (skillNames.has('engineer') || [...skillNames].some(s => s.includes('engineer'))) {
        score += 40;
        reasons.push('Engineer');
    }
    if (skillNames.has('paramedic') || [...skillNames].some(s => s.includes('paramedic'))) {
        score += 30;
        reasons.push('Paramedic');
    }

    return { role: 'support', score, reasons };
}

function scoreHackTarget(profile: Profile): RoleScore {
    const reasons: string[] = [];
    let score = 0;

    // HI, REM, TAG are hackable
    if (profile.unitType === UnitType.HI) {
        score += 30;
        reasons.push('Heavy Infantry (hackable)');
    }
    if (profile.unitType === UnitType.REM) {
        score += 40;
        reasons.push('REM (hackable)');
    }
    if (profile.unitType === UnitType.TAG) {
        score += 50;
        reasons.push('TAG (hackable)');
    }

    return { role: 'hack_target', score, reasons };
}

function scoreOrderGenerator(option: Option): RoleScore {
    const reasons: string[] = [];
    let score = 0;

    // Cheap order sources
    if (option.points <= 10) {
        score += 40;
        reasons.push(`Very cheap (${option.points}pts)`);
    } else if (option.points <= 15) {
        score += 20;
        reasons.push(`Cheap (${option.points}pts)`);
    }

    return { role: 'order_generator', score, reasons };
}

/**
 * Find the top units for a specific role from a roster.
 */
export function getTopUnitsByRole(
    units: Array<{ unit: Unit; profile: Profile; option: Option }>,
    role: UnitRole,
    limit: number = 10
): UnitRoleAnalysis[] {
    const analyses: UnitRoleAnalysis[] = [];

    for (const { unit, profile, option } of units) {
        const analysis = classifyUnit(unit, profile, option);
        const roleScore = analysis.roles.find(r => r.role === role);
        if (roleScore && roleScore.score > 0) {
            analyses.push(analysis);
        }
    }

    // Sort by role score
    analyses.sort((a, b) => {
        const aScore = a.roles.find(r => r.role === role)?.score || 0;
        const bScore = b.roles.find(r => r.role === role)?.score || 0;
        return bScore - aScore;
    });

    return analyses.slice(0, limit);
}
