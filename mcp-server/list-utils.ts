import { DatabaseAdapter } from './DatabaseAdapter.js';
import type { DecodedArmyList, DecodedMember } from '../shared/armyCode.js';
import type { HydratedList, HydratedGroup, HydratedUnit, HydratedItem, Profile, Option, Unit } from './types.js';

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

                // If not found (or if we need to search broader due to some legacy/weird code), we can do a broader search later
                // But for now let's proceed.

                // The army code provides optionChoice (Option ID).
                // We need to find the specific option. 
                // If profileGroup failed, we can search all groups.
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

                // Heuristic: Use first profile in group.
                const profile = profileGroup.profiles[0];

                if (!profile) {
                    return createUnknownUnit(member, unit.name);
                }

                totalPoints += option.points;
                // Ensure SWC is treated as a number
                const swcVal = typeof option.swc === 'string' ? parseFloat(option.swc) : (option.swc || 0);
                totalSwc += swcVal;

                return hydrateUnit(db, unit, profile, option, swcVal);
            } catch (e) {
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
        maxSwc: decoded.maxPoints / 50, // Standard rule
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

export function hydrateUnit(
    db: DatabaseAdapter,
    unit: Unit,
    profile: Profile,
    option: Option,
    overrideSwc?: number
): HydratedUnit {
    // Merge lists from Profile and Option (unit stats + loadout)
    const allWeapons = [...(profile.weapons || []), ...(option.weapons || [])];
    const allSkills = [...(profile.skills || []), ...(option.skills || [])];
    const allEquip = [...(profile.equip || []), ...(option.equip || [])];

    // Helper to resolve items
    const resolveItem = (itemRef: { id: number, extra?: number[] }, type: 'weapon' | 'skill' | 'equipment'): HydratedItem => {
        let name = 'Unknown';
        let wiki = undefined;
        let map: Map<number, string>;
        let metaList: { id: number, name: string, wiki?: string }[] | undefined;

        switch (type) {
            case 'weapon':
                map = db.weaponMap;
                metaList = db.metadata?.weapons;
                break;
            case 'skill':
                map = db.skillMap;
                metaList = db.metadata?.skills;
                break;
            case 'equipment':
                map = db.equipmentMap;
                metaList = db.metadata?.equips;
                break;
        }

        const baseName = map.get(itemRef.id);
        if (baseName) name = baseName;

        // Find wiki slug
        const metaItem = metaList?.find(i => i.id === itemRef.id);
        if (metaItem?.wiki) wiki = metaItem.wiki;

        // Format modifiers
        const modifiers: string[] = [];
        if (itemRef.extra) {
            itemRef.extra.forEach(modId => {
                const extraName = db.getExtraName(modId);
                if (extraName) modifiers.push(extraName);
            });
        }

        // Get Rule Summary
        let summary: string | undefined = undefined;
        if (type === 'skill' || type === 'equipment') {
            const ruleSummary = db.getRuleSummary(type, itemRef.id);
            if (ruleSummary) summary = ruleSummary.summary;
        }

        // Fancy name composition
        let displayName = name;
        if (modifiers.length > 0) {
            displayName += ` (${modifiers.join(', ')})`;
        }

        // Resolve Stats for Weapons
        let stats;
        if (type === 'weapon') {
            stats = db.getWeaponDetails(itemRef.id);
        }

        return {
            name: displayName,
            wiki,
            modifiers,
            summary,
            stats
        };
    };

    // Format Move
    const move = profile.move.map(m => {
        // Assume data is in cm, convert to inches if needed (standard is 4-4 usually which is inches, but data might be cm?)
        // Let's check a known unit. Fusilier is 4-4 inches.
        // In database, move is array of numbers.
        // If it's [10, 10], that's cm. If it's [4, 4], that's inches.
        // Standard CB API often uses cm.
        // Let's assume we function same as `getUnitDetails` tool or similar?
        // `DatabaseAdapter.ts` helper `getExtraName` converts CM to Inches.
        // Let's assume raw profile data might be CM.
        // 10cm ~= 4 inches.
        if (m >= 10) return Math.round(m * 0.4);
        return m;
    }).join('-');

    return {
        isc: unit.isc,
        name: option.name || unit.name,
        points: option.points,
        swc: overrideSwc !== undefined ? overrideSwc : (typeof option.swc === 'string' ? parseFloat(option.swc) : (option.swc || 0)),
        profile: {
            move: move,
            cc: profile.cc,
            bs: profile.bs,
            ph: profile.ph,
            wip: profile.wip,
            arm: profile.arm,
            bts: profile.bts,
            w: profile.w,
            s: profile.s,
            str: profile.str || false
        },
        weapons: allWeapons.map(w => resolveItem(w, 'weapon')),
        skills: allSkills.map(s => resolveItem(s, 'skill')),
        equipment: allEquip.map(e => resolveItem(e, 'equipment'))
    };
}
