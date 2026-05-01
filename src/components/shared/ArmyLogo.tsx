// Infinity Army logo mark — text removed, for use in "Open in Army" actions only
interface ArmyLogoProps {
    size?: number;
    className?: string;
    /** Wraps the icon in a small dark rounded backdrop so it reads clearly on any bg */
    backdrop?: boolean;
}

export function ArmyLogo({ size = 20, className, backdrop = false }: ArmyLogoProps) {
    const svg = (
        <svg
            width={size}
            height={size}
            viewBox="0 0 260.6 252"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden="true"
            style={{ display: 'block', flexShrink: 0 }}
        >
            {/* Outer silhouette — keep original near-black so the orange reads well */}
            <path
                fill="#1E1E1C"
                d="M130.3,29.9L3.9,250l126.4-36.6L256.7,250L130.3,29.9z M72.4,196l57.9-101.5L188.2,196l-57.9-16.9L72.4,196z"
            />
            {/* Inner chevron — Infinity Army orange */}
            <polygon
                fill="#F29107"
                points="153.3,190.2 256.6,220.1 130.3,0 4,220.1 107.3,190.2 107.3,156 72.5,166.2 130.3,64.7 188.1,166.2 153.3,156"
            />
        </svg>
    );

    if (!backdrop) return svg;

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
                borderRadius: '4px',
                padding: '2px',
                flexShrink: 0,
                lineHeight: 0,
            }}
        >
            {svg}
        </span>
    );
}
