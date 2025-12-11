import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Database } from '../services/Database';

export interface QueryFilter {
    id: string;
    type: 'weapon' | 'skill' | 'equipment';
    value: string;           // Display name like "Mimetism(-6)"
    baseId: number;          // The base skill/weapon/equipment ID
    modifiers: number[];     // Required modifiers (empty = any variant)
    matchAnyModifier: boolean; // If true, match any modifier variant
}

export interface QueryState {
    filters: QueryFilter[];
    operator: 'or' | 'and';
}

interface QueryBuilderProps {
    query: QueryState;
    setQuery: React.Dispatch<React.SetStateAction<QueryState>>;
}

interface Suggestion {
    id: number;
    name: string;              // Base name "Mimetism"
    displayName: string;       // "Mimetism(-6)" or "Mimetism (any)"
    type: 'weapon' | 'skill' | 'equipment';
    modifiers: number[];       // The modifier values
    isAnyVariant: boolean;     // True for the "any" option
}

const TYPE_COLORS: Record<string, string> = {
    weapon: '#f97316',
    skill: '#8b5cf6',
    equipment: '#06b6d4',
};

const TYPE_LABELS: Record<string, string> = {
    weapon: 'W',
    skill: 'S',
    equipment: 'E',
};

// Format modifier for display using the extras lookup
function formatModifier(mods: number[], db: Database): string {
    if (mods.length === 0) return '';

    const parts = mods.map(modId => {
        // Look up the extras mapping
        const displayValue = db.extrasMap.get(modId);
        if (displayValue) {
            return `(${displayValue})`;
        }
        // Fallback if not found in extras map
        return `(${modId})`;
    });

    return parts.join(' ');
}

export const QueryBuilder: React.FC<QueryBuilderProps> = ({ query, setQuery }) => {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const db = Database.getInstance();

    // Build unique items with their modifier variants from all units
    const allItemVariants = useMemo(() => {
        const variants = new Map<string, Suggestion>();

        for (const unit of db.units) {
            for (const item of unit.allItemsWithMods) {
                const modKey = item.modifiers.join(',');
                const key = `${item.type}-${item.id}-${modKey}`;

                if (!variants.has(key)) {
                    const modDisplay = formatModifier(item.modifiers, db);
                    variants.set(key, {
                        id: item.id,
                        name: item.name,
                        displayName: modDisplay ? `${item.name}${modDisplay}` : item.name,
                        type: item.type,
                        modifiers: item.modifiers,
                        isAnyVariant: false
                    });
                }
            }
        }

        // Also add "any variant" options for items that have modifiers
        const baseItems = new Map<string, { id: number; name: string; type: 'weapon' | 'skill' | 'equipment'; hasModifiers: boolean }>();
        for (const v of variants.values()) {
            const baseKey = `${v.type}-${v.id}`;
            if (!baseItems.has(baseKey)) {
                baseItems.set(baseKey, { id: v.id, name: v.name, type: v.type, hasModifiers: false });
            }
            if (v.modifiers.length > 0) {
                baseItems.get(baseKey)!.hasModifiers = true;
            }
        }

        // Add "any" variant for items with modifiers
        for (const [baseKey, item] of baseItems.entries()) {
            if (item.hasModifiers) {
                variants.set(`${baseKey}-any`, {
                    id: item.id,
                    name: item.name,
                    displayName: `${item.name} (any)`,
                    type: item.type,
                    modifiers: [],
                    isAnyVariant: true
                });
            }
        }

        return Array.from(variants.values());
    }, [db.units]);

    // Generate suggestions based on input
    useEffect(() => {
        if (!inputValue.trim()) {
            setSuggestions([]);
            return;
        }

        const q = inputValue.toLowerCase();
        const matches = allItemVariants.filter(v =>
            v.name.toLowerCase().includes(q) ||
            v.displayName.toLowerCase().includes(q)
        );

        // Sort: exact matches first, then "any" variants, then by name
        matches.sort((a, b) => {
            const aLower = a.name.toLowerCase();
            const bLower = b.name.toLowerCase();

            // Exact match on base name
            if (aLower === q && bLower !== q) return -1;
            if (bLower === q && aLower !== q) return 1;

            // "Any" variants after specific ones
            if (a.isAnyVariant && !b.isAnyVariant && a.name === b.name) return 1;
            if (!a.isAnyVariant && b.isAnyVariant && a.name === b.name) return -1;

            // Group by name, then by modifier
            const nameCompare = a.name.localeCompare(b.name);
            if (nameCompare !== 0) return nameCompare;

            // Within same name, sort by modifier value
            const aMod = a.modifiers[0] || 0;
            const bMod = b.modifiers[0] || 0;
            return bMod - aMod;  // Higher modifiers first (e.g., -6 before -3)
        });

        setSuggestions(matches.slice(0, 15));
        setSelectedIndex(-1);
    }, [inputValue, allItemVariants]);

    // Handle clicking outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const addFilter = (suggestion: Suggestion) => {
        const newFilter: QueryFilter = {
            id: `${suggestion.type}-${suggestion.id}-${Date.now()}`,
            type: suggestion.type,
            value: suggestion.displayName,
            baseId: suggestion.id,
            modifiers: suggestion.modifiers,
            matchAnyModifier: suggestion.isAnyVariant
        };

        setQuery(prev => ({
            ...prev,
            filters: [...prev.filters, newFilter]
        }));

        setInputValue('');
        setSuggestions([]);
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const removeFilter = (filterId: string) => {
        setQuery(prev => ({
            ...prev,
            filters: prev.filters.filter(f => f.id !== filterId)
        }));
    };

    const toggleOperator = () => {
        setQuery(prev => ({
            ...prev,
            operator: prev.operator === 'or' ? 'and' : 'or'
        }));
    };

    const clearAll = () => {
        setQuery({ filters: [], operator: 'or' });
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev =>
                prev < suggestions.length - 1 ? prev + 1 : prev
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                addFilter(suggestions[selectedIndex]);
            } else if (suggestions.length > 0) {
                addFilter(suggestions[0]);
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    return (
        <div className="query-builder" ref={wrapperRef}>
            {/* Active Filters */}
            {query.filters.length > 0 && (
                <div className="active-filters">
                    {query.filters.map((filter, idx) => (
                        <React.Fragment key={filter.id}>
                            {idx > 0 && (
                                <button
                                    className="operator-badge"
                                    onClick={toggleOperator}
                                    title="Click to toggle AND/OR"
                                >
                                    {query.operator.toUpperCase()}
                                </button>
                            )}
                            <div
                                className="filter-chip"
                                style={{ borderColor: TYPE_COLORS[filter.type] }}
                            >
                                <span
                                    className="filter-type"
                                    style={{
                                        background: TYPE_COLORS[filter.type],
                                        color: 'white'
                                    }}
                                >
                                    {TYPE_LABELS[filter.type]}
                                </span>
                                <span className="filter-value">{filter.value}</span>
                                <button
                                    className="filter-remove"
                                    onClick={() => removeFilter(filter.id)}
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </React.Fragment>
                    ))}
                    <button className="clear-filters" onClick={clearAll}>
                        Clear All
                    </button>
                </div>
            )}

            {/* Unified Search Input */}
            <div className="query-input-row">
                <div className="input-wrapper">
                    <Search size={16} className="input-icon" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search weapons, skills, or equipment..."
                        className="query-input"
                    />
                    {inputValue && (
                        <button
                            className="input-clear"
                            onClick={() => {
                                setInputValue('');
                                inputRef.current?.focus();
                            }}
                        >
                            <X size={14} />
                        </button>
                    )}

                    {/* Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="suggestions-dropdown">
                            {suggestions.map((s, idx) => (
                                <button
                                    key={`${s.type}-${s.id}-${s.modifiers.join(',')}-${s.isAnyVariant}`}
                                    className={`suggestion-item ${idx === selectedIndex ? 'selected' : ''}`}
                                    onClick={() => addFilter(s)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                >
                                    <span
                                        className="suggestion-type"
                                        style={{
                                            background: TYPE_COLORS[s.type],
                                            color: 'white'
                                        }}
                                    >
                                        {TYPE_LABELS[s.type]}
                                    </span>
                                    <span className="suggestion-name">{s.displayName}</span>
                                    {s.isAnyVariant && (
                                        <span className="suggestion-badge">all variants</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* No results message */}
                    {showSuggestions && inputValue.trim() && suggestions.length === 0 && (
                        <div className="suggestions-dropdown">
                            <div className="no-suggestions">
                                No matching items found
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
