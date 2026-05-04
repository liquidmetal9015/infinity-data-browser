import { clsx } from 'clsx';
import type { ObjectiveCoverage } from '../../hooks/useListClassifiedCoverage';
import type { CandidateUnit } from './CoverageDashboard';
import styles from './CoverageTable.module.css';

interface CoverageRowProps {
    coverage: ObjectiveCoverage;
    categoryColor: string;
    expanded: boolean;
    onToggle: () => void;
    candidates: CandidateUnit[];
    isLast: boolean;
}

const MAX_CHIPS = 4;

export function CoverageRow({ coverage, categoryColor, expanded, onToggle, candidates, isLast }: CoverageRowProps) {
    const { objective, covered, matchingListUnits } = coverage;

    // Deduplicate list unit chips by name
    const chipNames: string[] = [];
    const seen = new Set<string>();
    for (const m of matchingListUnits) {
        const name = m.listUnit.unit.name;
        if (!seen.has(name)) {
            seen.add(name);
            chipNames.push(name);
        }
    }

    const visibleChips = chipNames.slice(0, MAX_CHIPS);
    const overflowCount = chipNames.length - MAX_CHIPS;

    return (
        <>
            <div
                className={clsx(styles.coverageRow, !covered && styles.uncovered)}
                onClick={onToggle}
                style={isLast && !expanded ? { borderRadius: `0 0 var(--radius-md) var(--radius-md)` } : undefined}
            >
                <div className={styles.rowAccent} style={{ backgroundColor: categoryColor }} />
                <div className={clsx(styles.statusDot, covered ? styles.covered : styles.uncovered)} />
                <span className={styles.objName}>{objective.name}</span>
                <div className={styles.designatedTags}>
                    {objective.designatedTroopers.map(dt => (
                        <span key={dt} className={styles.designatedTag}>{dt}</span>
                    ))}
                </div>
                <div className={styles.unitChips}>
                    {visibleChips.map(name => (
                        <span key={name} className={styles.unitChip}>{name}</span>
                    ))}
                    {overflowCount > 0 && (
                        <span className={styles.overflowChip}>+{overflowCount}</span>
                    )}
                </div>
                <button
                    className={clsx(styles.expandBtn, expanded && styles.expanded)}
                    onClick={(e) => { e.stopPropagation(); onToggle(); }}
                    aria-label={expanded ? 'Collapse' : 'Expand'}
                >
                    <span className={styles.expandIcon}>&#9656;</span>
                </button>
            </div>

            {expanded && (
                <div
                    className={styles.expandedDetail}
                    style={isLast ? { borderRadius: `0 0 var(--radius-md) var(--radius-md)` } : undefined}
                >
                    <div className={styles.objDescription}>{objective.objective}</div>
                    {objective.bonus && <div className={styles.objBonus}>Bonus: {objective.bonus}</div>}
                    {objective.note && <div className={styles.objNote}>Note: {objective.note}</div>}

                    {/* List units that cover this */}
                    {matchingListUnits.length > 0 && (
                        <div className={styles.matchSection}>
                            <div className={styles.matchSectionLabel}>In your list</div>
                            <div className={styles.matchList}>
                                {matchingListUnits.map((m, i) => (
                                    <div key={i} className={styles.matchEntry}>
                                        <span className={styles.matchUnitName}>{m.listUnit.unit.name}</span>
                                        <span className={styles.matchReason}>via {m.reason}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Candidate faction units not in the list */}
                    {candidates.length > 0 && (
                        <div className={styles.matchSection}>
                            <div className={styles.candidateSectionLabel}>
                                Could cover this
                            </div>
                            <div className={styles.matchList}>
                                {candidates.map((c, i) => (
                                    <div key={i} className={clsx(styles.matchEntry, styles.candidateEntry)}>
                                        <span className={styles.matchUnitName}>{c.unitName}</span>
                                        <span className={styles.matchReason}>via {c.reason}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
