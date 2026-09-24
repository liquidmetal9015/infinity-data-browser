import { Link, useLocation } from 'react-router-dom';
import { Search, Library, Crosshair, Users } from 'lucide-react';
import { clsx } from 'clsx';
import styles from './MobileBottomNav.module.css';

interface NavItem {
    path: string;
    label: string;
    icon: typeof Search;
    isActive: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
    {
        path: '/',
        label: 'Units',
        icon: Search,
        isActive: (p) => p === '/' || p === '/search' || p === '/units',
    },
    {
        path: '/reference',
        label: 'Skills & Gear',
        icon: Library,
        isActive: (p) => p.startsWith('/reference'),
    },
    {
        path: '/ranges',
        label: 'Weapons',
        icon: Crosshair,
        isActive: (p) => p.startsWith('/ranges'),
    },
    {
        path: '/compare',
        label: 'Factions',
        icon: Users,
        isActive: (p) => p.startsWith('/compare'),
    },
];

export function MobileBottomNav() {
    const location = useLocation();

    return (
        <nav className={styles.bottomNav} aria-label="Mobile Navigation">
            <div className={styles.bottomNavInner}>
                {NAV_ITEMS.map((item) => {
                    const active = item.isActive(location.pathname);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={clsx(styles.navItem, active && styles.active)}
                            aria-current={active ? 'page' : undefined}
                        >
                            {active && <div className={styles.activeIndicator} />}
                            <Icon size={20} />
                            <span className={styles.label}>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
