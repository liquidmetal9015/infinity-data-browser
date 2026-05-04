import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { UnifiedSearchBar } from '../components/shared/UnifiedSearchBar'
import { FilterBar } from '../components/FilterBar'
import { FactionView } from '../components/FactionView'
import { BubbleChart } from '../components/BubbleChart'
import { ExpandableUnitCard } from '../components/shared/ExpandableUnitCard'
import { LayoutGrid, List, Circle, AlignJustify } from 'lucide-react'
import { useDatabase } from '../hooks/useDatabase'
import { useUnitSearch } from '../hooks/useUnitSearch'
import { CLASSIFICATION_LABELS, CLASSIFICATION_COLORS, CLASSIFICATION_ORDER } from '../utils/classifications'
import { CharacteristicId } from '@shared/game-model'
import type { ItemFilter } from '../components/shared/UnifiedSearchBar'

type ViewMode = 'compact' | 'list' | 'faction' | 'bubble';
type SortOption = 'default' | 'name-asc' | 'name-desc' | 'points-asc' | 'points-desc';

export function SearchPage() {
    const db = useDatabase();
    const [searchParams, setSearchParams] = useSearchParams();
    const [viewMode, setViewMode] = useState<ViewMode>('compact');
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [selectedTypes, setSelectedTypes] = useState<Set<number>>(new Set());
    const [selectedOrderTypes, setSelectedOrderTypes] = useState<Set<'REGULAR' | 'IRREGULAR'>>(new Set());
    const [sortBy, setSortBy] = useState<SortOption>('default');

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

    // Pre-populate filter from URL params (e.g. from the reference page)
    useEffect(() => {
        const filterType = searchParams.get('filterType') as ItemFilter['type'] | null;
        const filterName = searchParams.get('filterName');
        const filterId = searchParams.get('filterId');

        if (filterType && filterName && filterId) {
            const rawModifiers = searchParams.get('filterModifiers');
            const modifiers = rawModifiers ? rawModifiers.split(',') : [];
            const filter: ItemFilter = {
                id: `${filterType}-${filterId}-${Date.now()}`,
                type: filterType,
                value: modifiers.length > 0 ? `${filterName} (${modifiers.join(', ')})` : filterName,
                baseId: Number(filterId),
                modifiers,
                matchAnyModifier: modifiers.length === 0,
            };
            setQuery({ filters: [filter], operator: 'or' });
            setSearchParams({}, { replace: true });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const hasAnyFilter = hasSearch || selectedTypes.size > 0 || selectedOrderTypes.size > 0;

    const displayedUnits = useMemo(() => {
        let results = filteredUnits;

        if (selectedTypes.size > 0) {
            results = results.filter(unit => {
                const primaryType = unit.raw.profileGroups[0]?.profiles[0]?.unitType ?? 0;
                return selectedTypes.has(primaryType);
            });
        }

        if (selectedOrderTypes.size > 0) {
            results = results.filter(unit => {
                for (const pg of unit.raw.profileGroups) {
                    if (pg.isPeripheral) continue;
                    for (const profile of pg.profiles) {
                        const chars = profile.characteristics ?? [];
                        if (selectedOrderTypes.has('REGULAR') && chars.includes(CharacteristicId.REGULAR)) return true;
                        if (selectedOrderTypes.has('IRREGULAR') && chars.includes(CharacteristicId.IRREGULAR)) return true;
                    }
                }
                return false;
            });
        }

        if (sortBy !== 'default') {
            results = [...results].sort((a, b) => {
                switch (sortBy) {
                    case 'name-asc':    return a.isc.localeCompare(b.isc);
                    case 'name-desc':   return b.isc.localeCompare(a.isc);
                    case 'points-asc':  return (a.pointsRange[0] ?? 999) - (b.pointsRange[0] ?? 999);
                    case 'points-desc': return (b.pointsRange[1] ?? 0) - (a.pointsRange[1] ?? 0);
                }
            });
        }

        return results;
    }, [filteredUnits, selectedTypes, selectedOrderTypes, sortBy]);

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
        if (displayedUnits.length <= 5 && (textQuery.trim().length > 1 || query.filters.length > 0)) {
            setExpandedIds(new Set(displayedUnits.map(u => u.id)));
        } else {
            setExpandedIds(new Set());
        }
    }, [textQuery, query.filters.length, displayedUnits]);

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

                {/* Filters + type/order chips — always visible */}
                <div className="mb-4 space-y-3">
                    <FilterBar filters={filters} setFilters={setFilters} />
                    <div className="flex flex-wrap items-center gap-1.5 px-1">
                            {CLASSIFICATION_ORDER.map(type => {
                                const active = selectedTypes.has(type);
                                const color = CLASSIFICATION_COLORS[type];
                                return (
                                    <button
                                        key={type}
                                        onClick={() => setSelectedTypes(prev => {
                                            const next = new Set(prev);
                                            if (next.has(type)) next.delete(type); else next.add(type);
                                            return next;
                                        })}
                                        className="text-xs font-bold px-2 py-1 rounded border transition-colors"
                                        style={active
                                            ? { color, background: `${color}20`, borderColor: `${color}60` }
                                            : { color: '#475569', background: 'transparent', borderColor: '#334155' }
                                        }
                                    >
                                        {CLASSIFICATION_LABELS[type]}
                                    </button>
                                );
                            })}
                            <div className="w-px h-4 bg-white/10 mx-1" />
                            {(['REGULAR', 'IRREGULAR'] as const).map(ot => {
                                const active = selectedOrderTypes.has(ot);
                                const color = ot === 'REGULAR' ? '#4ade80' : '#facc15';
                                return (
                                    <button
                                        key={ot}
                                        onClick={() => setSelectedOrderTypes(prev => {
                                            const next = new Set(prev);
                                            if (next.has(ot)) next.delete(ot); else next.add(ot);
                                            return next;
                                        })}
                                        className="text-xs font-bold px-2 py-1 rounded border transition-colors"
                                        style={active
                                            ? { color, background: `${color}20`, borderColor: `${color}50` }
                                            : { color: '#475569', background: 'transparent', borderColor: '#334155' }
                                        }
                                    >
                                        {ot === 'REGULAR' ? 'REG' : 'IRR'}
                                    </button>
                                );
                            })}
                            {(selectedTypes.size > 0 || selectedOrderTypes.size > 0) && (
                                <button
                                    onClick={() => { setSelectedTypes(new Set()); setSelectedOrderTypes(new Set()); }}
                                    className="text-xs px-2 py-1 rounded border border-white/10 text-gray-500 hover:text-gray-300 transition-colors"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                </div>

                {/* Empty state — inside search-section so it centres under the search bar */}
                <AnimatePresence>
                    {!hasAnyFilter && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            key="empty"
                            className="bg-[#0b1221] border border-white/5 rounded-2xl p-12 text-center mt-8"
                        >
                            <div className="text-4xl mb-4 opacity-50">⚡</div>
                            <div className="text-xl font-bold text-gray-300 mb-2">Search the Infinity Database</div>
                            <div className="text-gray-500">
                                Use the search bar above to look up units, weapons, or skills.
                                Use the autocomplete suggestions to add specific filter chips, or just type freely to search by name.
                                Click "+ Stat" to add stat-based filters like "WIP &gt; 13".
                            </div>
                        </motion.div>
                    )}
                    {hasAnyFilter && displayedUnits.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            key="no-results"
                            className="bg-[#0b1221] border border-white/5 rounded-2xl p-12 text-center mt-8"
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
                    )}
                </AnimatePresence>

                {/* View Toggle */}
                {hasAnyFilter && displayedUnits.length > 0 && (
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
                        <div className="flex items-center gap-3">
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as SortOption)}
                                className="text-xs bg-black/30 border border-white/10 rounded px-2 py-1.5 text-gray-400"
                            >
                                <option value="default">Sort: Default</option>
                                <option value="name-asc">Name A→Z</option>
                                <option value="name-desc">Name Z→A</option>
                                <option value="points-asc">Cost ↑ (min)</option>
                                <option value="points-desc">Cost ↓ (max)</option>
                            </select>
                            <div className="text-gray-400 text-sm font-medium">
                                {displayedUnits.length} {displayedUnits.length === 1 ? 'match' : 'matches'}
                                {query.operator === 'and' && query.filters.length > 1 && (
                                    <span className="text-blue-400 opacity-80"> (matching ALL rules)</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Results Section — only rendered when there are actual results */}
            {hasAnyFilter && displayedUnits.length > 0 && (
            <section className="results-section pb-12" style={{ width: '100%', maxWidth: '64rem' }}>
                <AnimatePresence mode='wait'>
                    {viewMode === 'bubble' ? (
                        <motion.div key="bubble-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <BubbleChart units={displayedUnits} />
                        </motion.div>
                    ) : viewMode === 'faction' ? (
                        <motion.div key="faction-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <FactionView units={displayedUnits} />
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
                                <div className="flex items-center px-3 py-2 bg-[#161b22] border-b border-[#1e293b] text-[length:var(--text-2xs)] font-semibold text-gray-500 uppercase tracking-wider">
                                    <div className="w-[50px]">Type</div>
                                    <div className="flex-1 min-w-0">Unit</div>
                                    <div className="w-[200px] text-right">Factions</div>
                                    <div className="w-[80px] text-right">Points</div>
                                </div>
                                {/* Compact rows */}
                                {displayedUnits.slice(0, 200).map(unit => {
                                    const primaryType = unit.raw.profileGroups[0]?.profiles[0]?.unitType ?? 0;
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
                                                            className="text-[length:var(--text-2xs)] font-bold px-1.5 py-0.5 rounded uppercase"
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
                            {displayedUnits.length > 200 && (
                                <div className="text-center text-gray-500 py-6 border border-dashed border-white/10 rounded-xl mt-4">
                                    Displaying first 200 of {displayedUnits.length} results. Please refine your search.
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
                            {displayedUnits.slice(0, 100).map(unit => (
                                <ExpandableUnitCard
                                    key={unit.id}
                                    unit={unit}
                                    isExpanded={expandedIds.has(unit.id)}
                                    onToggle={() => toggleExpand(unit.id)}
                                    searchQuery={textQuery.trim()}
                                    activeFilters={query.filters}
                                />
                            ))}
                            {displayedUnits.length > 100 && (
                                <div className="text-center text-gray-500 py-6 border border-dashed border-white/10 rounded-xl mt-4">
                                    Displaying first 100 of {displayedUnits.length} results. Please refine your search.
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>
            )}
        </div>
    )
}
