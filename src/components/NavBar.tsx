import { Trash2, AppWindow, Maximize, Columns3, Hammer, Compass } from 'lucide-react';
import { clsx } from 'clsx';
import { useDatabase } from '../hooks/useDatabase';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { clearAllDataAndReload } from '../utils/clearData';
import { widgetRegistry, PANEL_WIDGETS, TOOL_WIDGETS } from './Workspace/widgetRegistry';
import type { WidgetType } from '../types/workspace';
import { useAuth } from '../hooks/useAuth';
import { STATIC_MODE } from '../services/listService';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAppModeStore } from '../stores/useAppModeStore';
import styles from './NavBar.module.css';

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    );
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    return isMobile;
}

const EXPLORE_LINKS = [
    { label: 'Units', path: '/search' },
    { label: 'Skills & Equipment', path: '/reference' },
    { label: 'Weapons', path: '/ranges' },
    { label: 'Factions', path: '/compare' },
];

export function NavBar() {
    const db = useDatabase();
    const { windows, layoutMode, columnCount, setLayoutMode, setColumnCount, openWindow, focusWindow } = useWorkspaceStore();
    const { appMode, lastBuilderPath, lastExplorerPath, setAppMode, setLastPath } = useAppModeStore();
    const { user, login, logout, loading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const handleModeSwitch = (mode: typeof appMode) => {
        if (mode === appMode) return;
        setLastPath(appMode, location.pathname);
        setAppMode(mode);
        navigate(mode === 'builder' ? lastBuilderPath : lastExplorerPath);
    };

    const topZIndex = windows.length > 0 ? Math.max(...windows.map(w => w.zIndex)) : 0;
    const activeWindow = windows.find(w => w.zIndex === topZIndex && !w.isMinimized);
    const activeWidgetType = activeWindow?.type;

    const handleClearData = async () => {
        if (window.confirm('Clear all saved data? This will reset your army lists, calculator settings, and workspace layout. The page will reload.')) {
            await clearAllDataAndReload();
        }
    };

    const isWorkspace = location.pathname === '/';

    return (
        <header className="app-header">
            <div className="header-content">
                <div className="logo-section">
                    <Link to="/" className={styles.appTitleLink}>
                        <h1 className="app-title">Infinity Explorer</h1>
                    </Link>
                    <span className="unit-count">{db.units.length} units</span>
                </div>

                {/* Mode switcher */}
                <div className={styles.layoutSegmentedControl} role="group" aria-label="App Mode">
                    <button
                        className={clsx(styles.segmentedBtn, appMode === 'builder' && styles.active)}
                        onClick={() => handleModeSwitch('builder')}
                        title="List Builder"
                    >
                        <Hammer size={14} />
                        <span className={styles.layoutLabel}>Builder</span>
                    </button>
                    <button
                        className={clsx(styles.segmentedBtn, appMode === 'explorer' && styles.active)}
                        onClick={() => handleModeSwitch('explorer')}
                        title="Data Explorer"
                    >
                        <Compass size={14} />
                        <span className={styles.layoutLabel}>Explorer</span>
                    </button>
                </div>

                {/* Explore links — only in Explorer mode */}
                {appMode === 'explorer' && (
                    <nav className={styles.exploreTabs}>
                        {EXPLORE_LINKS.map(({ label, path }) => (
                            <Link
                                key={path}
                                to={path}
                                className={clsx(styles.tabBtn, location.pathname === path && styles.active)}
                            >
                                <span className={styles.tabLabel}>{label}</span>
                            </Link>
                        ))}
                    </nav>
                )}

                {/* Panel launcher tabs — Builder mode, multi-window/tabbed on workspace */}
                {appMode === 'builder' && isWorkspace && layoutMode !== 'columns' && (
                    <nav className={styles.workspaceTabs}>
                        {PANEL_WIDGETS.map((widgetType: WidgetType) => {
                            const entry = widgetRegistry[widgetType];
                            const IconComponent = entry.icon;
                            const windowInstance = windows.find(w => w.type === widgetType);
                            const isOpen = !!windowInstance;
                            const isActive = activeWidgetType === widgetType;

                            return (
                                <button
                                    key={widgetType}
                                    className={clsx(styles.tabBtn, isOpen && styles.open, isActive && styles.active)}
                                    onClick={() => {
                                        if (windowInstance) {
                                            focusWindow(windowInstance.id);
                                        } else {
                                            openWindow(widgetType);
                                        }
                                    }}
                                    title={`${isOpen ? 'Focus' : 'Open'} ${entry.label}`}
                                >
                                    <IconComponent size={16} />
                                    <span className={styles.tabLabel}>{entry.label}</span>
                                    {isOpen && <div className={styles.tabIndicator} />}
                                </button>
                            );
                        })}
                    </nav>
                )}

                {/* Tool launcher — Builder: workspace only; Explorer: always visible */}
                {(appMode === 'builder' ? isWorkspace : true) && (
                    <nav className={styles.toolTabs}>
                        {TOOL_WIDGETS.map((widgetType: WidgetType) => {
                            const entry = widgetRegistry[widgetType];
                            const IconComponent = entry.icon;
                            const windowInstance = windows.find(w => w.type === widgetType);
                            const isOpen = !!windowInstance;
                            const isActive = activeWidgetType === widgetType;

                            return (
                                <button
                                    key={widgetType}
                                    className={clsx(styles.tabBtn, styles.toolTab, isOpen && styles.open, isActive && styles.active)}
                                    onClick={() => {
                                        if (windowInstance) {
                                            focusWindow(windowInstance.id);
                                        } else {
                                            openWindow(widgetType, {
                                                contextMode: appMode === 'builder' ? 'list' : 'standalone',
                                            });
                                        }
                                    }}
                                    title={`${isOpen ? 'Focus' : 'Open'} ${entry.label}`}
                                >
                                    <IconComponent size={16} />
                                    <span className={styles.tabLabel}>{entry.label}</span>
                                    {isOpen && <div className={styles.tabIndicator} />}
                                </button>
                            );
                        })}
                    </nav>
                )}

                <div className={clsx(styles.mainNav, styles.controlsNav)}>
                    {appMode === 'builder' && isWorkspace && !isMobile && (
                        <>
                            {/* Column count toggle — only in columns mode */}
                            {layoutMode === 'columns' && (
                                <div className={styles.layoutSegmentedControl} role="group" aria-label="Column Count">
                                    <button
                                        className={clsx(styles.segmentedBtn, columnCount === 2 && styles.active)}
                                        onClick={() => setColumnCount(2)}
                                        title="Two Columns (Roster + List)"
                                    >
                                        <span className={styles.layoutLabel}>2</span>
                                    </button>
                                    <button
                                        className={clsx(styles.segmentedBtn, columnCount === 3 && styles.active)}
                                        onClick={() => setColumnCount(3)}
                                        title="Three Columns"
                                    >
                                        <span className={styles.layoutLabel}>3</span>
                                    </button>
                                </div>
                            )}

                            <div className={styles.layoutSegmentedControl} role="group" aria-label="Layout Mode">
                                <button
                                    className={clsx(styles.segmentedBtn, layoutMode === 'columns' && styles.active)}
                                    onClick={() => setLayoutMode('columns')}
                                    title="Columns Mode"
                                >
                                    <Columns3 size={14} />
                                    <span className={styles.layoutLabel}>Columns</span>
                                </button>
                                <button
                                    className={clsx(styles.segmentedBtn, layoutMode === 'multi-window' && styles.active)}
                                    onClick={() => setLayoutMode('multi-window')}
                                    title="Multi-Window Mode"
                                >
                                    <AppWindow size={14} />
                                    <span className={styles.layoutLabel}>Windows</span>
                                </button>
                                <button
                                    className={clsx(styles.segmentedBtn, layoutMode === 'tabbed' && styles.active)}
                                    onClick={() => setLayoutMode('tabbed')}
                                    title="Maximized (Tabbed) Mode"
                                >
                                    <Maximize size={14} />
                                    <span className={styles.layoutLabel}>Maximized</span>
                                </button>
                            </div>
                        </>
                    )}

                    {appMode === 'builder' && isWorkspace && !isMobile && <div className={styles.navDivider} />}

                    {user ? (
                        <>
                            {appMode === 'builder' && (
                                <Link to="/lists" className={styles.navLink} style={{ color: 'var(--accent)' }}>My Lists</Link>
                            )}
                            {!STATIC_MODE && <button className={styles.navLink} onClick={logout} title="Sign Out">Sign Out</button>}
                        </>
                    ) : (
                        !STATIC_MODE && <button className={styles.navLink} onClick={login} disabled={loading}>Sign In</button>
                    )}

                    <div className={styles.navDivider} />
                    <button className={clsx(styles.navLink, styles.clearDataBtn)} onClick={handleClearData} title="Clear all saved data">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </header>
    );
}
