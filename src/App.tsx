import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Database } from './services/Database'
import type { Unit } from './types'
import { QueryBuilder, type QueryState } from './components/QueryBuilder'
import { FilterBar, type FiltersState } from './components/FilterBar'
import { ResultsTable } from './components/ResultsTable'
import { FactionView } from './components/FactionView'
import { Loader2, LayoutGrid, Table2 } from 'lucide-react'

type ViewMode = 'table' | 'faction';

function App() {
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const [query, setQuery] = useState<QueryState>({
    filters: [],
    operator: 'or'
  });

  const [filters, setFilters] = useState<FiltersState>({
    factions: []
  });

  useEffect(() => {
    const initDB = async () => {
      await Database.getInstance().init();
      setUnits(Database.getInstance().units);
      setLoading(false);
    };
    initDB();
  }, []);

  // Apply query and filters to get final results
  const filteredUnits = useMemo(() => {
    if (loading) return [];

    // First, apply query filters using modifier-aware search
    let results: Unit[];
    if (query.filters.length === 0) {
      results = [];
    } else {
      results = Database.getInstance().searchWithModifiers(
        query.filters.map(f => ({
          type: f.type,
          baseId: f.baseId,
          modifiers: f.modifiers,
          matchAnyModifier: f.matchAnyModifier
        })),
        query.operator
      );
    }

    // Then apply additional filters
    if (results.length > 0) {
      // Faction filter
      if (filters.factions.length > 0) {
        results = results.filter(unit =>
          unit.factions.some(fid => filters.factions.includes(fid))
        );
      }
    }

    return results;
  }, [query, filters, loading]);

  const hasSearch = query.filters.length > 0;

  if (loading) {
    return (
      <div className="loading-screen">
        <Loader2 className="loading-spinner" size={48} />
        <div className="loading-text">Initializing Database...</div>
        <div className="loading-subtext">Loading unit data</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <h1 className="app-title">Infinity Explorer</h1>
            <span className="unit-count">{units.length} units</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Search Section */}
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
      </main>
    </div>
  )
}

export default App
