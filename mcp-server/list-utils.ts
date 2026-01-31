import { DatabaseAdapter } from './DatabaseAdapter.js';
import type { DecodedArmyList, DecodedMember } from './army-utils.js';
import type { HydratedList, HydratedGroup, HydratedUnit, HydratedItem, Profile, Option, Unit } from './types.js';

export function hydrateList(decoded: DecodedArmyList): HydratedList {
    const db = DatabaseAdapter.getInstance();

    // Resolve faction name
    const factionName = db.factionMap.get(decoded.factionId) || decoded.factionSlug;

    let totalPoints = 0;
    let totalSwc = 0;

    const groups: HydratedGroup[] = decoded.combatGroups.map(group => {
        const units: HydratedUnit[] = group.members.map(member => {
            const unit = db.units.find(u => u.id === member.unitId);
            if (!unit) {
                // Fallback for unknown unit
                return createUnknownUnit(member);
            }

            const profileGroup = unit.raw.profileGroups.find(pg => pg.id === member.groupChoice);
            // Profile ID is tricky in the army code format - looking at src/utils/armyCode.ts: 
            // "pg.options.find(o => o.id === listUnit.optionId)" implies optionId is unique within the group?
            // Wait, the army code has `groupChoice` (profileGroupId) and `optionChoice` (optionId).
            // A profile is NOT explicitly selected in the code structure I see in armyCode.ts export, 
            // but the `ListUnit` type in src/types/list.ts has `profileId`.
            // Let's re-read armyCode.ts::decodeArmyCode
            // It returns { unitId, groupChoice, optionChoice }.
            // The option object usually contains the profile reference implicitly because options belong to a profile?
            // Actually, looking at `UnitRaw` type: `profileGroups` -> `options`.
            // Options are children of ProfileGroup, NOT directly children of Profile?
            // Let's check `UnitRaw` in `types.ts` again.
            // profileGroups: { profiles: Profile[], options: Option[] }
            // So options and profiles are siblings in the group? That seems odd.
            // Usually an option is "Combi Rifle, Paramedic" and it is tied to a specific Profile (stats).
            // How do we know WHICH profile stats to use for an option?
            // In the official data, usually options map to profiles by index or ID, or they share a "linked" ID?
            // Let's assume for now we can find the profile from the option, or the option implies the profile.
            // Wait, `ListUnit` has `profileId`. Where does it come from in `decodeArmyCode`?
            // It DOESN'T return profileId! It returns `groupChoice` and `optionChoice`.
            // The `addUnit` action in `ListContext` takes `profileId`.
            // When DECODING, we typically have to infer the profile.
            // In Infinity data, `options` often have a `profile` property or we match by something.
            // Inspecting `DatabaseAdapter.ts` ingest: `o.weapons`, `o.skills`.
            // There is no explicit link in `Option` type to `Profile`.
            // However, often `Profile` and `Option` are linked.
            // Let's look at `src/utils/armyCode.ts` again. 
            // `bytes.push(...writeVLI(listUnit.profileGroupId));`
            // `bytes.push(...writeVLI(listUnit.optionId));`
            // It does NOT write profileId.
            // So the army code relies on `profileGroupId` + `optionId`.
            // How does the app display stats?
            // `ListDashboard.tsx`: `const option = listUnit.unit.raw.profileGroups...find(o => o.id === listUnit.optionId);`
            // It gets SWC/Points from `option`.
            // Where does it get stats (BS, PH, etc)?
            // The `DraggableUnitRow` only shows name/weapons.
            // `UnitStatsModal` must handle this.
            // Deep dive: `Option` sometimes has `parentId` or similar? Or maybe all options in a ProfileGroup share the SAME profiles?
            // Usually a ProfileGroup has ONE set of stats (Profile) and multiple Options (Loadouts).
            // BUT, some units (transforming ones) have multiple Profiles in a group.
            // For now, I will assume the FIRST profile in the group is the one to use, or try to find a better heuristic.
            // Most units have 1 Profile per ProfileGroup.

            const option = profileGroup?.options.find(o => o.id === member.optionChoice);
            const profile = profileGroup?.profiles[0]; // Heuristic: Use first profile in group.

            if (!option || !profile) return createUnknownUnit(member, unit.name);

            totalPoints += option.points;
            totalSwc += option.swc;

            return hydrateUnit(db, unit, profile, option);
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

function hydrateUnit(
    db: DatabaseAdapter,
    unit: Unit,
    profile: Profile,
    option: Option
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

        // Fancy name composition
        let displayName = name;
        if (modifiers.length > 0) {
            displayName += ` (${modifiers.join(', ')})`;
        }

        return {
            name: displayName,
            wiki,
            modifiers
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
        swc: option.swc,
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
