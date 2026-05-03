import { clsx } from 'clsx';
import type { CategoryCoverage } from '../../hooks/useListClassifiedCoverage';
import styles from './CoverageDashboard.module.css';

interface CoverageSummaryBarProps {
    coverageCount: number;
    totalCount: number;
    categories: CategoryCoverage[];
}

export function CoverageSummaryBar({ coverageCount, totalCount, categories }: CoverageSummaryBarProps) {
    const percent = Math.round((coverageCount / totalCount) * 100);

    return (
        <div className={styles.summaryBar}>
            <div className={styles.summaryHeader}>
                <span className={styles.summaryCount}>{coverageCount}/{totalCount}</span>
                <span className={styles.summaryLabel}>Classifieds Completable</span>
                <span className={styles.summaryPercent}>{percent}%</span>
            </div>

            <div className={styles.progressTrack}>
                {categories.map(cat => {
                    const fillPercent = cat.total > 0 ? (cat.covered / cat.total) * 100 : 0;
                    return (
                        <div key={cat.def.name} className={styles.progressSegment}>
                            <div
                                className={styles.progressSegmentFill}
                                style={{ width: `${fillPercent}%`, backgroundColor: cat.def.color }}
                            />
                        </div>
                    );
                })}
            </div>

            <div className={styles.categoryBreakdown}>
                {categories.map(cat => (
                    <span key={cat.def.name} className={styles.categoryItem}>
                        <span className={styles.categoryDot} style={{ backgroundColor: cat.def.color }} />
                        {cat.def.short}
                        <span className={clsx(styles.categoryCount, cat.covered === cat.total && styles.full)}>
                            {cat.covered}/{cat.total}
                        </span>
                    </span>
                ))}
            </div>
        </div>
    );
}
