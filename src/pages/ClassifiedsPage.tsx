import { useMemo } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { useGlobalFactionStore } from '../stores/useGlobalFactionStore';
import { CompactFactionSelector } from '../components/shared/CompactFactionSelector';
import { ClassifiedItem } from '../components/Classifieds/ClassifiedItem';
import { useClassifiedsStore } from '../stores/useClassifiedsStore';
import { clsx } from 'clsx';
import { useClassifiedMatches } from '../hooks/useClassifiedMatches';
import styles from './ClassifiedsPage.module.css';

export function ClassifiedsPage() {
    const db = useDatabase();
    const { globalFactionId, setGlobalFactionId } = useGlobalFactionStore();
    const {
        selectedClassified, selectedUnitISC, selectedProfileId,
        setSelectedClassified, setSelectedUnitISC, setSelectedProfileId,
    } = useClassifiedsStore();

    // Filter units for the selected faction
    const factionUnits = useMemo(() => {
        if (!globalFactionId) return [];
        return db.units
            .filter(u => u.factions.includes(globalFactionId))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [db.units, globalFactionId]);

    const unitMatches = useClassifiedMatches(db, globalFactionId ? factionUnits : []);


    if (!globalFactionId) {
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

    return (
        <div className="page-container">
            {/* Header */}
            <div className={clsx(styles.searchHeader, 'flex-row items-center border-b border-border pb-4 mb-6')}>
                <CompactFactionSelector
                    groupedFactions={db.getGroupedFactions()}
                    value={globalFactionId}
                    onChange={setGlobalFactionId}
                />
            </div>

            {/* Main Content Grid */}
            <div className={clsx(styles.classifiedsGrid, 'gap-6')}>

                {/* Left Column: Objectives */}
                <div className={clsx(styles.objectivesColumn, 'flex flex-col gap-4')}>
                    <div className={styles.columnHeader}>
                        <h2>Objectives</h2>
                        <span className={styles.badge}>{db.classifieds.length}</span>
                    </div>

                    <div className={clsx(styles.objectivesList, 'custom-scrollbar')}>
                        {db.classifieds.map(cls => {
                            // Determine relevance based on selected unit AND selected profile
                            let isRelevantToUnit = false;

                            if (selectedUnitISC && unitMatches) {
                                const matchData = unitMatches.get(selectedUnitISC);
                                if (matchData) {
                                    if (selectedProfileId) {
                                        // Check if the specific selected profile can complete it
                                        isRelevantToUnit = matchData.profileMatches.some(pm =>
                                            pm.option.id === selectedProfileId &&
                                            pm.matches.some(m => m.objectiveId === cls.id)
                                        );
                                    } else {
                                        // Check if ANY profile in the unit can complete it
                                        isRelevantToUnit = matchData.completableClassifieds.has(cls.id);
                                    }
                                }
                            }

                            const isActive = selectedClassified === cls.id || !!isRelevantToUnit;
                            const isSubdued = !!selectedUnitISC && !isRelevantToUnit;

                            return (
                                <ClassifiedItem
                                    key={cls.id}
                                    objective={cls}
                                    isActive={isActive}
                                    isSubdued={isSubdued}
                                    match={selectedUnitISC && isRelevantToUnit ? {
                                        objectiveId: cls.id,
                                        canComplete: true,
                                        reason: `Matching Requirements`
                                    } : undefined}
                                    onClick={() => {
                                        if (isActive && selectedClassified === cls.id) {
                                            setSelectedClassified(null);
                                        } else {
                                            setSelectedClassified(cls.id);
                                            setSelectedUnitISC(null); // Explicit selection mode
                                            setSelectedProfileId(null);
                                        }
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Right Column: Units */}
                <div className={clsx(styles.unitsColumn, 'flex flex-col gap-4')}>
                    <div className={styles.columnHeader}>
                        <h2>Available Units</h2>
                        <span className={styles.badge}>{factionUnits.length}</span>
                        {selectedClassified && (
                            <div className={styles.activeFilterBadge}>
                                Filtered: {db.classifieds.find(c => c.id === selectedClassified)?.name}
                            </div>
                        )}
                    </div>

                    <div className={styles.unitsGrid}>
                        {factionUnits.map(unit => {
                            const matchData = unitMatches?.get(unit.isc);

                            // If NO profiles in this unit can do anything, don't show it at all
                            if (!matchData) return null;

                            const canCompleteFocused = selectedClassified ? matchData.completableClassifieds.has(selectedClassified) : true;
                            const isSelected = selectedUnitISC === unit.isc;

                            return (
                                <div
                                    key={unit.isc}
                                    className={clsx(
                                        styles.unitCard,
                                        isSelected && styles.selected,
                                        selectedClassified && !canCompleteFocused && styles.subdued,
                                        selectedClassified && canCompleteFocused && styles.highlighted,
                                    )}
                                    onClick={() => {
                                        // Unit-level selection is less relevant now that profiles are explicit, 
                                        // but we can still allow clicking the card header to select the unit and clear objective mode
                                        if (isSelected) {
                                            setSelectedUnitISC(null);
                                            setSelectedProfileId(null);
                                        } else {
                                            setSelectedUnitISC(unit.isc);
                                            setSelectedProfileId(null);
                                            setSelectedClassified(null); // Explicit selection mode
                                        }
                                    }}
                                >
                                    <div className={styles.unitCardHeader}>
                                        <h3 className={styles.unitName}>{unit.name}</h3>
                                        {canCompleteFocused && selectedClassified && (
                                            <span className={styles.matchIndicator}>Match</span>
                                        )}
                                    </div>

                                    {/* Static Profile List */}
                                    <div className={styles.staticProfileList} onClick={e => e.stopPropagation()}>
                                        {matchData.profileMatches.map((pm, idx) => {
                                            const isProfileSelected = selectedProfileId === pm.option.id && isSelected;
                                            const matchesFocused = selectedClassified ? pm.matches.some(m => m.objectiveId === selectedClassified) : true;

                                            // Don't show the profile if it doesn't match the selected classified (when filtering by obj)
                                            if (selectedClassified && !matchesFocused) return null;

                                            const weapons = pm.option.weapons.map(w => w.name).filter(Boolean);
                                            const skills = pm.option.skills.map(s => s.displayName || s.name).filter(Boolean);
                                            const equips = pm.option.equipment.map(e => e.name).filter(Boolean);
                                            const loadoutText = [...weapons, ...skills, ...equips].join(', ');

                                            return (
                                                <div key={`${pm.profile.id}-${pm.option.id}-${idx}`} className={styles.profileRowContainer}>
                                                    <div
                                                        className={clsx(styles.profileRow, isProfileSelected && styles.active)}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            // Always ensure this unit is set as selected to avoid weird state mismatches
                                                            setSelectedUnitISC(unit.isc);
                                                            setSelectedProfileId(isProfileSelected ? null : pm.option.id);
                                                            setSelectedClassified(null); // Explicit selection clears objective
                                                        }}
                                                    >
                                                        <div className={styles.profileRowHeader}>
                                                            <div className={styles.profileNameTag}>{pm.option.name || "Standard Profile"}</div>
                                                            <div className={styles.profileStatsTag}>{pm.matches.length} Objs</div>
                                                        </div>
                                                        <div className={styles.profileLoadout}>{loadoutText || "Standard Loadout"}</div>
                                                    </div>

                                                    {/* If explicitly selected, show details on HOW it matches objectives */}
                                                    {isProfileSelected && (
                                                        <div className={styles.profileMatchReasons}>
                                                            <div className="reasons-header">Can complete:</div>
                                                            {pm.matches.map((m, mIdx) => {
                                                                const objName = db.classifieds.find(c => c.id === m.objectiveId)?.name || 'Objective';
                                                                return (
                                                                    <div key={mIdx} className={styles.reasonRow}>
                                                                        <div className={styles.reasonObj}>{objName}</div>
                                                                        <div className={styles.reasonText}>Via: {m.reason}</div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

        </div>
    );
}
