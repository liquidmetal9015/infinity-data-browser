import { clsx } from 'clsx';
import styles from './FilterPill.module.css';

interface FilterPillProps {
    active: boolean;
    onClick: () => void;
    tone?: 'accent' | 'amber';
    logo?: string;
    title?: string;
    children: React.ReactNode;
}

export function FilterPill({ active, onClick, tone = 'accent', logo, title, children }: FilterPillProps) {
    const className = clsx(
        styles.pill,
        tone === 'accent' && styles.toneAccent,
        tone === 'amber' && styles.toneAmber,
        active && styles.active,
        logo && styles.withLogo,
    );
    return (
        <button onClick={onClick} title={title} className={className}>
            {logo && (
                <img
                    src={logo}
                    alt=""
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                />
            )}
            {children}
        </button>
    );
}
