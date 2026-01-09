import { useState, useMemo } from 'react';
import type { Unit } from '../types';
import type { IDatabase } from '../services/Database';
import type { QueryState } from '../components/QueryBuilder';
import type { FiltersState } from '../components/FilterBar';

export const useUnitSearch = (db: IDatabase, loading: boolean) => {
    const [query, setQuery] = useState<QueryState>({
        filters: [],
        operator: 'or'
    });

    const [filters, setFilters] = useState<FiltersState>({
        factions: []
    });

    // Helper to check if a unit matches ALL stat filters
    const checkProfileStat = (profile: any, stat: string, operator: string, value: number) => {
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
                // Handle MOV array [6-4]
                // Convert to total inches
                if (Array.isArray(profile.move) && profile.move.length === 2) {
                    const totalCm = profile.move[0] + profile.move[1];
                    statVal = Math.round(totalCm * 0.4); // Convert to inches
                } else {
                    return false;
                }
                break;
            case 'MOV-1':
                if (Array.isArray(profile.move) && profile.move.length >= 1) {
                    statVal = Math.round(profile.move[0] * 0.4);
                } else {
                    return false;
                }
                break;
            case 'MOV-2':
                if (Array.isArray(profile.move) && profile.move.length >= 2) {
                    statVal = Math.round(profile.move[1] * 0.4);
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

    const checkUnitStats = (unit: Unit, filter: any) => {
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

    const checkStatFilters = (unit: Unit, stats: any[]) => {
        // Implementation detail: How do we check "matches filters" when we have mixed types?
        // Above in useMemo, for AND:
        // We already filtered by items. So valid units match all items.
        // We now just need them to match ALL stats.

        // For OR:
        // We have item matches. We need to ADD units that match ANY stat filter.
        // But wait... if we have [Stat A, Stat B] and OR.
        // Do we want (Stat A OR Stat B)? Yes.

        if (query.operator === 'and') {
            return stats.every((filter: any) => checkUnitStats(unit, filter));
        } else {
            return stats.some((filter: any) => checkUnitStats(unit, filter));
        }
    };

    const filteredUnits = useMemo(() => {
        if (loading) return [];

        // Split filters
        const itemFilters = query.filters.filter(f => f.type !== 'stat' && f.type !== undefined) as any[]; // Type assertion for now to avoid complexity
        const statFilters = query.filters.filter(f => f.type === 'stat') as any[];

        // First, apply item filters using modifier-aware search
        let results: Unit[];

        // If we have no item filters, but have stat filters
        if (itemFilters.length === 0) {
            if (statFilters.length > 0) {
                // If AND: Start with all units to filter down.
                // If OR: Start with empty to union with stat matches.
                results = query.operator === 'and' ? db.units : [];
            } else {
                results = [];
            }
        } else {
            results = db.searchWithModifiers(
                itemFilters.map((f: any) => ({
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

        return results;
    }, [query, filters, loading, db]);

    // Helper to check if a unit matches ALL stat filters (stats are always ANDed together? Or do they obey query.operator?)
    // Usually in a list of filters, the operator applies to the list.
    // If I have Filters: [Weapon A, WIP > 14] and Operator OR. -> Units with Weapon A OR Units with WIP > 14.
    // If Operator AND -> Units with Weapon A AND WIP > 14.

    // So for the checking logic:
    // If operator is OR, we check if unit matches AT LEAST ONE stat filter (if item filters didn't match).
    // NO, that's complex.
    // Let's simplify:
    // IF operator is AND: Unit must match ALL filters.
    // IF operator is OR: Unit must match ANY filter.

    return {
        query,
        setQuery,
        filters,
        setFilters,
        filteredUnits,
        hasSearch: query.filters.length > 0
    };
};
