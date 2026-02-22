import { Trash2, AppWindow, Maximize } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { clearAllDataAndReload } from '../utils/clearData';
import { widgetRegistry, LAUNCHER_WIDGETS } from './Workspace/widgetRegistry';
import type { WidgetType } from '../types/workspace';

export function NavBar() {
    const db = useDatabase();
    const { state, setLayoutMode, openWindow, focusWindow } = useWorkspace();

    // Determine the currently active (focused) window
    const topZIndex = state.windows.length > 0 ? Math.max(...state.windows.map(w => w.zIndex)) : 0;
    const activeWindow = state.windows.find(w => w.zIndex === topZIndex && !w.isMinimized);
    const activeWidgetType = activeWindow?.type;

    const handleClearData = () => {
        if (window.confirm('Clear all saved data? This will reset your army lists, calculator settings, and workspace layout. The page will reload.')) {
            clearAllDataAndReload();
        }
    };

    return (
        <header className="app-header">
            <div className="header-content">
                <div className="logo-section">
                    <h1 className="app-title">Infinity Explorer</h1>
                    <span className="unit-count">{db.units.length} units</span>
                </div>

                {/* Central Tab Navigation */}
                <nav className="workspace-tabs">
                    {LAUNCHER_WIDGETS.map((widgetType: WidgetType) => {
                        const entry = widgetRegistry[widgetType];
                        const IconComponent = entry.icon;
                        const windowInstance = state.windows.find(w => w.type === widgetType);
                        const isOpen = !!windowInstance;
                        const isActive = activeWidgetType === widgetType;

                        return (
                            <button
                                key={widgetType}
                                className={`tab-btn ${isOpen ? 'open' : ''} ${isActive ? 'active' : ''}`}
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
                                <span className="tab-label">{entry.label}</span>
                                {isOpen && <div className="tab-indicator" />}
                            </button>
                        );
                    })}
                </nav>

                <div className="main-nav controls-nav">
                    <div className="layout-segmented-control" role="group" aria-label="Layout Mode">
                        <button
                            className={`segmented-btn ${state.layoutMode === 'tabbed' ? 'active' : ''}`}
                            onClick={() => setLayoutMode('tabbed')}
                            title="Maximized (Tabbed) Mode"
                        >
                            <Maximize size={14} />
                            <span className="layout-label">Maximized</span>
                        </button>
                        <button
                            className={`segmented-btn ${state.layoutMode === 'multi-window' ? 'active' : ''}`}
                            onClick={() => setLayoutMode('multi-window')}
                            title="Multi-Window Mode"
                        >
                            <AppWindow size={14} />
                            <span className="layout-label">Windows</span>
                        </button>
                    </div>
                    <div className="nav-divider" />
                    <button className="nav-link clear-data-btn" onClick={handleClearData} title="Clear all saved data">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
            <style>{`
                .main-nav {
                    display: flex;
                    gap: 1.5rem;
                    align-items: center;
                }
                .controls-nav {
                    margin-left: auto;
                }
                .workspace-tabs {
                    display: flex;
                    flex: 1;
                    min-width: 0;
                    justify-content: flex-start;
                    gap: 0.25rem;
                    overflow-x: auto;
                    scrollbar-width: none;
                    margin: 0 1rem;
                }
                .workspace-tabs::-webkit-scrollbar {
                    display: none;
                }
                .tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0.75rem;
                    border: none;
                    background: transparent;
                    color: var(--text-secondary);
                    font-size: 0.85rem;
                    font-weight: 500;
                    border-radius: 8px;
                    cursor: pointer;
                    position: relative;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }
                .tab-btn:hover {
                    color: var(--text-primary);
                    background: rgba(255, 255, 255, 0.05);
                }
                .tab-btn.open {
                    color: var(--text-primary);
                }
                .tab-btn.active {
                    color: var(--accent);
                    background: rgba(var(--accent-rgb, 99, 102, 241), 0.1);
                }
                .tab-indicator {
                    position: absolute;
                    bottom: 2px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 12px;
                    height: 3px;
                    border-radius: 3px;
                    background: var(--text-secondary);
                    opacity: 0.5;
                }
                .tab-btn.active .tab-indicator {
                    background: var(--accent);
                    opacity: 1;
                }
                .layout-segmented-control {
                    display: flex;
                    align-items: center;
                    background: var(--bg-tertiary, #0f172a);
                    border: 1px solid var(--border, #334155);
                    border-radius: 8px;
                    padding: 2px;
                }
                .segmented-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.35rem 0.6rem;
                    border: none;
                    background: transparent;
                    color: var(--text-secondary);
                    font-size: 0.8rem;
                    font-weight: 500;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .segmented-btn:hover:not(.active) {
                    color: var(--text-primary);
                }
                .segmented-btn.active {
                    background: var(--surface-hover, #1e293b);
                    color: var(--accent);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }
                .nav-link {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-secondary);
                    text-decoration: none;
                    background: transparent;
                    border: none;
                    font-size: 0.9rem;
                    font-weight: 500;
                    padding: 0.5rem 0.75rem;
                    border-radius: 6px;
                    transition: all 0.2s ease;
                    cursor: pointer;
                }
                .nav-link:hover:not(.disabled) {
                    color: var(--color-primary);
                    background: rgba(var(--color-primary-rgb), 0.1);
                }
                .nav-link.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .clear-data-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    opacity: 0.5;
                    transition: all 0.2s ease;
                }
                .clear-data-btn:hover {
                    opacity: 1;
                    color: var(--error, #ef4444) !important;
                    background: rgba(239, 68, 68, 0.1) !important;
                }
                .nav-divider {
                    width: 1px;
                    height: 20px;
                    background: var(--border);
                    margin: 0 0.25rem;
                    opacity: 0.5;
                }
                .layout-label {
                    display: none;
                }
                .tab-label {
                    display: none;
                }
                @media (min-width: 1024px) {
                    .layout-label, .tab-label {
                        display: inline;
                    }
                }
            `}</style>
        </header >
    );
}
