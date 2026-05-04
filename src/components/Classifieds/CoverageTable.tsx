import { useState } from 'react';
import { clsx } from 'clsx';
import type { CategoryCoverage } from '../../hooks/useListClassifiedCoverage';
import type { CandidateUnit } from './CoverageDashboard';
import { CoverageRow } from './CoverageRow';
import styles from './CoverageTable.module.css';

interface CoverageTableProps {
    categories: CategoryCoverage[];
    candidatesByObjective: Map<number, CandidateUnit[]>;
}

export function CoverageTable({ categories, candidatesByObjective }: CoverageTableProps) {
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    const toggleExpand = (id: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div>
            {categories.map((cat, catIdx) => (
                <div key={cat.def.name} className={styles.categorySection} style={catIdx > 0 ? { marginTop: 'var(--space-3)' } : undefined}>
                    <div className={styles.categoryHeader}>
                        <span className={styles.categoryName} style={{ color: cat.def.color }}>{cat.def.short}</span>
                        <span className={clsx(styles.categoryScore, cat.covered === cat.total && styles.full)}>
                            {cat.covered}/{cat.total}
                        </span>
                    </div>
                    {cat.objectives.map((cov, i) => (
                        <CoverageRow
                            key={cov.objective.id}
                            coverage={cov}
                            categoryColor={cat.def.color}
                            expanded={expandedIds.has(cov.objective.id)}
                            onToggle={() => toggleExpand(cov.objective.id)}
                            candidates={candidatesByObjective.get(cov.objective.id) || []}
                            isLast={i === cat.objectives.length - 1}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}
