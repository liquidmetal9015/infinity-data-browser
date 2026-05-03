import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { useDatabase } from '../../hooks/useDatabase';
import { Layers, Shield, Users, Info, Calculator } from 'lucide-react';
import { useGlobalFactionStore } from '../../stores/useGlobalFactionStore';
import { CompactFactionSelector } from '../../components/shared/CompactFactionSelector';
import { FireteamListView } from './FireteamListView';
import { UnitPerspectiveView } from './UnitPerspectiveView';
import { FireteamBuilder } from './FireteamBuilder';
import { useAppModeStore } from '../../stores/useAppModeStore';
import { useListStore } from '../../stores/useListStore';
import styles from './FireteamsPage.module.css';

export function FireteamsPage() {
    const db = useDatabase();
    const { globalFactionId, setGlobalFactionId } = useGlobalFactionStore();
    const [viewMode, setViewMode] = useState<'teams' | 'units' | 'builder'>('teams');
    const { appMode } = useAppModeStore();
    const { currentList } = useListStore();

    const inBuilderWithList = appMode === 'builder' && !!currentList;
    const effectiveFactionId = inBuilderWithList ? currentList.factionId : globalFactionId;

    // Get all factions with fireteam data, grouped by super-faction
    const groupedOptions = useMemo(() => {
        return db.getGroupedFactions()
            .map(group => ({
                ...group,
                // Only include if they have a fireteam chart
                vanilla: (group.vanilla && db.getFireteamChart(group.vanilla.id)) ? group.vanilla : null,
                sectorials: group.sectorials.filter(s => db.getFireteamChart(s.id))
            }))
            .filter(group => group.vanilla || group.sectorials.length > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [db]);

    const fireteamChart = useMemo(() => {
        if (!effectiveFactionId) return null;
        return db.getFireteamChart(effectiveFactionId);
    }, [effectiveFactionId, db]);

    const activeFaction = useMemo(() => {
        if (!effectiveFactionId) return null;
        return db.getFactionInfo(effectiveFactionId);
    }, [effectiveFactionId, db]);

    const handleSelectFaction = (factionId: number) => {
        if (factionId) {
            setGlobalFactionId(factionId);
            setViewMode('teams');
        }
    };

    return (
        <div className={clsx('page-container', styles.fireteamsPage)}>
            <div className={styles.controlsSection}>
                {!inBuilderWithList && (
                    <div className={styles.selectorContainer}>
                        <CompactFactionSelector
                            groupedFactions={groupedOptions}
                            value={globalFactionId}
                            onChange={handleSelectFaction}
                        />
                    </div>
                )}

                {fireteamChart && (
                    <div className={styles.viewToggles}>
                        <button
                            className={clsx(styles.toggleBtn, viewMode === 'teams' && styles.active)}
                            onClick={() => setViewMode('teams')}
                        >
                            <Layers size={18} />
                            Table
                        </button>
                        <button
                            className={clsx(styles.toggleBtn, viewMode === 'builder' && styles.active)}
                            onClick={() => setViewMode('builder')}
                        >
                            <Calculator size={18} />
                            Builder
                        </button>
                        <button
                            className={clsx(styles.toggleBtn, viewMode === 'units' && styles.active)}
                            onClick={() => setViewMode('units')}
                        >
                            <Users size={18} />
                            By Unit
                        </button>
                    </div>
                )}
            </div>

            {!effectiveFactionId ? (
                <div className={styles.emptyState}>
                    <Shield size={48} className="text-secondary" />
                    <p>Select a Sectorial Army to view its Fireteams.</p>
                </div>
            ) : !fireteamChart ? (
                <div className={styles.emptyState}>
                    <Info size={48} className="text-secondary" />
                    <p>No Fireteam data available for this faction.</p>
                </div>
            ) : (
                <div className="content-area">
                    <div className={styles.factionHeader}>
                        <h3>{activeFaction?.name} Fireteams</h3>
                        <div className={styles.legend}>
                            <span className={clsx(styles.badge, styles.duo)}>DUO (2)</span>
                            <span className={clsx(styles.badge, styles.haris)}>HARIS (3)</span>
                            <span className={clsx(styles.badge, styles.core)}>CORE (3-5)</span>
                        </div>
                    </div>

                    {viewMode === 'teams' && <FireteamListView chart={fireteamChart} factionId={effectiveFactionId} />}
                    {viewMode === 'units' && <UnitPerspectiveView chart={fireteamChart} db={db} factionId={effectiveFactionId} />}
                    {viewMode === 'builder' && <FireteamBuilder key={effectiveFactionId} chart={fireteamChart} factionId={effectiveFactionId} />}
                </div>
            )}
        </div>
    );
}
