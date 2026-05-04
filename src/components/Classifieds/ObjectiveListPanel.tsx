import { useState } from 'react';
import { clsx } from 'clsx';
import type { ClassifiedObjective } from '../../../shared/classifieds';
import { CATEGORIES } from '../../hooks/useListClassifiedCoverage';
import styles from './ClassifiedsExplorer.module.css';

interface ObjectiveListPanelProps {
    classifieds: ClassifiedObjective[];
    selectedClassified: number | null;
    /** Set of objective IDs that the selected unit can complete */
    highlightedObjectives: Set<number> | null;
    onSelect: (id: number | null) => void;
}

export function ObjectiveListPanel({
    classifieds,
    selectedClassified,
    highlightedObjectives,
    onSelect,
}: ObjectiveListPanelProps) {
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    // Group classifieds by category
    const grouped = CATEGORIES.map(cat => ({
        def: cat,
        objectives: classifieds.filter(c => c.category === cat.name),
    })).filter(g => g.objectives.length > 0);

    const toggleExpand = (id: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className={styles.objectivesPanel}>
            <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>Objectives</h3>
                <span className={styles.panelBadge}>{classifieds.length}</span>
            </div>

            {grouped.map(group => (
                <div key={group.def.name} className={styles.objCategoryGroup}>
                    <div className={styles.objCategoryLabel} style={{ color: group.def.color }}>
                        {group.def.short}
                    </div>
                    {group.objectives.map(cls => {
                        const isActive = selectedClassified === cls.id;
                        const isHighlighted = !isActive && highlightedObjectives?.has(cls.id) === true;
                        const isSubdued = highlightedObjectives !== null && !isHighlighted && !isActive;
                        const isExpanded = expandedIds.has(cls.id);

                        return (
                            <div key={cls.id}>
                                <div
                                    className={clsx(
                                        styles.objRow,
                                        isActive && styles.active,
                                        isHighlighted && styles.highlighted,
                                        isSubdued && styles.subdued,
                                    )}
                                    onClick={() => onSelect(isActive ? null : cls.id)}
                                >
                                    <div className={styles.objRowHeader}>
                                        <button
                                            className={clsx(styles.expandBtn, isExpanded && styles.expanded)}
                                            onClick={(e) => { e.stopPropagation(); toggleExpand(cls.id); }}
                                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                        >
                                            <span className={styles.expandIcon}>&#9656;</span>
                                        </button>
                                        <span className={styles.objRowName}>{cls.name}</span>
                                        <div className={styles.objRowTags}>
                                            {cls.designatedTroopers.map(dt => (
                                                <span key={dt} className={styles.objRowTag}>{dt}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className={styles.objRowDetail}>
                                        {cls.objective}
                                        {cls.bonus && <div className={styles.objRowBonus}>Bonus: {cls.bonus}</div>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
