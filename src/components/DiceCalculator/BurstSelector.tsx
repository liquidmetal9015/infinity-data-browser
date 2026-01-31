// Burst Selector with visual buttons

interface BurstSelectorProps {
    value: number;
    onChange: (v: number) => void;
    isReactive?: boolean;
}

export const BurstSelector = ({ value, onChange, isReactive = false }: BurstSelectorProps) => (
    <div className="burst-selector">
        <span className="compact-label">Burst</span>
        <div className="burst-buttons">
            {isReactive && (
                <button
                    className={`burst-btn ${value === 0 ? 'active' : ''}`}
                    onClick={() => onChange(0)}
                >
                    0
                </button>
            )}
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    className={`burst-btn ${value === n ? 'active' : ''}`}
                    onClick={() => onChange(n)}
                >
                    {n}
                </button>
            ))}
        </div>
    </div>
);
