import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QueryBuilder } from '../components/QueryBuilder'
import { FilterBar } from '../components/FilterBar'
import { ResultsTable } from '../components/ResultsTable'
import { FactionView } from '../components/FactionView'
import { BubbleChart } from '../components/BubbleChart'
import { LayoutGrid, Table2, Circle } from 'lucide-react'
import { useDatabase } from '../context/DatabaseContext'
import { useUnitSearch } from '../hooks/useUnitSearch'

type ViewMode = 'table' | 'faction' | 'bubble';

export function SearchPage() {
    const db = useDatabase();
    const [viewMode, setViewMode] = useState<ViewMode>('table');

    // Use the custom hook for search logic
    const {
        query,
        setQuery,
        filters,
        setFilters,
        filteredUnits,
        hasSearch
    } = useUnitSearch(db, false); // No longer loading


    return (
        <>
            <section className="search-section">
                <QueryBuilder query={query} setQuery={setQuery} />

                {/* Filters - show when there's a search */}
                {hasSearch && (
                    <FilterBar filters={filters} setFilters={setFilters} />
                )}

                {/* View Toggle */}
                {hasSearch && filteredUnits.length > 0 && (
                    <div className="view-controls">
                        <div className="view-toggle">
                            <button
                                onClick={() => setViewMode('table')}
                                className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                                title="Table View"
                            >
                                <Table2 size={18} />
                                <span>Table</span>
                            </button>
                            <button
                                onClick={() => setViewMode('faction')}
                                className={`toggle-btn ${viewMode === 'faction' ? 'active' : ''}`}
                                title="Group by Faction"
                            >
                                <LayoutGrid size={18} />
                                <span>By Faction</span>
                            </button>
                            <button
                                onClick={() => setViewMode('bubble')}
                                className={`toggle-btn ${viewMode === 'bubble' ? 'active' : ''}`}
                                title="Bubble Chart"
                            >
                                <Circle size={18} />
                                <span>Bubbles</span>
                            </button>
                        </div>
                        <div className="result-count">
                            {filteredUnits.length} {filteredUnits.length === 1 ? 'result' : 'results'}
                            {query.operator === 'and' && query.filters.length > 1 && (
                                <span className="operator-indicator"> (matching ALL)</span>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* Results Section */}
            <section className="results-section">
                <AnimatePresence mode='wait'>
                    {!hasSearch ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            key="empty"
                            className="empty-state"
                        >
                            <div className="empty-icon">⚡</div>
                            <div className="empty-title">Search for units</div>
                            <div className="empty-subtitle">
                                Type a weapon, skill, or equipment name to find matching units.
                                Add multiple filters and use AND/OR to refine your search.
                            </div>
                        </motion.div>
                    ) : filteredUnits.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            key="no-results"
                            className="no-results"
                        >
                            <div className="no-results-icon">∅</div>
                            <div className="no-results-title">No matches found</div>
                            <div className="no-results-subtitle">
                                {filters.factions.length > 0
                                    ? 'Try selecting different factions or adjusting your filters'
                                    : query.operator === 'and'
                                        ? 'Try using OR instead, or remove some filters'
                                        : 'Try a different search term'
                                }
                            </div>
                        </motion.div>
                    ) : viewMode === 'bubble' ? (
                        <motion.div key="bubble-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <BubbleChart units={filteredUnits} />
                        </motion.div>
                    ) : viewMode === 'faction' ? (
                        <motion.div key="faction-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <FactionView units={filteredUnits} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="table-view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <ResultsTable units={filteredUnits} query={query} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>
        </>
    )
}
