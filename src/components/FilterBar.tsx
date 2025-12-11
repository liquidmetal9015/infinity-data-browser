import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Filter, ChevronRight } from 'lucide-react';
import { Database } from '../services/Database';
import type { SuperFaction } from '../utils/factions';

export interface FiltersState {
    factions: number[];  // Selected faction IDs (empty = all)
}

interface FilterBarProps {
    filters: FiltersState;
    setFilters: React.Dispatch<React.SetStateAction<FiltersState>>;
}

export const FilterBar: React.FC<FilterBarProps> = ({ filters, setFilters }) => {
    const [showFactionDropdown, setShowFactionDropdown] = useState(false);
    const [factionSearch, setFactionSearch] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
    const dropdownRef = useRef<HTMLDivElement>(null);

    const db = Database.getInstance();

    // Get grouped factions from registry
    const groupedFactions = db.getGroupedFactions();

    // Filter groups by search
    const filteredGroups = factionSearch
        ? groupedFactions.filter(sf => {
            const searchLower = factionSearch.toLowerCase();
            // Match if super-faction name matches, or any sectorial matches
            if (sf.name.toLowerCase().includes(searchLower)) return true;
            if (sf.vanilla?.name.toLowerCase().includes(searchLower)) return true;
            if (sf.sectorials.some(s => s.name.toLowerCase().includes(searchLower))) return true;
            if (sf.shortName.toLowerCase().includes(searchLower)) return true;
            return false;
        })
        : groupedFactions;

    // Handle clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowFactionDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleFaction = (factionId: number) => {
        setFilters(prev => {
            const isSelected = prev.factions.includes(factionId);
            return {
                ...prev,
                factions: isSelected
                    ? prev.factions.filter(id => id !== factionId)
                    : [...prev.factions, factionId]
            };
        });
    };

    const toggleSuperFaction = (sf: SuperFaction) => {
        // Get all faction IDs in this super-faction
        const allIds: number[] = [];
        if (sf.vanilla) allIds.push(sf.vanilla.id);
        sf.sectorials.forEach(s => allIds.push(s.id));

        const allSelected = allIds.every(id => filters.factions.includes(id));

        setFilters(prev => {
            if (allSelected) {
                // Deselect all
                return {
                    ...prev,
                    factions: prev.factions.filter(id => !allIds.includes(id))
                };
            } else {
                // Select all
                return {
                    ...prev,
                    factions: [...new Set([...prev.factions, ...allIds])]
                };
            }
        });
    };

    const toggleGroupExpanded = (groupId: number) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    };

    const clearFactions = () => {
        setFilters(prev => ({ ...prev, factions: [] }));
    };

    const hasActiveFilters = filters.factions.length > 0;

    // Get selected faction short names for display
    const selectedNames = filters.factions
        .slice(0, 4)
        .map(id => db.getFactionShortName(id));
    const extraSelected = filters.factions.length - selectedNames.length;

    return (
        <div className="filter-bar">
            {/* Faction Filter */}
            <div className="filter-group" ref={dropdownRef}>
                <button
                    className={`filter-button ${filters.factions.length > 0 ? 'active' : ''}`}
                    onClick={() => setShowFactionDropdown(!showFactionDropdown)}
                >
                    <Filter size={14} />
                    <span>
                        {filters.factions.length === 0
                            ? 'All Factions'
                            : `${filters.factions.length} Faction${filters.factions.length > 1 ? 's' : ''}`
                        }
                    </span>
                    <ChevronDown size={14} />
                </button>

                {showFactionDropdown && (
                    <div className="filter-dropdown faction-dropdown">
                        <div className="dropdown-header">
                            <input
                                type="text"
                                placeholder="Search factions..."
                                value={factionSearch}
                                onChange={(e) => setFactionSearch(e.target.value)}
                                className="dropdown-search"
                                autoFocus
                            />
                        </div>
                        <div className="dropdown-actions">
                            <button onClick={clearFactions}>Clear All</button>
                        </div>
                        <div className="dropdown-list">
                            {filteredGroups.map(sf => {
                                const isExpanded = expandedGroups.has(sf.id) || factionSearch.length > 0;
                                const allIds = [
                                    ...(sf.vanilla ? [sf.vanilla.id] : []),
                                    ...sf.sectorials.map(s => s.id)
                                ];
                                const selectedCount = allIds.filter(id => filters.factions.includes(id)).length;
                                const allSelected = selectedCount === allIds.length && allIds.length > 0;
                                const someSelected = selectedCount > 0 && !allSelected;

                                return (
                                    <div key={sf.id} className="faction-group">
                                        <div className="faction-group-header">
                                            <button
                                                className="group-expand"
                                                onClick={() => toggleGroupExpanded(sf.id)}
                                            >
                                                <ChevronRight
                                                    size={14}
                                                    className={isExpanded ? 'rotated' : ''}
                                                />
                                            </button>
                                            <label className="group-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={allSelected}
                                                    ref={el => {
                                                        if (el) el.indeterminate = someSelected;
                                                    }}
                                                    onChange={() => toggleSuperFaction(sf)}
                                                />
                                                <span className="group-name">{sf.name}</span>
                                                {selectedCount > 0 && (
                                                    <span className="group-count">{selectedCount}/{allIds.length}</span>
                                                )}
                                            </label>
                                        </div>
                                        {isExpanded && (
                                            <div className="faction-group-items">
                                                {sf.vanilla && (
                                                    <label className="dropdown-item sectorial-item">
                                                        <input
                                                            type="checkbox"
                                                            checked={filters.factions.includes(sf.vanilla.id)}
                                                            onChange={() => toggleFaction(sf.vanilla!.id)}
                                                        />
                                                        <span>{sf.vanilla.shortName} (Vanilla)</span>
                                                    </label>
                                                )}
                                                {sf.sectorials.map(sect => (
                                                    <label key={sect.id} className="dropdown-item sectorial-item">
                                                        <input
                                                            type="checkbox"
                                                            checked={filters.factions.includes(sect.id)}
                                                            onChange={() => toggleFaction(sect.id)}
                                                        />
                                                        <span>{sect.shortName}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Selected Faction Chips */}
            {filters.factions.length > 0 && (
                <div className="selected-factions">
                    {selectedNames.map((name, i) => (
                        <span key={i} className="faction-chip">
                            {name}
                            <button onClick={() => toggleFaction(filters.factions[i])}>
                                <X size={10} />
                            </button>
                        </span>
                    ))}
                    {extraSelected > 0 && (
                        <span className="faction-chip-more">+{extraSelected} more</span>
                    )}
                </div>
            )}

            {/* Clear All Filters */}
            {hasActiveFilters && (
                <button
                    className="clear-all-filters"
                    onClick={() => setFilters({ factions: [] })}
                >
                    Clear Filters
                </button>
            )}
        </div>
    );
};
