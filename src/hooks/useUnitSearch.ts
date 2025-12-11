import { useState, useMemo } from 'react';
import type { Unit } from '../types';
import type { IDatabase } from '../services/Database';
import type { QueryState, QueryFilter } from '../components/QueryBuilder';
import type { FiltersState } from '../components/FilterBar';

export const useUnitSearch = (db: IDatabase, loading: boolean) => {
    const [query, setQuery] = useState<QueryState>({
        filters: [],
        operator: 'or'
    });

    const [filters, setFilters] = useState<FiltersState>({
        factions: []
    });

    const filteredUnits = useMemo(() => {
        if (loading) return [];

        // First, apply query filters using modifier-aware search
        let results: Unit[];
        if (query.filters.length === 0) {
            results = [];
        } else {
            results = db.searchWithModifiers(
                query.filters.map((f: QueryFilter) => ({
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
    }, [query, filters, loading, db]);

    return {
        query,
        setQuery,
        filters,
        setFilters,
        filteredUnits,
        hasSearch: query.filters.length > 0
    };
};
