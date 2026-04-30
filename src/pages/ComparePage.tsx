import { useMemo } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { useModal } from '../hooks/useModal';
import { Users, Check, Layers } from 'lucide-react';
import { useCompareStore } from '../stores/useCompareStore';
import { MultiFactionSelector } from '../components/MultiFactionSelector';
import { getSafeLogo } from '../utils/assets';
import { clsx } from 'clsx';
import { useFactionsComparison } from '../hooks/useFactionsComparison';
import styles from './ComparePage.module.css';

export function ComparePage() {
    const db = useDatabase();
    const { openUnitModal } = useModal();
    const { selectedFactionIds, setFactions, addMultipleFactions, clearAll } = useCompareStore();

    const getLogoUrl = (logo: string | undefined | null) => getSafeLogo(logo);

    // Get all factions
    const allFactions = useMemo(() => {
        if (!db.metadata) return [];
        return db.metadata.factions
            .filter(f => db.factionHasData(f.id))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [db]);

    const groupedFactions = useMemo(() => {
        return db.getGroupedFactions();
    }, [db]);



    const selectedFactions = useMemo(() => {
        return selectedFactionIds.map(id => allFactions.find(f => f.id === id)).filter(Boolean) as typeof allFactions;
    }, [selectedFactionIds, allFactions]);

    const analysis = useFactionsComparison(selectedFactionIds, allFactions, db.units);

    const addSuperFaction = (superId: number) => {
        const superFaction = groupedFactions.find(sf => sf.id === superId);
        if (!superFaction) return;

        const validIds = new Set(allFactions.map(f => f.id));
        const idsToAdd: number[] = [];

        if (superFaction.vanilla && validIds.has(superFaction.vanilla.id)) {
            idsToAdd.push(superFaction.vanilla.id);
        }

        superFaction.sectorials.forEach(child => {
            if (validIds.has(child.id)) {
                idsToAdd.push(child.id);
            }
        });

        addMultipleFactions(idsToAdd);
    };

    return (
        <div className={clsx('page-container', styles.comparePage)}>

            {/* Controls */}
            <div className={styles.controlsSection}>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full">
                    <div className="flex-1">
                        <MultiFactionSelector
                            value={selectedFactionIds}
                            onChange={setFactions}
                            groupedFactions={groupedFactions}
                            placeholder="Search & Add Factions..."
                        />
                    </div>
                    <button
                        onClick={clearAll}
                        className="px-6 py-4 bg-[#18181b] hover:bg-[#1f1f23] border border-[#ffffff14] text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap h-[58px]"
                        disabled={selectedFactions.length === 0}
                    >
                        Clear All
                    </button>
                </div>

                {/* Quick Add Buttons */}
                <div className="flex flex-wrap items-center gap-3 mt-4 w-full bg-gray-900/50 p-4 rounded-xl border border-gray-800/60">
                    <span className="text-sm font-bold text-gray-400 mr-1 uppercase tracking-wider">Quick Compare</span>
                    <div className="w-px h-6 bg-gray-700 mx-2 hidden sm:block"></div>
                    {groupedFactions.map(sf => {
                        const hasLogo = sf.vanilla?.logo || (sf.sectorials.length > 0 ? sf.sectorials[0].logo : undefined);
                        const logoSrc = getLogoUrl(hasLogo);

                        return (
                            <button
                                key={sf.id}
                                onClick={() => addSuperFaction(sf.id)}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-base font-semibold text-gray-200 transition-colors shadow-md hover:shadow-lg hover:border-accent-500"
                                title={`Compare all ${sf.name} armies`}
                            >
                                {logoSrc && (
                                    <img src={logoSrc} alt="" className="h-5 w-5 object-contain opacity-90" />
                                )}
                                {sf.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Analysis Results */}
            {!analysis ? (
                <div className={styles.emptyState}>
                    <Layers size={48} className="text-secondary" />
                    <p>Select at least two factions to compare overlapping units.</p>
                </div>
            ) : (
                <div className={styles.analysisGrid}>
                    {/* 1. Universal Units */}
                    {analysis.universal.length > 0 && (
                        <div className={clsx(styles.section, 'universal-section')}>
                            <h3>
                                <Check size={20} />
                                Universal Units
                                <span className={styles.countBadge}>{analysis.universal.length}</span>
                            </h3>
                            <div className={styles.unitListRow}>
                                {analysis.universal.map(u => (
                                    <div
                                        key={u.id}
                                        className={clsx(styles.unitCard, styles.universal, 'cursor-pointer hover:border-success/80 transition-colors')}
                                        onClick={() => openUnitModal(u)}
                                    >
                                        {u.name || u.isc || 'Unknown'}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 2. Partially Shared Groups */}
                    {analysis.sharedGroups.length > 0 && (
                        <div className={clsx(styles.section, 'shared-section')}>
                            <h3>
                                <Users size={20} />
                                Shared Units (Partial Overlap)
                            </h3>
                            <div className={styles.sharedGroupsContainer}>
                                {analysis.sharedGroups.map((group, idx) => (
                                    <div key={idx} className={styles.sharedGroupBlock}>
                                        <div className={styles.groupHeader}>
                                            <div className={styles.factionTags}>
                                                {group.factions.map(f => {
                                                    const color = `hsl(${(f.id * 137.5) % 360}, 70%, 50%)`;
                                                    return (
                                                        <span key={f.id} className="group-tag flex items-center gap-2 px-3 py-1.5 rounded bg-gray-800/80 border" style={{ borderColor: color }}>
                                                            {getLogoUrl(f.logo) && <img src={getLogoUrl(f.logo) as string} alt="" className="h-6 w-6 object-contain opacity-90" />}
                                                            <span style={{ color }} className="text-base font-semibold">{f.name}</span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            <span className={styles.countBadge}>{group.units.length}</span>
                                        </div>
                                        <div className={styles.unitListRow}>
                                            {group.units.map(unit => (
                                                <div
                                                    key={unit.id}
                                                    className={clsx(styles.unitCard, styles.shared, 'cursor-pointer hover:border-primary/80 transition-colors')}
                                                    onClick={() => openUnitModal(unit)}
                                                >
                                                    {unit.name || unit.isc || 'Unknown'}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 3. Unique Units Columns */}
                    <div className={styles.uniqueColumnsWrapper}>
                        <h3>Unique to Faction (Relative to Selection)</h3>
                        <div className={styles.uniqueColumns}>
                            {selectedFactions.map(f => {
                                const units = analysis.unique[f.id] || [];
                                const color = `hsl(${(f.id * 137.5) % 360}, 70%, 50%)`;
                                return (
                                    <div key={f.id} className={styles.factionColumn} style={{ borderTopColor: color }}>
                                        <div className={clsx(styles.columnHeader, 'flex flex-col items-center pb-2')}>
                                            {getLogoUrl(f.logo) && <img src={getLogoUrl(f.logo) as string} alt="" className="h-8 w-8 object-contain mb-2 opacity-90" />}
                                            <h4 style={{ color }} className="text-center font-bold text-lg">{f.name}</h4>
                                            <span className="count">{units.length} unique</span>
                                        </div>
                                        <div className={styles.compareColumnContent}>
                                            {units.length === 0 ? (
                                                <div className={styles.emptyCol}>- No unique units -</div>
                                            ) : (
                                                units.map(u => (
                                                    <div
                                                        key={u.id}
                                                        className={clsx(styles.unitItemCompact, 'cursor-pointer hover:text-accent transition-colors')}
                                                        onClick={() => openUnitModal(u)}
                                                    >
                                                        {u.name || u.isc || 'Unknown'}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
