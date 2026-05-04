import { useMemo } from 'react';
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

    return (
        <div className={styles.explorerGrid}>
            <ObjectiveListPanel
                classifieds={db.classifieds}
                selectedClassified={selectedClassified}
                highlightedObjectives={highlightedObjectives}
                onSelect={(id) => setSelectedClassified(id)}
            />
            {unitMatches && (
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
            )}
        </div>
    );
}
