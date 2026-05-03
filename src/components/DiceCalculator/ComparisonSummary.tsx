// Comparison Summary showing win probabilities
import { clsx } from 'clsx';
import { Swords, Shield } from 'lucide-react';
import styles from './ComparisonSummary.module.css';

interface SideResult {
    winProbability: number;
    expectedWounds: number;
}

interface ComparisonSummaryProps {
    active: SideResult;
    reactive: SideResult;
    fail: number;
}

export const ComparisonSummary = ({ active, reactive, fail }: ComparisonSummaryProps) => {
    const activeWin = active.winProbability;
    const reactiveWin = reactive.winProbability;

    const diff = activeWin - reactiveWin;
    const favoredSide = diff > 0.01 ? 'Active' : diff < -0.01 ? 'Reactive' : 'Even';
    const favoredPercent = Math.abs(diff * 100).toFixed(1);

    return (
        <div className={styles.comparisonSummary}>
            <div className={clsx(styles.summarySide, styles.activeSide, favoredSide === 'Active' && styles.favored)}>
                <Swords size={20} />
                <div className={styles.summaryStats}>
                    <span className={styles.summaryPct}>{(activeWin * 100).toFixed(1)}%</span>
                    <span className={styles.summaryLabel}>Active Wins</span>
                </div>
                <span className={styles.summaryWounds}>Avg: {active.expectedWounds.toFixed(2)} wounds</span>
            </div>

            <div className={styles.summaryCenter}>
                {favoredSide !== 'Even' ? (
                    <>
                        <span className={styles.favorArrow}>{favoredSide === 'Active' ? '←' : '→'}</span>
                        <span className={styles.favorText}>{favoredSide} +{favoredPercent}%</span>
                    </>
                ) : (
                    <span className={styles.favorText}>Even Odds</span>
                )}
                <span className={styles.failText}>Fail: {(fail * 100).toFixed(1)}%</span>
            </div>

            <div className={clsx(styles.summarySide, styles.reactiveSide, favoredSide === 'Reactive' && styles.favored)}>
                <Shield size={20} />
                <div className={styles.summaryStats}>
                    <span className={styles.summaryPct}>{(reactiveWin * 100).toFixed(1)}%</span>
                    <span className={styles.summaryLabel}>Reactive Wins</span>
                </div>
                <span className={styles.summaryWounds}>Avg: {reactive.expectedWounds.toFixed(2)} wounds</span>
            </div>
        </div>
    );
};
