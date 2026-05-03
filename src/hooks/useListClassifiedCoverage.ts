import { useMemo } from 'react';
import { getClassifiedsForOption, type ClassifiedObjective, type ClassifiedMatch } from '../../shared/classifieds';
import { getUnitDetails, type ArmyList, type ListUnit } from '../../shared/listTypes';

// ============================================================================
// Category definitions
// ============================================================================

export interface CategoryDef {
    name: string;
    short: string;
    color: string;
}

export const CATEGORIES: CategoryDef[] = [
    { name: 'Battlefield Control', short: 'Battlefield', color: '#6366f1' },
    { name: 'Support & Sabotage', short: 'Support', color: '#8b5cf6' },
    { name: 'Engineering & Technical Operations', short: 'Engineering', color: '#a78bfa' },
    { name: 'Intelligence & Scanning Objectives', short: 'Intelligence', color: '#c4b5fd' },
    { name: 'High-Value Target (HVT) & Infiltration Objectives', short: 'HVT & Infiltration', color: '#818cf8' },
];

// ============================================================================
// Types
// ============================================================================

export interface ListUnitMatch {
    listUnit: ListUnit;
    reason: string;
}

export interface ObjectiveCoverage {
    objective: ClassifiedObjective;
    covered: boolean;
    matchingListUnits: ListUnitMatch[];
}

export interface CategoryCoverage {
    def: CategoryDef;
    covered: number;
    total: number;
    objectives: ObjectiveCoverage[];
}

export interface ListClassifiedCoverage {
    coverageCount: number;
    totalCount: number;
    categories: CategoryCoverage[];
    byObjectiveId: Map<number, ObjectiveCoverage>;
}

// ============================================================================
// Hook
// ============================================================================

export function useListClassifiedCoverage(
    classifieds: ClassifiedObjective[],
    list: ArmyList | null,
): ListClassifiedCoverage | null {
    return useMemo(() => {
        if (!list || !classifieds.length) return null;

        // Build per-objective match map
        const objectiveMatches = new Map<number, ListUnitMatch[]>();
        for (const cls of classifieds) {
            objectiveMatches.set(cls.id, []);
        }

        // Flatten list units, skip peripherals
        const listUnits = list.groups.flatMap(g => g.units).filter(lu => !lu.isPeripheral);

        for (const lu of listUnits) {
            const { profile, option } = getUnitDetails(lu.unit, lu.profileGroupId, lu.profileId, lu.optionId);
            if (!profile || !option) continue;

            const matches = getClassifiedsForOption(lu.unit, profile, option, classifieds);
            for (const m of matches) {
                if (m.canComplete) {
                    objectiveMatches.get(m.objectiveId)!.push({
                        listUnit: lu,
                        reason: m.reason,
                    });
                }
            }
        }

        // Build per-objective coverage
        const byObjectiveId = new Map<number, ObjectiveCoverage>();
        for (const cls of classifieds) {
            const matchingListUnits = objectiveMatches.get(cls.id) || [];
            byObjectiveId.set(cls.id, {
                objective: cls,
                covered: matchingListUnits.length > 0,
                matchingListUnits,
            });
        }

        // Group into categories
        const categoryMap = new Map<string, ClassifiedObjective[]>();
        for (const cls of classifieds) {
            const existing = categoryMap.get(cls.category) || [];
            existing.push(cls);
            categoryMap.set(cls.category, existing);
        }

        let coverageCount = 0;
        const categories: CategoryCoverage[] = CATEGORIES.map(def => {
            const objectives = (categoryMap.get(def.name) || []).map(cls => byObjectiveId.get(cls.id)!);
            const covered = objectives.filter(o => o.covered).length;
            coverageCount += covered;
            return { def, covered, total: objectives.length, objectives };
        });

        return {
            coverageCount,
            totalCount: classifieds.length,
            categories,
            byObjectiveId,
        };
    }, [classifieds, list]);
}
