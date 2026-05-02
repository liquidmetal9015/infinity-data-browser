import { useState, useMemo, useCallback } from 'react';
import type { Unit, Profile } from '@shared/types';
import type { IDatabase } from '../services/Database';
import type { QueryState, StatFilter } from '../components/shared/UnifiedSearchBar';
import type { FiltersState } from '../components/FilterBar';

// Pure stat-comparison helpers. Module-level so they are stable across renders
// and don't pollute useCallback/useMemo dependency arrays.
function checkProfileStat(profile: Profile, stat: string, operator: string, value: number) {
        let statVal = 0;

        // Handle lookup
        switch (stat) {
            case 'CC': statVal = profile.cc; break;
            case 'BS': statVal = profile.bs; break;
            case 'PH': statVal = profile.ph; break;
            case 'WIP': statVal = profile.wip; break;
            case 'ARM': statVal = profile.arm; break;
            case 'BTS': statVal = profile.bts; break;
            case 'W': statVal = profile.w; break;
            case 'S': statVal = profile.s; break;
            case 'MOV':
                // MOV values are already in inches from ETL processing
                if (Array.isArray(profile.move) && profile.move.length === 2) {
                    statVal = profile.move[0] + profile.move[1];
                } else {
                    return false;
                }
                break;
            case 'MOV-1':
                if (Array.isArray(profile.move) && profile.move.length >= 1) {
                    statVal = profile.move[0];
                } else {
                    return false;
                }
                break;
            case 'MOV-2':
                if (Array.isArray(profile.move) && profile.move.length >= 2) {
                    statVal = profile.move[1];
                } else {
                    return false;
                }
                break;
            default: return false;
        }

        // Compare
        switch (operator) {
            case '>': return statVal > value;
            case '>=': return statVal >= value;
            case '=': return statVal === value;
            case '<=': return statVal <= value;
            case '<': return statVal < value;
        default: return false;
    }
}

function checkUnitStats(unit: Unit, filter: StatFilter): boolean {
    const { stat, operator, value } = filter;
    // Match if ANY profile in the unit meets the stat condition.
    for (const group of unit.raw.profileGroups) {
        for (const profile of group.profiles) {
            if (checkProfileStat(profile, stat, operator, value)) return true;
        }
    }
    return false;
}

export const useUnitSearch = (db: IDatabase, loading: boolean) => {
    const [query, setQuery] = useState<QueryState>({
        filters: [],
        operator: 'or',
    });

    const [filters, setFilters] = useState<FiltersState>({
        factions: [],
    });

    const [textQuery, setTextQuery] = useState('');

    const checkStatFilters = useCallback((unit: Unit, stats: StatFilter[]) => {
        if (query.operator === 'and') {
            return stats.every((filter) => checkUnitStats(unit, filter));
        } else {
            return stats.some((filter) => checkUnitStats(unit, filter));
        }
    }, [query.operator]);

    const filteredUnits = useMemo(() => {
        if (loading) return [];

        // Split filters
        const itemFilters = query.filters.filter(f => f.type !== 'stat');
        const statFilters = query.filters.filter(f => f.type === 'stat') as StatFilter[];

        // First, apply item filters using modifier-aware search
        let results: Unit[];

        // If we have no item filters, but have stat filters
        if (itemFilters.length === 0) {
            if (statFilters.length > 0) {
                // If AND: Start with all units to filter down.
                // If OR: Start with empty to union with stat matches.
                results = query.operator === 'and' ? db.units : [];
            } else {
                // No item or stat filters — seed with all units only if there's a text query
                results = textQuery.trim() ? db.units : [];
            }
        } else {
            results = db.searchWithModifiers(
                itemFilters.map((f) => ({
                    type: f.type,
                    baseId: f.baseId,
                    modifiers: f.modifiers,
                    matchAnyModifier: f.matchAnyModifier
                })),
                query.operator
            );
        }

        // Apply Stat Filters
        if (statFilters.length > 0) {
            // Re-implementing logic to handle OR/AND correctly with mixed filter types
            if (query.operator === 'and') {
                // AND: Must match item filters AND stat filters
                // results already contains item matches. Now filter by stats.
                results = results.filter(unit => checkStatFilters(unit, statFilters));
            } else {
                // OR: Must match item filters OR stat filters
                // We need all units that match stats
                const statMatches = db.units.filter(unit => checkStatFilters(unit, statFilters));

                // Union with existing results (item matches)
                const existingIds = new Set(results.map(u => u.id));
                for (const unit of statMatches) {
                    if (!existingIds.has(unit.id)) {
                        results.push(unit);
                    }
                }
            }
        }

        // Then apply additional filters (Factions)
        if (results.length > 0) {
            if (filters.factions.length > 0) {
                results = results.filter(unit =>
                    unit.factions.some(fid => filters.factions.includes(fid))
                );
            }
        }

        // Apply text query
        if (textQuery.trim()) {
            const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
            const lowerTerm = normalize(textQuery.trim());
            results = results.filter(unit => {
                if (normalize(unit.name ?? '') .includes(lowerTerm) || normalize(unit.isc).includes(lowerTerm)) return true;

                for (const group of unit.raw.profileGroups) {
                    for (const profile of group.profiles) {
                        if (profile.skills?.some(s => normalize(s.name).includes(lowerTerm))) return true;
                        if (profile.equipment?.some(e => normalize(e.name).includes(lowerTerm))) return true;
                    }
                    for (const opt of group.options) {
                        if (opt.weapons?.some(w => normalize(w.name).includes(lowerTerm))) return true;
                        if (opt.equipment?.some(e => normalize(e.name).includes(lowerTerm))) return true;
                        if (opt.skills?.some(s => normalize(s.name).includes(lowerTerm))) return true;
                        if (normalize(opt.name ?? '').includes(lowerTerm) || normalize(group.isc ?? '').includes(lowerTerm)) return true;
                    }
                }
                return false;
            });
        }

        return results;
    }, [query, filters, textQuery, loading, db, checkStatFilters]);

    return {
        query,
        setQuery,
        filters,
        setFilters,
        textQuery,
        setTextQuery,
        filteredUnits,
        hasSearch: query.filters.length > 0 || textQuery.trim().length > 0
    };
};
