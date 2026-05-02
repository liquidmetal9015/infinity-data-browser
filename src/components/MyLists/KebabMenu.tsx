import { useEffect, useRef } from 'react';

export function KebabMenu({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        // Defer one tick so the click that opened the menu doesn't immediately close it
        const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
        return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
    }, [onClose]);
    return (
        <div
            ref={ref}
            style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                minWidth: 160,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                zIndex: 50,
                padding: '0.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.15rem',
            }}
        >
            {children}
        </div>
    );
}

export function KebabItem({ color, disabled, onClick, children }: {
    color: string;
    disabled?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.6rem',
                borderRadius: '5px',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                border: 'none',
                background: 'transparent',
                color,
                textAlign: 'left',
                whiteSpace: 'nowrap',
                transition: 'background 0.1s',
            }}
            onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${color}15`; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
            {children}
        </button>
    );
}
