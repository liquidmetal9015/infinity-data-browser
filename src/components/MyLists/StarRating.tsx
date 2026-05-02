import { useState } from 'react';
import { Star } from 'lucide-react';

export function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [hover, setHover] = useState(0);
    const display = hover || value;
    return (
        <div
            style={{ display: 'flex', alignItems: 'center', gap: '1px', flexShrink: 0 }}
            onMouseLeave={() => setHover(0)}
            title={value > 0 ? `${value} / 5 — click same star to clear` : 'Rate this list'}
        >
            {[1, 2, 3, 4, 5].map(n => {
                const filled = n <= display;
                return (
                    <button
                        key={n}
                        onClick={(e) => { e.stopPropagation(); onChange(value === n ? 0 : n); }}
                        onMouseEnter={() => setHover(n)}
                        style={{
                            background: 'none',
                            border: 'none',
                            padding: '2px',
                            cursor: 'pointer',
                            color: filled ? '#f59e0b' : 'var(--text-tertiary, #64748b)',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: filled ? 1 : 0.45,
                            transition: 'opacity 0.1s, color 0.1s',
                        }}
                        aria-label={`${n} star${n === 1 ? '' : 's'}`}
                    >
                        <Star size={13} fill={filled ? '#f59e0b' : 'none'} strokeWidth={1.8} />
                    </button>
                );
            })}
        </div>
    );
}
