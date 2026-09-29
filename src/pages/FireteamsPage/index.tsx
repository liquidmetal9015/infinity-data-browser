import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { useSearchParams } from 'react-router-dom';
import { useDatabase } from '../../hooks/useDatabase';
import { Layers, Shield, Users, Info, Calculator } from 'lucide-react';
import { CompactFactionSelector } from '../../components/shared/CompactFactionSelector';
import { FireteamListView } from './FireteamListView';
import { UnitPerspectiveView } from './UnitPerspectiveView';
import { FireteamBuilder } from './FireteamBuilder';
import styles from './FireteamsPage.module.css';

export function FireteamsPage() {
    const db = useDatabase();
    const [searchParams, setSearchParams] = useSearchParams();
    const [viewMode, setViewMode] = useState<'teams' | 'units' | 'builder'>('teams');

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

    const defaultFactionId = useMemo(() => {
        return groupedOptions[0]?.sectorials[0]?.id || groupedOptions[0]?.vanilla?.id || 101;
    }, [groupedOptions]);

    const urlFactionParam = searchParams.get('faction');
    const effectiveFactionId = urlFactionParam ? Number(urlFactionParam) : defaultFactionId;

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
            setSearchParams({ faction: String(factionId) });
            setViewMode('teams');
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-7xl mx-auto w-full">
            {/* Header section with title and faction selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                        <Layers className="text-blue-400" size={24} />
                        <span>Fireteam Charts</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">
                        Sectorial fireteam composition options, fireteam rules, and wildcards
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">Faction:</span>
                        <div className="flex-1 sm:w-72">
                            <CompactFactionSelector
                                groupedFactions={groupedOptions}
                                value={effectiveFactionId}
                                onChange={handleSelectFaction}
                            />
                        </div>
                    </div>

                    {fireteamChart && (
                        <div className={clsx(styles.viewToggles, "w-full sm:w-auto")}>
                            <button
                                className={clsx(styles.toggleBtn, viewMode === 'teams' && styles.active, "flex-1 sm:flex-initial justify-center")}
                                onClick={() => setViewMode('teams')}
                            >
                                <Layers size={16} />
                                <span>Table</span>
                            </button>
                            <button
                                className={clsx(styles.toggleBtn, viewMode === 'builder' && styles.active, "flex-1 sm:flex-initial justify-center")}
                                onClick={() => setViewMode('builder')}
                            >
                                <Calculator size={16} />
                                <span>Builder</span>
                            </button>
                            <button
                                className={clsx(styles.toggleBtn, viewMode === 'units' && styles.active, "flex-1 sm:flex-initial justify-center")}
                                onClick={() => setViewMode('units')}
                            >
                                <Users size={16} />
                                <span>By Unit</span>
                            </button>
                        </div>
                    )}
                </div>
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
                        <div>
                            <h3>{activeFaction?.name} Fireteams</h3>
                            {fireteamChart.desc && (
                                <p className="text-xs text-amber-400/90 italic mt-1">{fireteamChart.desc}</p>
                            )}
                        </div>
                        <div className={styles.legend}>
                            <span className={clsx(styles.badge, styles.duo)}>DUO (2)</span>
                            <span className={clsx(styles.badge, styles.haris)}>HARIS (3)</span>
                            <span className={clsx(styles.badge, styles.core)}>
                                CORE ({fireteamChart?.desc?.includes('maximum of 4 members') || effectiveFactionId === 703 ? '3-4' : '3-5'})
                            </span>
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
