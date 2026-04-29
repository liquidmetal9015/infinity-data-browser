import { useState, useMemo } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { useListStore } from '../../stores/useListStore';
import { useListBuilderUIStore } from '../../stores/useListBuilderUIStore';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { Settings2, ChevronDown } from 'lucide-react';
import type { Unit } from '@shared/types';
import { ExpandableUnitCard } from '../shared/ExpandableUnitCard';
import { UnifiedSearchBar, type QueryState } from '../shared/UnifiedSearchBar';
import { CLASSIFICATION_LABELS, CLASSIFICATION_COLORS, CLASSIFICATION_ORDER } from '../../utils/classifications';
import { getPossibleFireteams } from '@shared/fireteams';

export function UnitRosterPanel() {
    const db = useDatabase();
    const currentList = useListStore(s => s.currentList);
    const addUnit = useListStore(s => s.addUnit);
    const { hoveredFireteamId, targetGroupIndex, selectUnitForDetail, setHoveredUnitISC } = useListBuilderUIStore();
    const hasDetailPanel = useWorkspaceStore(s => s.windows.some(w => w.type === 'UNIT_DETAIL'));

    const [rosterQuery, setRosterQuery] = useState<QueryState>({ filters: [], operator: 'or' });
    const [rosterTextQuery, setRosterTextQuery] = useState('');
    const [expandedUnitIds, setExpandedUnitIds] = useState<Set<number>>(new Set());
    const [expandMode, setExpandMode] = useState<'single' | 'multiple'>('single');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

    // Compute valid ISCs for hovered fireteam (moved from ListDashboard)
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    const hoveredFireteamData = useMemo(() => {
        if (!hoveredFireteamId || !currentList) return null;
        for (const g of currentList.groups) {
            const ft = g.fireteams?.find(f => f.id === hoveredFireteamId);
            if (ft) {
                const members = g.units.filter(u => u.fireteamId === ft.id).map(lu => ({ name: lu.unit.isc, comment: '' }));
                const chart = db.getFireteamChart(currentList.factionId);
                const possibleTeams = chart ? getPossibleFireteams(chart, members) : [];
                const activeTeamDef = ft.selectedTeamName
                    ? chart?.teams.find(t => t.name === ft.selectedTeamName && (!ft.selectedTeamType || t.type.includes(ft.selectedTeamType)))
                    : (possibleTeams.length === 1 && members.length > 0 ? possibleTeams[0] : null);
                return { activeTeamDef, members };
            }
        }
        return null;
    }, [hoveredFireteamId, currentList, db]);

    const validISCsForHoveredFireteam = useMemo(() => {
        if (!hoveredFireteamData?.activeTeamDef || !db.units.length || !currentList) return new Set<string>();
        const iscs = new Set<string>();
        for (const u of db.units) {
            if (u.factions.includes(currentList.factionId)) {
                const testMembers = [...hoveredFireteamData.members, { name: u.isc, comment: '' }];
                const dummyChart = { teams: [hoveredFireteamData.activeTeamDef] };
                const possible = getPossibleFireteams(dummyChart as Parameters<typeof getPossibleFireteams>[0], testMembers);
                if (possible.length > 0) iscs.add(u.isc);
            }
        }
        return iscs;
    }, [hoveredFireteamData, db.units, currentList]);

    const factionUnits = useMemo(() => {
        if (!currentList) return [];
        return db.units.filter(unit => unit.factions.includes(currentList.factionId));
    }, [db.units, currentList]);

    const filteredRoster = useMemo(() => {
        let results = factionUnits;

        const itemFilters = rosterQuery.filters.filter(f => f.type !== 'stat');
        if (itemFilters.length > 0) {
            const searched = db.searchWithModifiers(
                itemFilters.map((f) => ({
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

    const isSearchActive = rosterTextQuery.trim().length > 0 || rosterQuery.filters.length > 0;

    const groupedRoster = useMemo(() => {
        if (isSearchActive) return null;

        const groups = new Map<number, Unit[]>();
        for (const unit of filteredRoster) {
            const primaryType = unit.raw.profileGroups[0]?.profiles[0]?.type ?? 0;
            if (!groups.has(primaryType)) groups.set(primaryType, []);
            groups.get(primaryType)!.push(unit);
        }

        return CLASSIFICATION_ORDER
            .filter(t => groups.has(t))
            .map(t => ({
                type: t,
                label: CLASSIFICATION_LABELS[t] || `Type ${t}`,
                color: CLASSIFICATION_COLORS[t] || '#94a3b8',
                units: groups.get(t)!,
            }));
    }, [filteredRoster, isSearchActive]);

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

    const toggleGroupCollapse = (type: number) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });
    };

    const handleAddUnit = (unit: Unit, pgId: number, pId: number, oId: number) => {
        addUnit(unit, targetGroupIndex, pgId, pId, oId);
    };

    const handleViewUnit = (unit: Unit) => {
        selectUnitForDetail(unit);
    };

    if (!currentList) {
        return (
            <div className="roster-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                    Create or import a list in the Army List panel to browse units.
                </p>
            </div>
        );
    }

    const renderUnitCard = (unit: Unit) => (
        <ExpandableUnitCard
            key={unit.id}
            unit={unit}
            isExpanded={!hasDetailPanel && expandedUnitIds.has(unit.id)}
            onToggle={() => toggleExpand(unit.id)}
            detailMode={hasDetailPanel}
            searchQuery={rosterTextQuery.trim()}
            activeFilters={rosterQuery.filters}
            isHighlighted={validISCsForHoveredFireteam.has(unit.isc)}
            onMouseEnter={() => setHoveredUnitISC(unit.isc)}
            onMouseLeave={() => setHoveredUnitISC(null)}
            onAddUnit={handleAddUnit}
            onViewUnit={handleViewUnit}
        />
    );

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
                    placeholder="Search by name, weapon, skill, equipment..."
                    className="bg-transparent"
                />
            </div>

            <div className="roster-list overflow-y-auto">
                {groupedRoster ? (
                    groupedRoster.map(group => (
                        <div key={group.type}>
                            <button
                                className="w-full flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#1e293b] sticky top-0 z-10 cursor-pointer hover:bg-[#1e293b] transition-colors"
                                onClick={() => toggleGroupCollapse(group.type)}
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className="text-[11px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                                        style={{
                                            color: group.color,
                                            background: `${group.color}15`,
                                            border: `1px solid ${group.color}30`
                                        }}
                                    >
                                        {group.label}
                                    </span>
                                    <span className="text-xs text-gray-500">{group.units.length}</span>
                                </div>
                                <ChevronDown
                                    size={14}
                                    className={`text-gray-500 transition-transform ${collapsedGroups.has(group.type) ? '-rotate-90' : ''}`}
                                />
                            </button>
                            {!collapsedGroups.has(group.type) && (
                                <div className="p-2 space-y-1.5">
                                    {group.units.map(renderUnitCard)}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="p-2 space-y-1.5">
                        {filteredRoster.map(renderUnitCard)}
                    </div>
                )}
            </div>
        </div>
    );
}
