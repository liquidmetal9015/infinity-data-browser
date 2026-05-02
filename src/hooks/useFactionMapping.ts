import { useMemo } from 'react';
import { useDatabase } from './useDatabase';
import type { ListSummary } from '../services/listService';

/**
 * Maps faction_id → super-faction id, and computes which super-factions actually
 * appear in a given list collection. Shared between MyLists and ListsOverviewPage.
 */
export function useFactionMapping(lists: ListSummary[] | undefined) {
    const db = useDatabase();
    const groupedFactions = db.getGroupedFactions();

    const factionToSuperFaction = useMemo(() => {
        const map = new Map<number, number>();
        for (const sf of groupedFactions) {
            if (sf.vanilla) map.set(sf.vanilla.id, sf.id);
            for (const s of sf.sectorials) map.set(s.id, sf.id);
        }
        return map;
    }, [groupedFactions]);

    const activeSuperFactions = useMemo(() => {
        if (!lists) return [];
        const sfIds = new Set(lists.map(l => factionToSuperFaction.get(l.faction_id)).filter(Boolean));
        return groupedFactions.filter(sf => sfIds.has(sf.id));
    }, [lists, groupedFactions, factionToSuperFaction]);

    return { groupedFactions, factionToSuperFaction, activeSuperFactions };
}
