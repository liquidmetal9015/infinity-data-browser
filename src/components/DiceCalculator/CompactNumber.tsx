// Compact Number Input with +/- buttons
import { Plus, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import styles from './CompactNumber.module.css';

interface CompactNumberProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    showZero?: boolean;
    readOnly?: boolean;
}

export const CompactNumber = ({
    label,
    value,
    onChange,
    min = 0,
    max = 25,
    showZero = false,
    readOnly = false
}: CompactNumberProps) => (
    <div className={styles.compactInput}>
        <span className={styles.label}>{label}</span>
        <div className={styles.controls}>
            <button
                className={styles.btn}
                onClick={() => onChange(Math.max(min, value - 1))}
                disabled={value <= min || readOnly}
            >
                <Minus size={14} />
            </button>
            <input
                type="number"
                className={styles.value}
                value={value}
                onChange={e => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))}
                readOnly={readOnly}
            />
            <button
                className={styles.btn}
                onClick={() => onChange(Math.min(max, value + 1))}
                disabled={value >= max || readOnly}
            >
                <Plus size={14} />
            </button>
            {showZero && (
                <button
                    className={clsx(styles.btn, styles.zeroBtn)}
                    onClick={() => onChange(0)}
                    title="Set to 0"
                >
                    0
                </button>
            )}
        </div>
    </div>
);
