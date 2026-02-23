export type OrderType = 'regular' | 'irregular' | 'impetuous' | 'lieutenant' | 'tactical-awareness';

interface OrderIconProps {
    type: OrderType;
    size?: number;
    className?: string;
}

export function OrderIcon({ type, size = 16, className = '' }: OrderIconProps) {
    // Map order type to filename — tactical-awareness uses the official Corvus Belli SVG
    const filename = type === 'tactical-awareness'
        ? 'logos/order-tactical-awareness.svg'
        : `icons/${type}.svg`;

    return (
        <img
            src={`${import.meta.env.BASE_URL}${filename}`}
            alt={`${type} order`}
            width={size}
            height={size}
            className={`inline-block align-middle ${className}`}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
    );
}
