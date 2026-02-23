export type OrderType = 'regular' | 'irregular' | 'impetuous' | 'lieutenant' | 'tactical-awareness';

interface OrderIconProps {
    type: OrderType;
    size?: number;
    className?: string;
}

export function OrderIcon({ type, size = 16, className = '' }: OrderIconProps) {
    // We don't have an official SVG for tactical-awareness right now based on the list, 
    // so we will fallback to a custom styled span or SVG for just that one if needed, 
    // but the others map perfectly to filenames.

    if (type === 'tactical-awareness') {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 20 20"
                className={className}
                style={{ display: 'inline-block', verticalAlign: 'middle' }}
            >
                <title>TACTICAL AWARENESS</title>
                <circle cx="10" cy="10" r="9" fill="#a21caf" stroke="#d946ef" strokeWidth="1.5" />
                <g style={{ color: '#ffffff' }}>
                    <text x="10" y="14" fontSize="10" fontWeight="bold" textAnchor="middle" fill="currentColor">TA</text>
                </g>
            </svg>
        );
    }

    return (
        <img
            src={`/icons/${type}.svg`}
            alt={`${type} order`}
            width={size}
            height={size}
            className={`inline-block align-middle ${className}`}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
    );
}
