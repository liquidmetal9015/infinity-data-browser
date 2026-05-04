import { useState, useRef, useMemo, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import type { SearchSuggestion } from '@shared/types';
import { useDatabase } from '../../hooks/useDatabase';

interface Props {
    contentFilters: SearchSuggestion[];
    setContentFilters: React.Dispatch<React.SetStateAction<SearchSuggestion[]>>;
    unitNameQuery: string;
    setUnitNameQuery: (s: string) => void;
    busy?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
    weapon: '#f97316',
    skill: '#8b5cf6',
    equipment: '#06b6d4',
};

function suggestionKey(s: SearchSuggestion): string {
    return `${s.type}:${s.id}:${s.modifiers.join(',')}:${s.isAnyVariant}`;
}

export function ListContentFilter({
    contentFilters, setContentFilters, unitNameQuery, setUnitNameQuery, busy,
}: Props) {
    const db = useDatabase();
    const [text, setText] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const suggestions = useMemo(() => {
        if (!text.trim()) return [];
        const taken = new Set(contentFilters.map(suggestionKey));
        return db.getSuggestions(text)
            .filter(s => !taken.has(suggestionKey(s)))
            .slice(0, 12);
    }, [text, db, contentFilters]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const addFilter = (s: SearchSuggestion) => {
        setContentFilters(prev => [...prev, s]);
        setText('');
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.focus();
    };

    const removeFilter = (s: SearchSuggestion) => {
        const k = suggestionKey(s);
        setContentFilters(prev => prev.filter(f => suggestionKey(f) !== k));
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, -1));
        } else if (e.key === 'Enter') {
            if (showSuggestions && selectedIndex >= 0 && suggestions[selectedIndex]) {
                e.preventDefault();
                addFilter(suggestions[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    const inputBase: React.CSSProperties = {
        width: '100%',
        padding: '0.4rem 1.6rem 0.4rem 1.8rem',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        color: 'var(--text-primary)',
        fontSize: 'var(--text-sm)',
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
            padding: '0.65rem 1rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
        }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Unit-name search */}
                <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
                    <Search size={14} style={iconStyle} />
                    <input
                        type="text"
                        value={unitNameQuery}
                        onChange={e => setUnitNameQuery(e.target.value)}
                        placeholder="Search unit names…"
                        style={inputBase}
                    />
                    {unitNameQuery && (
                        <button onClick={() => setUnitNameQuery('')} style={clearBtnStyle}>
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Capability typeahead */}
                <div ref={wrapperRef} style={{ position: 'relative', flex: '1 1 260px', minWidth: 240 }}>
                    <Search size={14} style={iconStyle} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={text}
                        onChange={e => { setText(e.target.value); setShowSuggestions(true); setSelectedIndex(-1); }}
                        onFocus={() => { if (text.trim()) setShowSuggestions(true); }}
                        onKeyDown={onKeyDown}
                        placeholder="Filter by skill / weapon / equipment…"
                        style={inputBase}
                    />
                    {text && (
                        <button onClick={() => { setText(''); setShowSuggestions(false); }} style={clearBtnStyle}>
                            <X size={12} />
                        </button>
                    )}

                    {showSuggestions && suggestions.length > 0 && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                            maxHeight: 280, overflowY: 'auto',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                            borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                            zIndex: 20,
                        }}>
                            {suggestions.map((s, idx) => (
                                <button
                                    key={suggestionKey(s)}
                                    onClick={() => addFilter(s)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        width: '100%', padding: '0.4rem 0.6rem',
                                        background: idx === selectedIndex ? 'var(--bg-tertiary)' : 'transparent',
                                        border: 'none', cursor: 'pointer',
                                        textAlign: 'left', fontSize: 'var(--text-sm)',
                                        color: 'var(--text-primary)',
                                    }}
                                >
                                    <span style={{
                                        background: TYPE_COLORS[s.type], color: '#fff',
                                        borderRadius: 3, padding: '1px 5px', fontSize: 'var(--text-2xs)',
                                        fontWeight: 'var(--font-bold)',
                                    }}>
                                        {s.type[0].toUpperCase()}
                                    </span>
                                    <span>{s.displayName}</span>
                                    {s.isAnyVariant && (
                                        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-tertiary, #64748b)', marginLeft: 'auto' }}>
                                            all variants
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {busy && (
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-tertiary, #64748b)' }}>
                        Indexing list contents…
                    </span>
                )}
            </div>

            {contentFilters.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {contentFilters.map(f => (
                        <span
                            key={suggestionKey(f)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                padding: '0.2rem 0.55rem', borderRadius: '14px',
                                fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)',
                                background: `${TYPE_COLORS[f.type]}22`,
                                border: `1px solid ${TYPE_COLORS[f.type]}55`,
                                color: 'var(--text-primary)',
                            }}
                        >
                            <span style={{ color: TYPE_COLORS[f.type], fontWeight: 'var(--font-bold)', fontSize: 'var(--text-2xs)' }}>
                                {f.type[0].toUpperCase()}
                            </span>
                            {f.displayName}
                            <button
                                onClick={() => removeFilter(f)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary, #64748b)', cursor: 'pointer', padding: 0, display: 'flex' }}
                                aria-label={`Remove ${f.displayName} filter`}
                            >
                                <X size={10} />
                            </button>
                        </span>
                    ))}
                    <button
                        onClick={() => setContentFilters([])}
                        style={{
                            background: 'none', border: 'none',
                            color: 'var(--text-tertiary, #64748b)', cursor: 'pointer',
                            fontSize: 'var(--text-2xs)', textDecoration: 'underline',
                        }}
                    >
                        Clear all
                    </button>
                </div>
            )}
        </div>
    );
}

const iconStyle: React.CSSProperties = {
    position: 'absolute',
    left: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-tertiary, #64748b)',
};

const clearBtnStyle: React.CSSProperties = {
    position: 'absolute',
    right: 4,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'var(--text-tertiary, #64748b)',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
};
