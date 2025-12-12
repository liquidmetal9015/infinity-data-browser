import { NavLink } from 'react-router-dom';
import { Search, Users, Activity, Library, Layers } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';

export function NavBar() {
    const db = useDatabase();

    return (
        <header className="app-header">
            <div className="header-content">
                <div className="logo-section">
                    <h1 className="app-title">Infinity Explorer</h1>
                    <span className="unit-count">{db.units.length} units</span>
                </div>
                <nav className="main-nav">
                    <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        <Search size={18} />
                        <span>Search</span>
                    </NavLink>
                    <NavLink to="/reference" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        <Library size={18} />
                        <span>Reference</span>
                    </NavLink>
                    <NavLink to="/ranges" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        <Activity size={18} />
                        <span>Ranges</span>
                    </NavLink>
                    <NavLink to="/compare" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        <Users size={18} />
                        <span>Compare</span>
                    </NavLink>
                    <NavLink to="/fireteams" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        <Layers size={18} />
                        <span>Fireteams</span>
                    </NavLink>
                </nav>
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
                .nav-link.active {
                    color: var(--color-primary);
                    background: rgba(var(--color-primary-rgb), 0.15);
                }
                .nav-link.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </header >
    );
}
