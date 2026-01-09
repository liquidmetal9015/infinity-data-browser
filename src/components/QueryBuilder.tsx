import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import type { SearchSuggestion } from '../types';

export interface ItemFilter {
    id: string;
    type: 'weapon' | 'skill' | 'equipment';
    value: string;           // Display name like "Mimetism(-6)"
    baseId: number;          // The base skill/weapon/equipment ID
    modifiers: number[];     // Required modifiers (empty = any variant)
    matchAnyModifier: boolean; // If true, match any variant
}

export interface StatFilter {
    id: string;
    type: 'stat';
    stat: 'MOV' | 'MOV-1' | 'MOV-2' | 'CC' | 'BS' | 'PH' | 'WIP' | 'ARM' | 'BTS' | 'W' | 'S';
    operator: '>' | '>=' | '=' | '<=' | '<';
    value: number;
}

export type QueryFilter = ItemFilter | StatFilter;

export interface QueryState {
    filters: QueryFilter[];
    operator: 'or' | 'and';
}

interface QueryBuilderProps {
    query: QueryState;
    setQuery: React.Dispatch<React.SetStateAction<QueryState>>;
}

const TYPE_COLORS: Record<string, string> = {
    weapon: '#f97316',
    skill: '#8b5cf6',
    equipment: '#06b6d4',
    stat: '#10b981',
};

const TYPE_LABELS: Record<string, string> = {
    weapon: 'W',
    skill: 'S',
    equipment: 'E',
    stat: '#',
};

const STAT_OPTIONS = ['MOV', 'MOV-1', 'MOV-2', 'CC', 'BS', 'PH', 'WIP', 'ARM', 'BTS', 'W', 'S'];
const OPERATOR_OPTIONS = ['>', '>=', '=', '<=', '<'];

export const QueryBuilder: React.FC<QueryBuilderProps> = ({ query, setQuery }) => {
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    // Stat Builder State
    const [showStatBuilder, setShowStatBuilder] = useState(false);
    const [statType, setStatType] = useState('WIP');
    const [statOp, setStatOp] = useState('>=');
    const [statVal, setStatVal] = useState('13');

    const inputRef = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const db = useDatabase();

    // Generate suggestions based on input using useMemo (not useEffect)
    const suggestions = useMemo<SearchSuggestion[]>(() => {
        if (!inputValue.trim()) {
            return [];
        }
        const matches = db.getSuggestions(inputValue);
        return matches.slice(0, 35);
    }, [inputValue, db]);


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

    const addFilter = (suggestion: SearchSuggestion) => {
        const newFilter: ItemFilter = {
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
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const addStatFilter = () => {
        const val = parseInt(statVal);
        if (isNaN(val)) return;

        const newFilter: StatFilter = {
            id: `stat-${statType}-${statOp}-${val}-${Date.now()}`,
            type: 'stat',
            stat: statType as any,
            operator: statOp as any,
            value: val
        };

        setQuery(prev => ({
            ...prev,
            filters: [...prev.filters, newFilter]
        }));

        setShowStatBuilder(false);
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
                                <span className="filter-value">
                                    {filter.type === 'stat'
                                        ? `${(filter as StatFilter).stat} ${(filter as StatFilter).operator} ${(filter as StatFilter).value}`
                                        : (filter as ItemFilter).value
                                    }
                                </span>
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
                {showStatBuilder ? (
                    <div className="stat-builder">
                        <select
                            value={statType}
                            onChange={e => setStatType(e.target.value)}
                            className="stat-select"
                        >
                            {STAT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select
                            value={statOp}
                            onChange={e => setStatOp(e.target.value)}
                            className="stat-select op"
                        >
                            {OPERATOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <input
                            type="number"
                            value={statVal}
                            onChange={e => setStatVal(e.target.value)}
                            className="stat-input"
                            onKeyDown={e => e.key === 'Enter' && addStatFilter()}
                        />
                        <button className="add-stat-btn" onClick={addStatFilter}>Add</button>
                        <button className="cancel-stat-btn" onClick={() => setShowStatBuilder(false)}>
                            <X size={14} />
                        </button>
                    </div>
                ) : (
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
                )}

                {!showStatBuilder && (
                    <button
                        className="toggle-stat-btn"
                        onClick={() => setShowStatBuilder(true)}
                        title="Add Stat Filter"
                    >
                        + Stat
                    </button>
                )}
            </div>
        </div>
    );
};
