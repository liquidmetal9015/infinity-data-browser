import React from 'react';
import type { ClassifiedObjective, ClassifiedMatch } from '../../../shared/classifieds';
import { clsx } from 'clsx';
import styles from './ClassifiedItem.module.css';

interface ClassifiedItemProps {
    objective: ClassifiedObjective;
    match?: ClassifiedMatch;
    isActive: boolean; // Hovered or selected
    isSubdued: boolean; // If another item is active and this one isn't relevant
    onClick: () => void;
}

export const ClassifiedItem: React.FC<ClassifiedItemProps> = ({
    objective,
    match,
    isActive,
    isSubdued,
    onClick
}) => {
    return (
        <div
            className={clsx(
                styles.classifiedItem,
                isActive && styles.active,
                !isActive && match?.canComplete && styles.completable,
                isSubdued && styles.subdued,
            )}
            onClick={onClick}
        >
            <div className={styles.classifiedHeader}>
                <h3 className={styles.classifiedTitle}>{objective.name}</h3>
                <span className={styles.classifiedCategory}>{objective.category.split(' ')[0]}</span>
            </div>

            <p className={styles.classifiedDesc}>{objective.objective}</p>

            <div className={styles.classifiedDesignated}>
                <span className={styles.designatedLabel}>Designated:</span> {objective.designatedTroopers.join(', ')}
            </div>

            {match && match.canComplete && match.reason && (
                <div className={styles.classifiedMatchStatus}>
                    <span className={styles.matchIcon}>✓</span> Completable via {match.reason}
                </div>
            )}
        </div>
    );
};
