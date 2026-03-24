import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UnifiedSearchBar } from '../components/shared/UnifiedSearchBar'
import { FilterBar } from '../components/FilterBar'
import { FactionView } from '../components/FactionView'
import { BubbleChart } from '../components/BubbleChart'
import { ExpandableUnitCard } from '../components/shared/ExpandableUnitCard'
import { LayoutGrid, List, Circle, AlignJustify } from 'lucide-react'
import { useDatabase } from '../hooks/useDatabase'
import { useUnitSearch } from '../hooks/useUnitSearch'
import { CLASSIFICATION_LABELS, CLASSIFICATION_COLORS } from '../utils/classifications'

type ViewMode = 'compact' | 'list' | 'faction' | 'bubble';

export function SearchPage() {
    const db = useDatabase();
    const [viewMode, setViewMode] = useState<ViewMode>('compact');
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    // Use the custom hook for search logic
    const {
        query,
        setQuery,
        filters,
        setFilters,
        textQuery,
        setTextQuery,
        filteredUnits,
        hasSearch
    } = useUnitSearch(db, false);

    const toggleExpand = (id: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Auto-expand only when few results
    useEffect(() => {
        if (filteredUnits.length <= 5 && (textQuery.trim().length > 1 || query.filters.length > 0)) {
            setExpandedIds(new Set(filteredUnits.map(u => u.id)));
        } else {
            setExpandedIds(new Set());
        }
    }, [textQuery, query.filters.length, filteredUnits.length]);

    return (
        <div className="search-page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '1.5rem' }}>
            <section className="search-section" style={{ width: '100%', maxWidth: '56rem' }}>
                {/* Unified Search Bar */}
                <div className="global-search-container mb-6">
                    <div className="p-4 bg-black/20 border border-white/5 rounded-xl">
                        <UnifiedSearchBar
                            query={query}
                            setQuery={setQuery}
                            textQuery={textQuery}
                            setTextQuery={setTextQuery}
                            placeholder="Search names, profiles, weapons, skills, or equipment..."
                        />
                    </div>
                </div>

                {/* Filters */}
                {hasSearch && (
                    <div className="mb-6">
                        <FilterBar filters={filters} setFilters={setFilters} />
                    </div>
                )}

                {/* View Toggle */}
                {hasSearch && filteredUnits.length > 0 && (
                    <div className="view-controls flex justify-between items-end border-b border-white/10 pb-4 mb-6">
                        <div className="view-toggle flex gap-2">
                            <button
                                onClick={() => setViewMode('compact')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'compact' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-transparent text-gray-400 hover:bg-white/5 border border-transparent'}`}
                            >
                                <AlignJustify size={16} />
                                <span>Compact</span>
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'list' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-transparent text-gray-400 hover:bg-white/5 border border-transparent'}`}
                            >
                                <List size={16} />
                                <span>Detail</span>
                            </button>
                            <button
                                onClick={() => setViewMode('faction')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'faction' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-transparent text-gray-400 hover:bg-white/5 border border-transparent'}`}
                            >
                                <LayoutGrid size={16} />
                                <span>By Faction</span>
                            </button>
                            <button
                                onClick={() => setViewMode('bubble')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'bubble' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-transparent text-gray-400 hover:bg-white/5 border border-transparent'}`}
                            >
                                <Circle size={16} />
                                <span>Stats Bubble</span>
                            </button>
                        </div>
                        <div className="text-gray-400 text-sm font-medium">
                            {filteredUnits.length} {filteredUnits.length === 1 ? 'match' : 'matches'}
                            {query.operator === 'and' && query.filters.length > 1 && (
                                <span className="text-blue-400 opacity-80"> (matching ALL rules)</span>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* Results Section */}
            <section className="results-section pb-12" style={{ width: '100%', maxWidth: '64rem' }}>
                <AnimatePresence mode='wait'>
                    {!hasSearch ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            key="empty"
                            className="bg-[#0b1221] border border-white/5 rounded-2xl p-12 text-center max-w-2xl mx-auto mt-8"
                        >
                            <div className="text-4xl mb-4 opacity-50">⚡</div>
                            <div className="text-xl font-bold text-gray-300 mb-2">Search the Infinity Database</div>
                            <div className="text-gray-500">
                                Use the search bar above to look up units, weapons, or skills.
                                Use the autocomplete suggestions to add specific filter chips, or just type freely to search by name.
                                Click "+ Stat" to add stat-based filters like "WIP &gt; 13".
                            </div>
                        </motion.div>
                    ) : filteredUnits.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            key="no-results"
                            className="bg-[#0b1221] border border-white/5 rounded-2xl p-12 text-center max-w-2xl mx-auto mt-8"
                        >
                            <div className="text-4xl mb-4 opacity-50">∅</div>
                            <div className="text-xl font-bold text-gray-300 mb-2">No matches found</div>
                            <div className="text-gray-500">
                                {filters.factions.length > 0
                                    ? 'Try selecting different factions or adjusting your filters'
                                    : query.operator === 'and'
                                        ? 'Try using OR instead, or remove some filters'
                                        : 'Try a wildly different search term'
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
                    ) : viewMode === 'compact' ? (
                        <motion.div
                            key="compact-view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <div className="bg-[#0d1117] border border-[#1e293b] rounded-lg overflow-hidden">
                                {/* Compact table header */}
                                <div className="flex items-center px-3 py-2 bg-[#161b22] border-b border-[#1e293b] text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                    <div className="w-[50px]">Type</div>
                                    <div className="flex-1 min-w-0">Unit</div>
                                    <div className="w-[200px] text-right">Factions</div>
                                    <div className="w-[80px] text-right">Points</div>
                                </div>
                                {/* Compact rows */}
                                {filteredUnits.slice(0, 200).map(unit => {
                                    const primaryType = unit.raw.profileGroups[0]?.profiles[0]?.type ?? 0;
                                    const factionNames = unit.factions
                                        .map(fid => db.factionMap.get(fid))
                                        .filter(Boolean)
                                        .slice(0, 3);
                                    const isExpanded = expandedIds.has(unit.id);

                                    return (
                                        <div key={unit.id}>
                                            <div
                                                className="flex items-center px-3 py-2 border-b border-[#1e293b]/50 hover:bg-[#1e293b] cursor-pointer transition-colors"
                                                onClick={() => toggleExpand(unit.id)}
                                            >
                                                <div className="w-[50px]">
                                                    {primaryType > 0 && CLASSIFICATION_LABELS[primaryType] && (
                                                        <span
                                                            className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                                                            style={{
                                                                color: CLASSIFICATION_COLORS[primaryType],
                                                                background: `${CLASSIFICATION_COLORS[primaryType]}15`,
                                                            }}
                                                        >
                                                            {CLASSIFICATION_LABELS[primaryType]}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-sm font-semibold text-gray-200">{unit.isc}</span>
                                                </div>
                                                <div className="w-[200px] text-right">
                                                    <span className="text-xs text-gray-500 truncate">
                                                        {factionNames.join(', ')}
                                                        {unit.factions.length > 3 && ` +${unit.factions.length - 3}`}
                                                    </span>
                                                </div>
                                                <div className="w-[80px] text-right">
                                                    <span className="text-xs font-mono text-blue-400">
                                                        {unit.pointsRange[0] === unit.pointsRange[1]
                                                            ? `${unit.pointsRange[0]}`
                                                            : `${unit.pointsRange[0]}-${unit.pointsRange[1]}`}
                                                    </span>
                                                </div>
                                            </div>
                                            {isExpanded && (
                                                <div className="border-b border-[#1e293b] bg-[#0a0f18] px-2 py-2">
                                                    <ExpandableUnitCard
                                                        unit={unit}
                                                        isExpanded={true}
                                                        onToggle={() => toggleExpand(unit.id)}
                                                        searchQuery={textQuery.trim()}
                                                        activeFilters={query.filters}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {filteredUnits.length > 200 && (
                                <div className="text-center text-gray-500 py-6 border border-dashed border-white/10 rounded-xl mt-4">
                                    Displaying first 200 of {filteredUnits.length} results. Please refine your search.
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="list-view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col gap-3"
                        >
                            {filteredUnits.slice(0, 100).map(unit => (
                                <ExpandableUnitCard
                                    key={unit.id}
                                    unit={unit}
                                    isExpanded={expandedIds.has(unit.id)}
                                    onToggle={() => toggleExpand(unit.id)}
                                    searchQuery={textQuery.trim()}
                                    activeFilters={query.filters}
                                />
                            ))}
                            {filteredUnits.length > 100 && (
                                <div className="text-center text-gray-500 py-6 border border-dashed border-white/10 rounded-xl mt-4">
                                    Displaying first 100 of {filteredUnits.length} results. Please refine your search.
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>
        </div>
    )
}
