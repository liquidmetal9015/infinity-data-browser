import { useMemo } from 'react';
import type { Unit, DatabaseMetadata } from '@shared/types';

type FactionEntry = DatabaseMetadata['factions'][number];

interface FactionsComparisonResult {
    universal: Unit[];
    sharedGroups: { factions: FactionEntry[]; units: Unit[] }[];
    unique: Record<number, Unit[]>;
}

export function useFactionsComparison(
    selectedFactionIds: number[],
    allFactions: FactionEntry[],
    units: Unit[]
): FactionsComparisonResult | null {
    return useMemo(() => {
        if (selectedFactionIds.length < 2) return null;

        const factionUnitMap = new Map<number, Set<number>>();
        selectedFactionIds.forEach(fid => {
            const unitIds = new Set<number>();
            units.forEach(u => { if (u.factions.includes(fid)) unitIds.add(u.id); });
            factionUnitMap.set(fid, unitIds);
        });

        const universal: number[] = [];
        const shared: { unitId: number; factionIds: number[] }[] = [];
        const unique: Record<number, number[]> = {};
        selectedFactionIds.forEach(fid => (unique[fid] = []));

        const allInvolvedUnitIds = new Set<number>();
        factionUnitMap.forEach(set => set.forEach(uid => allInvolvedUnitIds.add(uid)));

        allInvolvedUnitIds.forEach(uid => {
            const presentInFactions = selectedFactionIds.filter(fid => factionUnitMap.get(fid)?.has(uid));

            if (presentInFactions.length === selectedFactionIds.length) {
                universal.push(uid);
            } else if (presentInFactions.length === 1) {
                unique[presentInFactions[0]].push(uid);
            } else if (presentInFactions.length > 1) {
                shared.push({ unitId: uid, factionIds: presentInFactions });
            }
        });

        const getUnit = (id: number) => units.find(u => u.id === id);
        const sortUnits = (ids: number[]) =>
            ids
                .map(id => getUnit(id))
                .filter((u): u is Unit => u !== undefined)
                .sort((a, b) => (a.name || a.isc || '').localeCompare(b.name || b.isc || ''));

        const sharedGroupsMap = new Map<string, { factions: number[]; units: number[] }>();
        shared.forEach(item => {
            const key = [...item.factionIds].sort((a, b) => a - b).join(',');
            if (!sharedGroupsMap.has(key)) sharedGroupsMap.set(key, { factions: item.factionIds, units: [] });
            sharedGroupsMap.get(key)!.units.push(item.unitId);
        });

        const sharedGroups = Array.from(sharedGroupsMap.values())
            .map(group => ({
                factions: group.factions.map(fid => allFactions.find(f => f.id === fid)).filter((f): f is FactionEntry => f !== undefined),
                units: sortUnits(group.units),
            }))
            .filter(g => g.factions.length > 1)
            .sort((a, b) => b.factions.length - a.factions.length);

        return {
            universal: sortUnits(universal),
            sharedGroups,
            unique: Object.fromEntries(
                Object.entries(unique).map(([fid, uids]) => [Number(fid), sortUnits(uids)])
            ),
        };
    }, [selectedFactionIds, allFactions, units]);
}
