import { useState, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { ResultsTable } from '../components/ResultsTable';
import { Search } from 'lucide-react';
import type { QueryState } from '../components/QueryBuilder';

export function UnitSearchPage() {
    const db = useDatabase();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredUnits = useMemo(() => {
        if (!searchTerm.trim()) {
            return db.units; // Or return [] if we want to show nothing by default
        }
        const lowerTerm = searchTerm.toLowerCase();
        return db.units.filter(unit =>
            unit.name.toLowerCase().includes(lowerTerm)
        );
    }, [db.units, searchTerm]);

    // Empty query state to satisfy ResultsTable props
    const emptyQuery: QueryState = {
        filters: [],
        operator: 'or'
    };

    return (
        <div className="page-container">
            <div className="search-header">
                <h1>Unit Directory</h1>
                <div className="simple-search-bar">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder="Search units by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                        autoFocus
                    />
                </div>
                <div className="result-stats">
                    Showing {filteredUnits.length} units
                </div>
            </div>

            <div className="results-wrapper">
                <ResultsTable units={filteredUnits} query={emptyQuery} />
            </div>

            <style>{`
                .page-container {
                    padding: 2rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .search-header {
                    margin-bottom: 2rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .simple-search-bar {
                    position: relative;
                    max-width: 600px;
                }
                .search-icon {
                    position: absolute;
                    left: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-tertiary);
                    pointer-events: none;
                }
                .search-input {
                    width: 100%;
                    padding: 1rem 1rem 1rem 3rem;
                    background: var(--bg-surface);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    font-size: 1.1rem;
                    color: var(--text-primary);
                    transition: all 0.2s;
                }
                .search-input:focus {
                    outline: none;
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
                }
                .result-stats {
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }
            `}</style>
        </div>
    );
}
