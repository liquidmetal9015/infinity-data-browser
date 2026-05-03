import type { ArmyList, CombatGroup, ListUnit } from '@shared/listTypes';
import { generateId, getUnitDetails } from '@shared/listTypes';
import type { DecodedArmyList } from '@shared/armyCode';
import type { useDatabase } from '../hooks/useDatabase';

/** Build a full ArmyList from a decoded army code, resolving units from the db. */
export function armyListFromDecodedCode(
    decoded: DecodedArmyList,
    db: ReturnType<typeof useDatabase>,
): ArmyList {
    const now = Date.now();
    const groups: CombatGroup[] = decoded.combatGroups.map((cg, i) => {
        const units: ListUnit[] = [];
        for (const member of cg.members) {
            const unit = db.units.find(u => u.id === member.unitId || u.idArmy === member.unitId);
            if (!unit) continue;
            const { option } = getUnitDetails(unit, member.groupChoice, member.groupChoice, member.optionChoice);
            const newUnit: ListUnit = {
                id: generateId(),
                unitId: unit.id,
                unit,
                profileGroupId: member.groupChoice,
                profileId: member.groupChoice,
                optionId: member.optionChoice,
                points: Number(option?.points ?? 0),
                swc: Number(option?.swc ?? 0),
            };
            units.push(newUnit);

            for (const inc of (option?.includes || [])) {
                const pg = unit.raw.profileGroups[inc.group - 1];
                if (!pg?.isAutoAttached) continue;
                const pProfile = pg.profiles?.[0];
                const pOption = pg.options?.[inc.option - 1];
                if (!pProfile || !pOption) continue;
                for (let q = 0; q < (inc.q || 1); q++) {
                    units.push({
                        id: generateId(),
                        unitId: unit.id,
                        unit,
                        profileGroupId: pg.id,
                        profileId: pProfile.id,
                        optionId: pOption.id,
                        points: Number(pOption.points || 0),
                        swc: Number(pOption.swc || 0),
                        parentId: newUnit.id,
                        isPeripheral: true,
                    });
                }
            }
        }
        return { id: generateId(), name: `Combat Group ${i + 1}`, units };
    });

    return {
        id: generateId(),
        name: decoded.armyName || 'Imported List',
        tags: [],
        factionId: decoded.factionId,
        pointsLimit: decoded.maxPoints,
        swcLimit: decoded.maxPoints / 50,
        groups,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Returns a name that doesn't conflict with existingNames.
 * If base is empty/whitespace, falls back to "Unnamed List".
 * Conflicts get " 2", " 3", etc. appended.
 */
export function uniqueListName(base: string, existingNames: string[]): string {
    const trimmed = base.trim() || 'Unnamed List';
    if (!existingNames.includes(trimmed)) return trimmed;
    let n = 2;
    while (existingNames.includes(`${trimmed} ${n}`)) n++;
    return `${trimmed} ${n}`;
}

/** Split a textarea blob (newline or comma-delimited) into trimmed army codes. */
export function parseArmyCodes(raw: string): string[] {
    return raw
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(Boolean);
}
