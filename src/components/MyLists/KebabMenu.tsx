import { useEffect, useRef } from 'react';
import styles from './KebabMenu.module.css';

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
        <div ref={ref} className={styles.menu}>
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
            className={styles.item}
            style={{ color }}
            onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${color}15`; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
            {children}
        </button>
    );
}
