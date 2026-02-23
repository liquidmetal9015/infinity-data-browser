import React from 'react';
import { Database } from '../services/Database';
import { MultiFactionSelector } from './MultiFactionSelector';

export interface FiltersState {
    factions: number[];  // Selected faction IDs (empty = all)
}

interface FilterBarProps {
    filters: FiltersState;
    setFilters: React.Dispatch<React.SetStateAction<FiltersState>>;
}

export const FilterBar: React.FC<FilterBarProps> = ({ filters, setFilters }) => {
    const db = Database.getInstance();
    const groupedFactions = db.getGroupedFactions();

    const handleFactionsChange = (factions: number[]) => {
        setFilters(prev => ({ ...prev, factions }));
    };

    const hasActiveFilters = filters.factions.length > 0;

    return (
        <div className="filter-bar flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl p-3">
            <div className="flex-1 w-full max-w-sm">
                <MultiFactionSelector
                    value={filters.factions}
                    onChange={handleFactionsChange}
                    groupedFactions={groupedFactions}
                    placeholder="All Factions"
                />
            </div>

            {/* Clear All Filters */}
            {hasActiveFilters && (
                <button
                    className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700"
                    onClick={() => setFilters(prev => ({ ...prev, factions: [] }))}
                >
                    Clear Filters
                </button>
            )}
        </div>
    );
};
