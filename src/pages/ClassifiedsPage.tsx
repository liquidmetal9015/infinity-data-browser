import { useMemo } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { useGlobalFactionStore } from '../stores/useGlobalFactionStore';
import { CompactFactionSelector } from '../components/shared/CompactFactionSelector';
import { useAppModeStore } from '../stores/useAppModeStore';
import { useListStore } from '../stores/useListStore';
import { CoverageDashboard } from '../components/Classifieds/CoverageDashboard';
import { ClassifiedsExplorer } from '../components/Classifieds/ClassifiedsExplorer';

export function ClassifiedsPage() {
    const db = useDatabase();
    const { globalFactionId, setGlobalFactionId } = useGlobalFactionStore();
    const { appMode } = useAppModeStore();
    const { currentList } = useListStore();

    const inBuilderWithList = appMode === 'builder' && !!currentList;
    const effectiveFactionId = inBuilderWithList ? currentList.factionId : globalFactionId;

    // Faction units — needed for both modes (explorer display + dashboard candidates)
    const factionUnits = useMemo(() => {
        if (!effectiveFactionId) return [];
        return db.units
            .filter(u => u.factions.includes(effectiveFactionId))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [db.units, effectiveFactionId]);

    // No faction selected in explorer mode
    if (!effectiveFactionId) {
        return (
            <div className="page-container">
                <div className="empty-state-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '50vh', gap: '2rem' }}>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Classifieds Analysis</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Select a faction to view which units can complete which classified objectives.</p>
                    </div>
                    <CompactFactionSelector
                        groupedFactions={db.getGroupedFactions()}
                        value={globalFactionId}
                        onChange={setGlobalFactionId}
                    />
                </div>
            </div>
        );
    }

    // Mode A: List builder context — coverage dashboard
    if (inBuilderWithList) {
        return (
            <div className="page-container">
                <CoverageDashboard list={currentList} db={db} factionUnits={factionUnits} />
            </div>
        );
    }

    // Mode B: Explorer context — two-panel layout
    return (
        <div className="page-container">
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <CompactFactionSelector
                    groupedFactions={db.getGroupedFactions()}
                    value={globalFactionId}
                    onChange={setGlobalFactionId}
                />
            </div>
            <ClassifiedsExplorer factionUnits={factionUnits} db={db} />
        </div>
    );
}
