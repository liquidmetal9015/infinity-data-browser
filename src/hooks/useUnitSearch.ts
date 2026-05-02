import { useState, useMemo } from 'react';
import type { Unit, Profile } from '@shared/types';
import type { IDatabase } from '../services/Database';
import type { QueryState, StatFilter } from '../components/shared/UnifiedSearchBar';
import type { FiltersState } from '../components/FilterBar';

export const useUnitSearch = (db: IDatabase, loading: boolean) => {
    const [query, setQuery] = useState<QueryState>({
        filters: [],
        operator: 'or'
    });

    const [filters, setFilters] = useState<FiltersState>({
        factions: []
    });

    const [textQuery, setTextQuery] = useState('');

    // Helper to check if a unit matches ALL stat filters
    const checkProfileStat = (profile: Profile, stat: string, operator: string, value: number) => {
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
    };

    const checkUnitStats = (unit: Unit, filter: StatFilter) => {
        const { stat, operator, value } = filter;

        // Check all profiles/options in the unit.
        // Return true if ANY profile matches the stat condition.
        // (As per implementation plan: "match if **ANY** single profile within a Unit meets **ALL** the criteria" - wait, criteria is per filter)
        // So for a single filter 'WIP > 13', we return true if any profile has WIP > 13.

        // Iterate profiles
        for (const group of unit.raw.profileGroups) {
            // Check profiles
            for (const profile of group.profiles) {
                if (checkProfileStat(profile, stat, operator, value)) return true;
            }
            // Check options? Options usually modify equipment/skills, but typically inherit stats from profile?
            // In Infinity data, `options` can have overrides but usually stats are on profile.
            // Wait, Unit definition: 
            // profiles: Profile[] (has stats)
            // options: Option[] (has points, swc, skills, equip, weapons - NO stats usually)
            // However, sometimes stats DO change? No, usually distinct profiles for stat changes (e.g. MetaChemistry)
            // So checking profiles is sufficient.
        }
        return false;
    };

    const checkStatFilters = (unit: Unit, stats: StatFilter[]) => {
        if (query.operator === 'and') {
            return stats.every((filter) => checkUnitStats(unit, filter));
        } else {
            return stats.some((filter) => checkUnitStats(unit, filter));
        }
    };

    // eslint-disable-next-line react-hooks/preserve-manual-memoization
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
            const lowerTerm = textQuery.trim().toLowerCase();
            results = results.filter(unit => {
                if (unit.name?.toLowerCase().includes(lowerTerm) || unit.isc.toLowerCase().includes(lowerTerm)) return true;

                for (const group of unit.raw.profileGroups) {
                    for (const profile of group.profiles) {
                        if (profile.skills?.some(s => s.name.toLowerCase().includes(lowerTerm))) return true;
                        if (profile.equipment?.some(e => e.name.toLowerCase().includes(lowerTerm))) return true;
                    }
                    for (const opt of group.options) {
                        if (opt.weapons?.some(w => w.name.toLowerCase().includes(lowerTerm))) return true;
                        if (opt.equipment?.some(e => e.name.toLowerCase().includes(lowerTerm))) return true;
                        if (opt.skills?.some(s => s.name.toLowerCase().includes(lowerTerm))) return true;
                        if (opt.name?.toLowerCase().includes(lowerTerm) || group.isc?.toLowerCase().includes(lowerTerm)) return true;
                    }
                }
                return false;
            });
        }

        return results;
    }, [query, filters, textQuery, loading, db]);

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
