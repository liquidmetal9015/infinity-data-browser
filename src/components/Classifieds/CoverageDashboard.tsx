import { useMemo } from 'react';
import type { ArmyList } from '../../../shared/listTypes';
import type { Unit } from '../../../shared/types';
import type { IDatabase } from '../../services/Database';
import { useListClassifiedCoverage } from '../../hooks/useListClassifiedCoverage';
import { useClassifiedMatches } from '../../hooks/useClassifiedMatches';
import { CoverageSummaryBar } from './CoverageSummaryBar';
import { CoverageTable } from './CoverageTable';
import styles from './CoverageDashboard.module.css';

interface CoverageDashboardProps {
    list: ArmyList;
    db: IDatabase;
    factionUnits: Unit[];
}

export interface CandidateUnit {
    unitName: string;
    reason: string;
}

export function CoverageDashboard({ list, db, factionUnits }: CoverageDashboardProps) {
    const coverage = useListClassifiedCoverage(db.classifieds, list);
    const factionMatches = useClassifiedMatches(db, factionUnits);

    // Build per-objective candidate units (faction units NOT in the list that could fill gaps)
    const listUnitIscs = useMemo(() => {
        const iscs = new Set<string>();
        for (const g of list.groups) {
            for (const lu of g.units) {
                if (!lu.isPeripheral) iscs.add(lu.unit.isc);
            }
        }
        return iscs;
    }, [list]);

    const candidatesByObjective = useMemo(() => {
        if (!factionMatches) return new Map<number, CandidateUnit[]>();
        const result = new Map<number, CandidateUnit[]>();

        for (const [isc, entry] of factionMatches) {
            if (listUnitIscs.has(isc)) continue; // skip units already in list

            for (const pm of entry.profileMatches) {
                for (const m of pm.matches) {
                    if (!m.canComplete) continue;
                    const existing = result.get(m.objectiveId) || [];
                    // Deduplicate by unit name per objective
                    if (!existing.some(c => c.unitName === entry.unit.name)) {
                        existing.push({ unitName: entry.unit.name, reason: m.reason });
                        result.set(m.objectiveId, existing);
                    }
                }
            }
        }
        return result;
    }, [factionMatches, listUnitIscs]);

    if (!coverage) return null;

    return (
        <div className={styles.dashboard}>
            <CoverageSummaryBar
                coverageCount={coverage.coverageCount}
                totalCount={coverage.totalCount}
                categories={coverage.categories}
            />
            <CoverageTable
                categories={coverage.categories}
                candidatesByObjective={candidatesByObjective}
            />
        </div>
    );
}
