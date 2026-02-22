import { Trash2, AppWindow, Maximize } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { clearAllDataAndReload } from '../utils/clearData';

export function NavBar() {
    const db = useDatabase();
    const { state, setLayoutMode } = useWorkspace();

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
                <div className="main-nav">
                    <button
                        className="nav-link layout-toggle-btn"
                        onClick={() => setLayoutMode(state.layoutMode === 'tabbed' ? 'multi-window' : 'tabbed')}
                        title={`Switch to ${state.layoutMode === 'tabbed' ? 'Multi-Window' : 'Tabbed'} Mode`}
                    >
                        {state.layoutMode === 'tabbed' ? <Maximize size={16} /> : <AppWindow size={16} />}
                        <span className="layout-label">{state.layoutMode === 'tabbed' ? 'Maximized' : 'Multi-Window'}</span>
                    </button>
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
                    margin-left: auto;
                    align-items: center;
                }
                .nav-link {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-secondary);
                    text-decoration: none;
                    font-size: 0.9rem;
                    font-weight: 500;
                    padding: 0.5rem 0.75rem;
                    border-radius: 6px;
                    transition: all 0.2s ease;
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
                @media (min-width: 640px) {
                    .layout-label {
                        display: inline;
                    }
                }
            `}</style>
        </header >
    );
}
