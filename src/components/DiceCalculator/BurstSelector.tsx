// Burst Selector with visual buttons
import { clsx } from 'clsx';
import styles from './BurstSelector.module.css';

interface BurstSelectorProps {
    value: number;
    onChange: (v: number) => void;
    isReactive?: boolean;
    readOnly?: boolean;
}

export const BurstSelector = ({ value, onChange, isReactive = false, readOnly = false }: BurstSelectorProps) => (
    <div className={styles.burstSelector}>
        <span className={styles.label}>Burst</span>
        <div className={styles.buttons}>
            {isReactive && (
                <button
                    className={clsx(styles.btn, value === 0 && (isReactive ? styles.reactiveActive : styles.active))}
                    onClick={() => onChange(0)}
                    disabled={readOnly}
                >
                    0
                </button>
            )}
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    className={clsx(styles.btn, value === n && (isReactive ? styles.reactiveActive : styles.active))}
                    onClick={() => onChange(n)}
                    disabled={readOnly}
                >
                    {n}
                </button>
            ))}
        </div>
    </div>
);
