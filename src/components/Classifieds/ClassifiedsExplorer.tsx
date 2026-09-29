import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { Target, Users } from 'lucide-react';
import { useClassifiedsStore } from '../../stores/useClassifiedsStore';
import { useClassifiedMatches } from '../../hooks/useClassifiedMatches';
import type { IDatabase } from '../../services/Database';
import type { Unit } from '../../../shared/types';
import { ObjectiveListPanel } from './ObjectiveListPanel';
import { UnitListPanel } from './UnitListPanel';
import styles from './ClassifiedsExplorer.module.css';

interface ClassifiedsExplorerProps {
    factionUnits: Unit[];
    db: IDatabase;
}

export function ClassifiedsExplorer({ factionUnits, db }: ClassifiedsExplorerProps) {
    const {
        selectedClassified, selectedUnitISC, selectedProfileId,
        setSelectedClassified, setSelectedUnitISC, setSelectedProfileId,
    } = useClassifiedsStore();

    const [mobileTab, setMobileTab] = useState<'objectives' | 'units'>('objectives');
    const unitMatches = useClassifiedMatches(db, factionUnits);

    // Compute highlighted objectives (when a unit is selected)
    const highlightedObjectives = useMemo(() => {
        if (!selectedUnitISC || !unitMatches) return null;
        const entry = unitMatches.get(selectedUnitISC);
        if (!entry) return null;

        // If a specific profile is selected, only show that profile's objectives
        if (selectedProfileId) {
            const pm = entry.profileMatches.find(p => p.option.id === selectedProfileId);
            if (pm) {
                return new Set(pm.matches.map(m => m.objectiveId));
            }
        }
        return entry.completableClassifieds;
    }, [selectedUnitISC, selectedProfileId, unitMatches]);

    // Compute highlighted units (when an objective is selected)
    const highlightedUnits = useMemo(() => {
        if (!selectedClassified || !unitMatches) return null;
        const matching = new Set<string>();
        for (const [isc, entry] of unitMatches) {
            if (entry.completableClassifieds.has(selectedClassified)) {
                matching.add(isc);
            }
        }
        return matching;
    }, [selectedClassified, unitMatches]);

    const handleSelectObjective = (id: number | null) => {
        setSelectedClassified(id);
    };

    return (
        <div className="flex flex-col w-full">
            {/* Mobile Tab Switcher (visible on screens <= 1024px) */}
            <div className={styles.mobileTabs}>
                <button
                    type="button"
                    onClick={() => setMobileTab('objectives')}
                    className={clsx(styles.mobileTabBtn, mobileTab === 'objectives' && styles.active)}
                >
                    <Target size={16} />
                    <span>Objectives</span>
                    {highlightedObjectives && (
                        <span className={clsx(styles.mobileBadge, styles.activeBadge)}>
                            {highlightedObjectives.size} valid
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => setMobileTab('units')}
                    className={clsx(styles.mobileTabBtn, mobileTab === 'units' && styles.active)}
                >
                    <Users size={16} />
                    <span>Units</span>
                    {highlightedUnits && (
                        <span className={clsx(styles.mobileBadge, styles.activeBadge)}>
                            {highlightedUnits.size} match
                        </span>
                    )}
                </button>
            </div>

            <div className={styles.explorerGrid}>
                <div className={clsx(mobileTab !== 'objectives' && styles.panelHiddenMobile, 'flex flex-col min-h-0')}>
                    <ObjectiveListPanel
                        classifieds={db.classifieds}
                        selectedClassified={selectedClassified}
                        highlightedObjectives={highlightedObjectives}
                        onSelect={handleSelectObjective}
                    />
                </div>
                {unitMatches && (
                    <div className={clsx(mobileTab !== 'units' && styles.panelHiddenMobile, 'flex flex-col min-h-0')}>
                        <UnitListPanel
                            unitMatches={unitMatches}
                            db={db}
                            selectedUnitISC={selectedUnitISC}
                            selectedProfileId={selectedProfileId}
                            highlightedUnits={highlightedUnits}
                            onSelectUnit={(isc) => setSelectedUnitISC(isc)}
                            onSelectProfile={(isc, profileId) => {
                                setSelectedUnitISC(isc);
                                setSelectedProfileId(profileId);
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
