import { useState } from 'react';
import { clsx } from 'clsx';
import type { IDatabase } from '../../services/Database';
import styles from './ClassifiedsExplorer.module.css';

interface ClassifiedMatchEntry {
    unit: { isc: string; name: string };
    completableClassifieds: Set<number>;
    profileMatches: {
        profile: { id: number; name: string };
        option: { id: number; name: string; weapons: { name: string }[]; skills: { name: string; displayName?: string }[]; equipment: { name: string }[] };
        matches: { objectiveId: number; canComplete: boolean; reason: string }[];
    }[];
}

interface UnitListPanelProps {
    unitMatches: Map<string, ClassifiedMatchEntry>;
    db: IDatabase;
    selectedUnitISC: string | null;
    selectedProfileId: number | null;
    /** Set of unit ISCs that can complete the selected classified */
    highlightedUnits: Set<string> | null;
    onSelectUnit: (isc: string | null) => void;
    onSelectProfile: (isc: string, profileId: number | null) => void;
}

export function UnitListPanel({
    unitMatches,
    db,
    selectedUnitISC,
    selectedProfileId,
    highlightedUnits,
    onSelectUnit,
    onSelectProfile,
}: UnitListPanelProps) {
    const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

    const sortedUnits = Array.from(unitMatches.values()).sort((a, b) =>
        a.unit.name.localeCompare(b.unit.name)
    );

    const toggleExpand = (isc: string) => {
        setExpandedUnits(prev => {
            const next = new Set(prev);
            if (next.has(isc)) next.delete(isc);
            else next.add(isc);
            return next;
        });
    };

    return (
        <div className={styles.unitsPanel}>
            <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>Units</h3>
                <span className={styles.panelBadge}>{sortedUnits.length}</span>
            </div>

            <div className={styles.unitsList}>
                {sortedUnits.map(entry => {
                    const isActive = selectedUnitISC === entry.unit.isc;
                    const isHighlighted = !isActive && highlightedUnits?.has(entry.unit.isc) === true;
                    const isSubdued = highlightedUnits !== null && !isHighlighted && !isActive;
                    const isExpanded = expandedUnits.has(entry.unit.isc);

                    return (
                        <div key={entry.unit.isc}>
                            <div
                                className={clsx(
                                    styles.unitRow,
                                    isActive && styles.active,
                                    isHighlighted && styles.highlighted,
                                    isSubdued && styles.subdued,
                                )}
                                onClick={() => onSelectUnit(isActive ? null : entry.unit.isc)}
                            >
                                <button
                                    className={clsx(styles.expandBtn, isExpanded && styles.expanded)}
                                    onClick={(e) => { e.stopPropagation(); toggleExpand(entry.unit.isc); }}
                                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                >
                                    <span className={styles.expandIcon}>&#9656;</span>
                                </button>
                                <span className={styles.unitRowName}>{entry.unit.name}</span>
                                <span className={styles.unitRowCount}>{entry.completableClassifieds.size} objs</span>
                            </div>

                            {isExpanded && (
                                <div className={styles.unitDetail}>
                                    {entry.profileMatches.map((pm, idx) => {
                                        const isProfileActive = isActive && selectedProfileId === pm.option.id;
                                        const weapons = pm.option.weapons.map(w => w.name).filter(Boolean);
                                        const skills = pm.option.skills.map(s => s.displayName || s.name).filter(Boolean);
                                        const equips = pm.option.equipment.map(e => e.name).filter(Boolean);
                                        const loadoutText = [...weapons, ...skills, ...equips].join(', ');

                                        return (
                                            <div
                                                key={`${pm.profile.id}-${pm.option.id}-${idx}`}
                                                className={clsx(styles.profileEntry, isProfileActive && styles.active)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectProfile(
                                                        entry.unit.isc,
                                                        isProfileActive ? null : pm.option.id
                                                    );
                                                }}
                                            >
                                                <div className={styles.profileHeader}>
                                                    <span className={styles.profileName}>
                                                        {pm.option.name || 'Standard Profile'}
                                                    </span>
                                                    <span className={styles.profileObjCount}>
                                                        {pm.matches.length} objs
                                                    </span>
                                                </div>
                                                <div className={styles.profileLoadout}>
                                                    {loadoutText || 'Standard Loadout'}
                                                </div>

                                                {isProfileActive && (
                                                    <div className={styles.profileMatches}>
                                                        {pm.matches.map((m, mIdx) => {
                                                            const objName = db.classifieds.find(c => c.id === m.objectiveId)?.name || 'Objective';
                                                            return (
                                                                <div key={mIdx} className={styles.profileMatchRow}>
                                                                    <span className={styles.profileMatchObj}>{objName}</span>
                                                                    <span className={styles.profileMatchReason}>via {m.reason}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
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
}
