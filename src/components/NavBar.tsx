import { Trash2, AppWindow, Maximize, Columns3, Hammer, Compass, Plus, Menu, X, ListChecks } from 'lucide-react';
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
import { useListStore } from '../stores/useListStore';
import { useGlobalFactionStore } from '../stores/useGlobalFactionStore';
import { NewListModal } from './ListBuilder/NewListModal';
import { calculateListPoints } from '@shared/listTypes';
import styles from './NavBar.module.css';

import { useIsMobile } from '../hooks/useIsMobile';

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
    const { currentList, createList } = useListStore();
    const { globalFactionId, setGlobalFactionId } = useGlobalFactionStore();
    const [showNewModal, setShowNewModal] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleModeSwitch = (mode: typeof appMode) => {
        if (mode === appMode) return;
        setLastPath(appMode, location.pathname);
        setAppMode(mode);
        // Tabbed/maximized is a list-builder concept; ensure tool windows
        // float normally when entering explorer mode.
        if (mode === 'explorer' && layoutMode === 'tabbed') {
            setLayoutMode('multi-window');
        }
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

    // Row 2 / hamburger only exist when there's contextual nav content
    const hasNavRowContent = appMode === 'explorer' || (appMode === 'builder' && isWorkspace);

    // Close mobile menu on route change or resize to desktop
    const pathname = location.pathname;
    useEffect(() => { requestAnimationFrame(() => setMobileMenuOpen(false)); }, [pathname]);
    useEffect(() => { if (!isMobile) requestAnimationFrame(() => setMobileMenuOpen(false)); }, [isMobile]);

    return (
        <header className="app-header">

            {/* ── ROW 1: Brand bar ─────────────────────────────────────────── */}
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

                {/* Hamburger — shown on mobile only via CSS, only when Row 2 has content */}
                {hasNavRowContent && (
                    <button
                        className={clsx(styles.mobileMenuBtn, mobileMenuOpen && styles.open)}
                        onClick={() => setMobileMenuOpen(o => !o)}
                        aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
                        aria-expanded={mobileMenuOpen}
                    >
                        {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
                    </button>
                )}

                {/* Controls nav — always in Row 1 */}
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
                                        <span className={styles.layoutLabel}>2-col</span>
                                    </button>
                                    <button
                                        className={clsx(styles.segmentedBtn, columnCount === 3 && styles.active)}
                                        onClick={() => setColumnCount(3)}
                                        title="Three Columns"
                                    >
                                        <span className={styles.layoutLabel}>3-col</span>
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
                                    onClick={() => {
                                        if (layoutMode !== 'tabbed' && windows.filter(w => !w.isMinimized).length === 0) {
                                            openWindow(PANEL_WIDGETS[0]);
                                        }
                                        setLayoutMode('tabbed');
                                    }}
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
                                <>
                                    {!isWorkspace && currentList && (
                                        <Link
                                            to="/"
                                            className={styles.navActionBtn}
                                            title={`Resume editing: ${currentList.name}`}
                                            style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.08)' }}
                                        >
                                            <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>↩</span>
                                            <span className={styles.tabLabel}>
                                                {currentList.name.length > 20 ? currentList.name.slice(0, 20) + '…' : currentList.name}
                                                {' '}({calculateListPoints(currentList)}/{currentList.pointsLimit})
                                            </span>
                                        </Link>
                                    )}
                                    <button
                                        className={styles.navActionBtn}
                                        onClick={() => setShowNewModal(true)}
                                        title="Create a new army list"
                                        style={{ color: 'var(--accent)', borderColor: 'rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.08)' }}
                                    >
                                        <Plus size={13} />
                                        <span className={styles.tabLabel}>New List</span>
                                    </button>
                                    <Link
                                        to="/lists"
                                        className={styles.navActionBtn}
                                        title="View your saved army lists"
                                        style={{ color: 'var(--accent)', borderColor: 'rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.08)' }}
                                    >
                                        <ListChecks size={13} />
                                        <span className={styles.tabLabel}>My Lists</span>
                                    </Link>
                                </>
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

            {/* ── ROW 2: Navigation tabs — desktop visible, mobile hidden via CSS ── */}
            {hasNavRowContent && (
                <div className={clsx('header-nav-row', styles.navRowHiddenMobile)}>
                    <div className="header-nav-row-inner">

                        {/* Explorer tabs */}
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

                        {/* Workspace panel tabs — Builder mode, multi-window/tabbed on workspace */}
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

                        {/* Tool launcher */}
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
                    </div>
                </div>
            )}

            {/* ── MOBILE DROPDOWN: Row 2 content shown on mobile when hamburger is open ── */}
            {hasNavRowContent && (
                <div className={clsx(styles.mobileNavDropdown, mobileMenuOpen && styles.visible)}>

                    {/* Explorer tabs */}
                    {appMode === 'explorer' && (
                        <nav className={styles.exploreTabs} onClick={() => setMobileMenuOpen(false)}>
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

                    {/* Workspace panel tabs */}
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
                                            setMobileMenuOpen(false);
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

                    {/* Tool tabs */}
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
                                            setMobileMenuOpen(false);
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

                    {/* Layout controls — mobile only, builder workspace only */}
                    {appMode === 'builder' && isWorkspace && (
                        <div className={styles.mobileLayoutControls}>
                            {layoutMode === 'columns' && (
                                <div className={styles.layoutSegmentedControl} role="group" aria-label="Column Count">
                                    <button
                                        className={clsx(styles.segmentedBtn, columnCount === 2 && styles.active)}
                                        onClick={() => setColumnCount(2)}
                                        title="Two Columns (Roster + List)"
                                    >
                                        <span className={styles.layoutLabel}>2-col</span>
                                    </button>
                                    <button
                                        className={clsx(styles.segmentedBtn, columnCount === 3 && styles.active)}
                                        onClick={() => setColumnCount(3)}
                                        title="Three Columns"
                                    >
                                        <span className={styles.layoutLabel}>3-col</span>
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
                                    onClick={() => {
                                        if (layoutMode !== 'tabbed' && windows.filter(w => !w.isMinimized).length === 0) {
                                            openWindow(PANEL_WIDGETS[0]);
                                        }
                                        setLayoutMode('tabbed');
                                    }}
                                    title="Maximized (Tabbed) Mode"
                                >
                                    <Maximize size={14} />
                                    <span className={styles.layoutLabel}>Maximized</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {showNewModal && (
                <NewListModal
                    db={db}
                    globalFactionId={globalFactionId}
                    setGlobalFactionId={setGlobalFactionId}
                    onConfirm={(name, factionId, points) => {
                        const factionName = db.getFactionName(factionId);
                        createList(factionId, factionName, points, name);
                        setShowNewModal(false);
                        navigate('/');
                    }}
                    onCancel={() => setShowNewModal(false)}
                />
            )}

            {STATIC_MODE && (
                <div
                    title="VITE_DEPLOY_MODE=static — lists are saved to this browser only and will not sync to the cloud."
                    style={{
                        background: 'rgba(245, 158, 11, 0.12)',
                        borderTop: '1px solid rgba(245, 158, 11, 0.4)',
                        color: '#f59e0b',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        textAlign: 'center',
                        padding: '0.2rem 0.5rem',
                        letterSpacing: '0.02em',
                    }}
                >
                    Local-only mode — lists are stored in this browser and won't sync.
                </div>
            )}
        </header>
    );
}
