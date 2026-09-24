import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Search,
    Library,
    Crosshair,
    Users,
    Calculator,
    ClipboardList,
    Layers,
    Target,
    LayoutGrid,
    Trash2,
    Menu,
    X,
    ChevronDown,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../hooks/useAuth';
import { STATIC_MODE } from '../services/listService';
import { clearAllDataAndReload } from '../utils/clearData';
import styles from './NavBar.module.css';

const PRIMARY_TABS = [
    { label: 'Units', path: '/', icon: Search, isActive: (p: string) => p === '/' || p === '/search' || p === '/units' },
    { label: 'Skills & Gear', path: '/reference', icon: Library, isActive: (p: string) => p.startsWith('/reference') },
    { label: 'Weapons', path: '/ranges', icon: Crosshair, isActive: (p: string) => p.startsWith('/ranges') },
    { label: 'Factions', path: '/compare', icon: Users, isActive: (p: string) => p.startsWith('/compare') },
];

const SECONDARY_TOOLS = [
    { label: 'Dice Calculator', path: '/calculator', icon: Calculator, desc: 'F2F probability simulator' },
    { label: 'Army Lists', path: '/lists', icon: ClipboardList, desc: 'Saved lists & list builder' },
    { label: 'Fireteams', path: '/fireteams', icon: Layers, desc: 'Fireteam charts viewer' },
    { label: 'Classifieds', path: '/classifieds', icon: Target, desc: 'Objectives & scoring' },
    { label: 'Workspace Canvas', path: '/workspace', icon: LayoutGrid, desc: 'Legacy windowed mode' },
];

export function NavBar() {
    const location = useLocation();
    const { user, login, logout, loading } = useAuth();
    const [toolsOpen, setToolsOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const toolsRef = useRef<HTMLDivElement>(null);

    // Close dropdowns on route changes
    const [prevPath, setPrevPath] = useState(location.pathname);
    if (location.pathname !== prevPath) {
        setPrevPath(location.pathname);
        setToolsOpen(false);
        setMobileMenuOpen(false);
    }

    // Close tools menu on click outside
    useEffect(() => {
        if (!toolsOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
                setToolsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [toolsOpen]);

    const handleClearData = async () => {
        if (window.confirm('Clear all saved data? This will reset your army lists, calculator settings, and cache. The page will reload.')) {
            await clearAllDataAndReload();
        }
    };

    const isSecondaryActive = SECONDARY_TOOLS.some(t => location.pathname.startsWith(t.path));

    return (
        <header className="app-header">
            <div className="header-content">
                {/* Brand Logo */}
                <div className="logo-section">
                    <Link to="/" className={styles.appTitleLink} aria-label="Infinity Explorer Home">
                        <span style={{ fontSize: '1.25rem', color: 'var(--accent)', fontWeight: 800 }}>∞</span>
                        <h1 className="app-title">Infinity Explorer</h1>
                    </Link>
                </div>

                {/* Desktop Primary Navigation Tabs */}
                <nav className={styles.desktopExploreNav} aria-label="Main Navigation">
                    {PRIMARY_TABS.map((tab) => {
                        const active = tab.isActive(location.pathname);
                        const Icon = tab.icon;
                        return (
                            <Link
                                key={tab.path}
                                to={tab.path}
                                className={clsx(styles.tabBtn, active && styles.active)}
                                aria-current={active ? 'page' : undefined}
                            >
                                <Icon size={15} />
                                <span>{tab.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Right Controls */}
                <div className={styles.rightControls}>
                    {/* Tools Dropdown (Desktop) */}
                    <div className={styles.toolsMenuContainer} ref={toolsRef}>
                        <button
                            type="button"
                            className={clsx(styles.tabBtn, isSecondaryActive && styles.active)}
                            onClick={() => setToolsOpen(o => !o)}
                            aria-expanded={toolsOpen}
                            aria-haspopup="true"
                            title="More tools"
                        >
                            <span>More Tools</span>
                            <ChevronDown size={14} style={{ transform: toolsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                        </button>

                        {toolsOpen && (
                            <div className={styles.toolsMenuDropdown} role="menu">
                                <div className={styles.toolsMenuHeader}>Game Tools</div>
                                {SECONDARY_TOOLS.map((tool) => {
                                    const Icon = tool.icon;
                                    const active = location.pathname.startsWith(tool.path);
                                    return (
                                        <Link
                                            key={tool.path}
                                            to={tool.path}
                                            className={clsx(styles.toolsMenuItem, active && styles.active)}
                                            role="menuitem"
                                            onClick={() => setToolsOpen(false)}
                                        >
                                            <Icon size={16} />
                                            <div>
                                                <div>{tool.label}</div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Auth (Desktop) */}
                    {!STATIC_MODE && (
                        <div className={styles.desktopOnlyControl}>
                            {user ? (
                                <button className={styles.navLink} onClick={logout} title="Sign Out">
                                    Sign Out
                                </button>
                            ) : (
                                <button className={styles.navLink} onClick={login} disabled={loading} title="Sign In">
                                    Sign In
                                </button>
                            )}
                        </div>
                    )}

                    {/* Clear Data (Desktop) */}
                    <div className={styles.desktopOnlyControl}>
                        <button
                            className={styles.clearDataBtn}
                            onClick={handleClearData}
                            title="Reset all saved data"
                            aria-label="Reset all saved data"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>

                    {/* Mobile Hamburger Trigger */}
                    <button
                        className={clsx(styles.mobileMenuBtn, mobileMenuOpen && styles.open)}
                        onClick={() => setMobileMenuOpen(o => !o)}
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {/* Mobile Dropdown (shown when hamburger is open) */}
            <div className={clsx(styles.mobileNavDropdown, mobileMenuOpen && styles.visible)}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    ADDITIONAL TOOLS
                </div>
                <div className={styles.mobileToolGrid}>
                    {SECONDARY_TOOLS.map((tool) => {
                        const Icon = tool.icon;
                        const active = location.pathname.startsWith(tool.path);
                        return (
                            <Link
                                key={tool.path}
                                to={tool.path}
                                className={clsx(styles.mobileToolCard, active && styles.active)}
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                <Icon size={16} style={{ color: 'var(--accent)' }} />
                                <span>{tool.label}</span>
                            </Link>
                        );
                    })}
                </div>

                <div className={styles.mobileAccountSection}>
                    {!STATIC_MODE && (
                        user ? (
                            <button
                                className={styles.navLink}
                                onClick={() => { logout(); setMobileMenuOpen(false); }}
                                style={{ justifyContent: 'center', width: '100%', border: '1px solid var(--border)' }}
                            >
                                Sign Out
                            </button>
                        ) : (
                            <button
                                className={styles.navLink}
                                onClick={() => { login(); setMobileMenuOpen(false); }}
                                disabled={loading}
                                style={{ justifyContent: 'center', width: '100%', border: '1px solid var(--border)' }}
                            >
                                Sign In
                            </button>
                        )
                    )}
                    <button
                        className={clsx(styles.navLink, styles.clearDataBtn)}
                        onClick={() => { setMobileMenuOpen(false); handleClearData(); }}
                        style={{ justifyContent: 'center', width: '100%', border: '1px solid var(--border)' }}
                    >
                        <Trash2 size={16} />
                        <span>Reset Saved Data</span>
                    </button>
                </div>
            </div>

            {STATIC_MODE && (
                <div
                    title="VITE_DEPLOY_MODE=static — offline/local mode."
                    style={{
                        background: 'rgba(245, 158, 11, 0.12)',
                        borderTop: '1px solid rgba(245, 158, 11, 0.3)',
                        color: 'var(--warning)',
                        fontSize: 'var(--text-2xs)',
                        fontWeight: 'var(--font-semibold)',
                        textAlign: 'center',
                        padding: '0.2rem 0.5rem',
                        letterSpacing: '0.02em',
                    }}
                >
                    Local static mode
                </div>
            )}
        </header>
    );
}
