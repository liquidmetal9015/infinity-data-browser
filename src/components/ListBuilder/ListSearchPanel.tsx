import { useState, useMemo } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { type ArmyList } from '@shared/listTypes';
import { Settings2 } from 'lucide-react';
import type { Unit } from '@shared/types';
import { ExpandableUnitCard } from '../shared/ExpandableUnitCard';
import { UnifiedSearchBar, type QueryState } from '../shared/UnifiedSearchBar';

interface ListSearchPanelProps {
    list: ArmyList;
    onAddUnit: (unit: Unit, pgId: any, pId: any, oId: any) => void;
    onViewUnit: (unit: Unit) => void;
    validISCsForHoveredFireteam: Set<string>;
    onUnitHover: (isc: string | null) => void;
}

export function ListSearchPanel({
    list,
    onAddUnit,
    onViewUnit,
    validISCsForHoveredFireteam,
    onUnitHover,
}: ListSearchPanelProps) {
    const db = useDatabase();

    const [rosterQuery, setRosterQuery] = useState<QueryState>({ filters: [], operator: 'or' });
    const [rosterTextQuery, setRosterTextQuery] = useState('');
    const [expandedUnitIds, setExpandedUnitIds] = useState<Set<number>>(new Set());
    const [expandMode, setExpandMode] = useState<'single' | 'multiple'>('single');

    const factionUnits = useMemo(() => {
        return db.units.filter(unit => unit.factions.includes(list.factionId));
    }, [db.units, list.factionId]);

    const filteredRoster = useMemo(() => {
        let results = factionUnits;

        const itemFilters = rosterQuery.filters.filter(f => f.type !== 'stat') as any[];
        if (itemFilters.length > 0) {
            const searched = db.searchWithModifiers(
                itemFilters.map((f: any) => ({
                    type: f.type,
                    baseId: f.baseId,
                    modifiers: f.modifiers,
                    matchAnyModifier: f.matchAnyModifier
                })),
                rosterQuery.operator
            );
            const searchedIds = new Set(searched.map(u => u.id));
            results = results.filter(u => searchedIds.has(u.id));
        }

        if (rosterTextQuery.trim()) {
            const q = rosterTextQuery.trim().toLowerCase();
            results = results.filter(unit => {
                if (unit.isc.toLowerCase().includes(q) || unit.name?.toLowerCase().includes(q)) return true;
                for (const group of unit.raw.profileGroups) {
                    for (const profile of group.profiles) {
                        if (profile.skills?.some(s => db.skillMap.get(s.id)?.toLowerCase().includes(q))) return true;
                        if (profile.equip?.some(e => db.equipmentMap.get(e.id)?.toLowerCase().includes(q))) return true;
                    }
                    for (const opt of group.options) {
                        if (opt.weapons?.some(w => db.weaponMap.get(w.id)?.toLowerCase().includes(q))) return true;
                        if (opt.equip?.some(e => db.equipmentMap.get(e.id)?.toLowerCase().includes(q))) return true;
                        if (opt.skills?.some(s => db.skillMap.get(s.id)?.toLowerCase().includes(q))) return true;
                        if (opt.name?.toLowerCase().includes(q) || group.isco?.toLowerCase().includes(q)) return true;
                    }
                }
                return false;
            });
        }

        return results;
    }, [factionUnits, rosterQuery, rosterTextQuery, db]);

    const toggleExpand = (unitId: number) => {
        setExpandedUnitIds(prev => {
            const next = new Set(prev);
            if (next.has(unitId)) {
                next.delete(unitId);
            } else {
                if (expandMode === 'single') {
                    next.clear();
                }
                next.add(unitId);
            }
            return next;
        });
    };

    return (
        <div className="roster-panel">
            <div className="roster-header">
                <h3>Unit Roster</h3>
                <div className="flex items-center gap-2">
                    <button
                        className={`p-1 rounded transition-colors ${expandMode === 'multiple' ? 'bg-blue-500/20 text-blue-400' : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/10'}`}
                        onClick={() => setExpandMode(m => m === 'single' ? 'multiple' : 'single')}
                        title={expandMode === 'single' ? 'Enable Multiple Expansion' : 'Enable Single Expansion'}
                    >
                        <Settings2 size={16} />
                    </button>
                    <span className="roster-count">{factionUnits.length}</span>
                </div>
            </div>

            <div className="roster-search border-b border-[#1e293b]">
                <UnifiedSearchBar
                    query={rosterQuery}
                    setQuery={setRosterQuery}
                    textQuery={rosterTextQuery}
                    setTextQuery={setRosterTextQuery}
                    placeholder="Search roster..."
                    className="bg-transparent"
                />
            </div>

            <div className="roster-list p-2 space-y-1.5 overflow-y-auto">
                {filteredRoster.map(unit => (
                    <ExpandableUnitCard
                        key={unit.id}
                        unit={unit}
                        isExpanded={expandedUnitIds.has(unit.id)}
                        onToggle={() => toggleExpand(unit.id)}
                        searchQuery={rosterTextQuery.trim()}
                        activeFilters={rosterQuery.filters}
                        isHighlighted={validISCsForHoveredFireteam.has(unit.isc)}
                        onMouseEnter={() => onUnitHover(unit.isc)}
                        onMouseLeave={() => onUnitHover(null)}
                        onAddUnit={(unit, pgId, pId, oId) => {
                            onAddUnit(unit, pgId, pId, oId);
                        }}
                        onViewUnit={onViewUnit}
                    />
                ))}
            </div>
        </div>
    );
}
