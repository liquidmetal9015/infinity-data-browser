// Visual Bar Graph for wounds distribution
import { clsx } from 'clsx';
import styles from './WoundsBar.module.css';

interface WoundsDistribution {
    wounds: Map<number, number>;
}

interface WoundsBarProps {
    active: WoundsDistribution;
    reactive: WoundsDistribution;
    fail: number;
}

interface Segment {
    w: number;
    p: number;
    type: string;
}

const wSegClass = [styles.segW1, styles.segW2, styles.segW3, styles.segW4, styles.segW5];

export const WoundsBar = ({ active, reactive, fail }: WoundsBarProps) => {
    const getSegs = (wounds: Map<number, number>, type: string): Segment[] =>
        Array.from(wounds.entries())
            .filter(([w, p]) => w > 0 && p > 0.001)
            .sort((a, b) => b[0] - a[0])
            .map(([w, p]) => ({ w, p, type }));

    const aSegs = getSegs(active.wounds, 'active');
    const rSegs = getSegs(reactive.wounds, 'reactive').reverse();

    return (
        <div className={styles.woundsBarContainer}>
            <div className={styles.woundsBar}>
                {aSegs.map(s => (
                    <div
                        key={`a${s.w}`}
                        className={clsx(styles.barSeg, styles.segActive, wSegClass[Math.min(s.w, 5) - 1])}
                        style={{ width: `${s.p * 100}%` }}
                        title={`Active: ${s.w} wounds (${(s.p * 100).toFixed(1)}%)`}
                    >
                        {s.p > 0.08 && <span>{s.w}</span>}
                    </div>
                ))}
                {fail > 0.01 && (
                    <div
                        className={clsx(styles.barSeg, styles.segFail)}
                        style={{ width: `${fail * 100}%` }}
                        title={`No result (${(fail * 100).toFixed(1)}%)`}
                    />
                )}
                {rSegs.map(s => (
                    <div
                        key={`r${s.w}`}
                        className={clsx(styles.barSeg, styles.segReactive, wSegClass[Math.min(s.w, 5) - 1])}
                        style={{ width: `${s.p * 100}%` }}
                        title={`Reactive: ${s.w} wounds (${(s.p * 100).toFixed(1)}%)`}
                    >
                        {s.p > 0.08 && <span>{s.w}</span>}
                    </div>
                ))}
            </div>
        </div>
    );
};
