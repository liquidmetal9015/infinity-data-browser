// Compact Number Input with +/- buttons
import { Plus, Minus } from 'lucide-react';

interface CompactNumberProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    showZero?: boolean;
}

export const CompactNumber = ({
    label,
    value,
    onChange,
    min = 0,
    max = 25,
    showZero = false
}: CompactNumberProps) => (
    <div className="compact-input">
        <span className="compact-label">{label}</span>
        <div className="compact-controls">
            <button
                className="compact-btn"
                onClick={() => onChange(Math.max(min, value - 1))}
                disabled={value <= min}
            >
                <Minus size={14} />
            </button>
            <input
                type="number"
                className="compact-value"
                value={value}
                onChange={e => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))}
            />
            <button
                className="compact-btn"
                onClick={() => onChange(Math.min(max, value + 1))}
                disabled={value >= max}
            >
                <Plus size={14} />
            </button>
            {showZero && (
                <button
                    className="compact-btn zero-btn"
                    onClick={() => onChange(0)}
                    title="Set to 0"
                >
                    0
                </button>
            )}
        </div>
    </div>
);
