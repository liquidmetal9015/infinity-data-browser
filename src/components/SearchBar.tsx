import React, { useState, useEffect } from 'react';
import { Sword, Shield, Zap, X } from 'lucide-react';

interface SearchBarProps {
    search: { weapon: string; skill: string; equip: string };
    setSearch: React.Dispatch<React.SetStateAction<{ weapon: string; skill: string; equip: string }>>;
}

export const SearchBar: React.FC<SearchBarProps> = ({ search, setSearch }) => {
    // Local state for immediate input feedback
    const [localSearch, setLocalSearch] = useState(search);

    // Debounce: only update parent state after 300ms of no typing
    useEffect(() => {
        const timer = setTimeout(() => {
            if (
                localSearch.weapon !== search.weapon ||
                localSearch.skill !== search.skill ||
                localSearch.equip !== search.equip
            ) {
                setSearch(localSearch);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [localSearch, search, setSearch]);

    // Sync local state if parent changes
    useEffect(() => {
        setLocalSearch(search);
    }, [search]);

    const handleChange = (field: keyof typeof search, value: string) => {
        setLocalSearch(prev => ({ ...prev, [field]: value }));
    };

    const clearField = (field: keyof typeof search) => {
        setLocalSearch(prev => ({ ...prev, [field]: '' }));
        setSearch(prev => ({ ...prev, [field]: '' }));
    };

    const clearAll = () => {
        const empty = { weapon: '', skill: '', equip: '' };
        setLocalSearch(empty);
        setSearch(empty);
    };

    const hasAnySearch = localSearch.weapon || localSearch.skill || localSearch.equip;

    return (
        <div className="search-bar">
            <div className="search-fields">
                <div className="search-field">
                    <div className="field-icon weapon-icon">
                        <Sword size={16} />
                    </div>
                    <input
                        type="text"
                        value={localSearch.weapon}
                        onChange={(e) => handleChange('weapon', e.target.value)}
                        placeholder="Weapon..."
                        className="search-input"
                    />
                    {localSearch.weapon && (
                        <button className="clear-btn" onClick={() => clearField('weapon')}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="search-field">
                    <div className="field-icon skill-icon">
                        <Zap size={16} />
                    </div>
                    <input
                        type="text"
                        value={localSearch.skill}
                        onChange={(e) => handleChange('skill', e.target.value)}
                        placeholder="Skill..."
                        className="search-input"
                    />
                    {localSearch.skill && (
                        <button className="clear-btn" onClick={() => clearField('skill')}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="search-field">
                    <div className="field-icon equip-icon">
                        <Shield size={16} />
                    </div>
                    <input
                        type="text"
                        value={localSearch.equip}
                        onChange={(e) => handleChange('equip', e.target.value)}
                        placeholder="Equipment..."
                        className="search-input"
                    />
                    {localSearch.equip && (
                        <button className="clear-btn" onClick={() => clearField('equip')}>
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {hasAnySearch && (
                <button className="clear-all-btn" onClick={clearAll}>
                    Clear All
                </button>
            )}
        </div>
    );
};
