import { DatabaseAdapter } from './DatabaseAdapter.js';
import type { DecodedArmyList, DecodedMember } from '../shared/armyCode.js';
import type { HydratedList, HydratedGroup, HydratedUnit, HydratedItem, Unit } from './types.js';
import type { Profile, Loadout as Option, SkillInstance, EquipmentInstance, WeaponInstance } from '../shared/game-model.js';

export function hydrateList(decoded: DecodedArmyList): HydratedList {
    const db = DatabaseAdapter.getInstance();

    // Resolve faction name
    const factionName = db.factionMap.get(decoded.factionId) || decoded.factionSlug;

    let totalPoints = 0;
    let totalSwc = 0;

    const groups: HydratedGroup[] = decoded.combatGroups.map(group => {
        const units: HydratedUnit[] = group.members.map(member => {
            try {
                const unit = db.getUnitById(member.unitId);
                if (!unit) {
                    return createUnknownUnit(member);
                }

                // Try to find the specific profile group
                let profileGroup = unit.raw.profileGroups.find(pg => pg.id === member.groupChoice);

                let option;

                if (profileGroup) {
                    option = profileGroup.options.find(o => o.id === member.optionChoice);
                }

                if (!option) {
                    // Fallback: look across ALL profile groups
                    const fallbackGroup = unit.raw.profileGroups.find(pg => pg.options.some(o => o.id === member.optionChoice));
                    if (fallbackGroup) {
                        profileGroup = fallbackGroup;
                        option = fallbackGroup.options.find(o => o.id === member.optionChoice);
                    }
                }

                if (!profileGroup || !option) {
                    return createUnknownUnit(member, `${unit.name} (Option ${member.optionChoice}?)`);
                }

                const profile = profileGroup.profiles[0];

                if (!profile) {
                    return createUnknownUnit(member, unit.name);
                }

                totalPoints += option.points;
                const swcVal = typeof option.swc === 'string' ? parseFloat(option.swc) : (option.swc || 0);
                totalSwc += swcVal;

                return hydrateUnit(db, unit, profile, option, swcVal);
            } catch {
                return createUnknownUnit(member, 'Error Unit');
            }
        }).filter(u => u !== null);

        return {
            groupNumber: group.groupNumber,
            units
        };
    });

    return {
        faction: factionName,
        factionSlug: decoded.factionSlug,
        armyName: decoded.armyName,
        points: totalPoints,
        maxPoints: decoded.maxPoints,
        swc: totalSwc,
        maxSwc: decoded.maxPoints / 50,
        groups
    };
}

function createUnknownUnit(member: DecodedMember, name: string = 'Unknown Unit'): HydratedUnit {
    return {
        isc: name,
        name: name,
        points: 0,
        swc: 0,
        profile: {
            move: '?', cc: 0, bs: 0, ph: 0, wip: 0, arm: 0, bts: 0, w: 0, s: 0, str: false
        },
        weapons: [],
        skills: [],
        equipment: []
    };
}

function resolveSkill(db: DatabaseAdapter, s: SkillInstance): HydratedItem {
    const displayName = s.displayName || (s.modifiers?.length ? `${s.name} (${s.modifiers.join(', ')})` : s.name);
    const wiki = db.metadata?.skills.find(m => m.id === s.id)?.wiki;
    const ruleSummary = db.getRuleSummary('skill', s.id);
    return {
        name: displayName,
        wiki,
        modifiers: s.modifiers || [],
        summary: ruleSummary?.summary,
    };
}

function resolveEquipment(db: DatabaseAdapter, e: EquipmentInstance): HydratedItem {
    const displayName = e.modifiers?.length ? `${e.name} (${e.modifiers.join(', ')})` : e.name;
    const wiki = db.metadata?.equips.find(m => m.id === e.id)?.wiki;
    const ruleSummary = db.getRuleSummary('equipment', e.id);
    return {
        name: displayName,
        wiki,
        modifiers: e.modifiers || [],
        summary: ruleSummary?.summary,
    };
}

function resolveWeapon(db: DatabaseAdapter, w: WeaponInstance): HydratedItem {
    const displayName = w.modifiers?.length ? `${w.name} (${w.modifiers.join(', ')})` : w.name;
    const wiki = db.metadata?.weapons.find(m => m.id === w.id)?.wiki;
    const stats = db.getWeaponDetails(w.id);
    return {
        name: displayName,
        wiki,
        modifiers: w.modifiers || [],
        stats,
    };
}

export function hydrateUnit(
    db: DatabaseAdapter,
    unit: Unit,
    profile: Profile,
    option: Option,
    overrideSwc?: number
): HydratedUnit {
    const allWeapons = [...(profile.weapons || []), ...(option.weapons || [])];
    const allSkills = [...(profile.skills || []), ...(option.skills || [])];
    const allEquip = [...(profile.equipment || []), ...(option.equipment || [])];

    // Move values are already in inches from ETL processing
    const move = profile.move.join('-');

    return {
        isc: unit.isc,
        name: option.name || unit.name,
        points: option.points,
        swc: overrideSwc !== undefined ? overrideSwc : (typeof option.swc === 'string' ? parseFloat(option.swc) : (option.swc || 0)),
        profile: {
            move,
            cc: profile.cc,
            bs: profile.bs,
            ph: profile.ph,
            wip: profile.wip,
            arm: profile.arm,
            bts: profile.bts,
            w: profile.w,
            s: profile.s,
            str: profile.isStructure || false
        },
        weapons: allWeapons.map(w => resolveWeapon(db, w)),
        skills: allSkills.map(s => resolveSkill(db, s)),
        equipment: allEquip.map(e => resolveEquipment(db, e))
    };
}
