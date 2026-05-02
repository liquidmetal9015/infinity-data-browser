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
            units.push({
                id: generateId(),
                unit,
                profileGroupId: member.groupChoice,
                profileId: member.groupChoice,
                optionId: member.optionChoice,
                points: Number(option?.points ?? 0),
                swc: Number(option?.swc ?? 0),
            });
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

/** Split a textarea blob (newline or comma-delimited) into trimmed army codes. */
export function parseArmyCodes(raw: string): string[] {
    return raw
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(Boolean);
}
