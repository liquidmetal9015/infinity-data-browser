import { useState, useMemo } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { useListStore } from '../../stores/useListStore';
import { useGlobalFactionStore } from '../../stores/useGlobalFactionStore';
import { useListBuilderUIStore } from '../../stores/useListBuilderUIStore';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { Settings2, ChevronDown } from 'lucide-react';
import type { Unit } from '@shared/types';
import { ExpandableUnitCard } from '../shared/ExpandableUnitCard';
import { UnifiedSearchBar, type QueryState, type StatFilter } from '../shared/UnifiedSearchBar';
import { CLASSIFICATION_LABELS, CLASSIFICATION_COLORS, CLASSIFICATION_ORDER } from '../../utils/classifications';
import { getPossibleFireteams } from '@shared/fireteams';
import { clsx } from 'clsx';
import styles from '../ListBuilder/ListDashboard.module.css';

function matchesStat(unit: Unit, filter: StatFilter): boolean {
    const compare = (val: number) => {
        switch (filter.operator) {
            case '>': return val > filter.value;
            case '>=': return val >= filter.value;
            case '=': return val === filter.value;
            case '<=': return val <= filter.value;
            case '<': return val < filter.value;
        }
    };
    for (const pg of unit.raw.profileGroups) {
        for (const profile of pg.profiles) {
            let val: number | undefined;
            switch (filter.stat) {
                case 'MOV': val = Math.max(profile.move[0], profile.move[1]); break;
                case 'MOV-1': val = profile.move[0]; break;
                case 'MOV-2': val = profile.move[1]; break;
                case 'CC': val = profile.cc; break;
                case 'BS': val = profile.bs; break;
                case 'PH': val = profile.ph; break;
                case 'WIP': val = profile.wip; break;
                case 'ARM': val = profile.arm; break;
                case 'BTS': val = profile.bts; break;
                case 'W': val = profile.w; break;
                case 'S': val = profile.s; break;
            }
            if (val !== undefined && compare(val)) return true;
        }
    }
    return false;
}

export function UnitRosterPanel() {
    const db = useDatabase();
    const currentList = useListStore(s => s.currentList);
    const addUnit = useListStore(s => s.addUnit);
    const { globalFactionId } = useGlobalFactionStore();
    const { hoveredFireteamId, targetGroupIndex, selectUnitForDetail, setHoveredUnitISC } = useListBuilderUIStore();
    const windows = useWorkspaceStore(s => s.windows);
    const layoutMode = useWorkspaceStore(s => s.layoutMode);
    const columnCount = useWorkspaceStore(s => s.columnCount);
    const hasDetailPanel = layoutMode === 'columns'
        ? columnCount === 3
        : windows.some(w => w.type === 'UNIT_DETAIL' && !w.isMinimized);

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

    const activeFactionId = currentList?.factionId ?? globalFactionId;
    const factionUnits = useMemo(() => {
        if (!activeFactionId) return db.units;
        return db.units.filter(unit => unit.factions.includes(activeFactionId));
    }, [db.units, activeFactionId]);

    const filteredRoster = useMemo(() => {
        let results = factionUnits;

        const itemFilters = rosterQuery.filters.filter(f => f.type !== 'stat');
        const statFilters = rosterQuery.filters.filter(f => f.type === 'stat') as StatFilter[];

        if (itemFilters.length > 0 || statFilters.length > 0) {
            if (rosterQuery.operator === 'or') {
                const matchedIds = new Set<number>();
                if (itemFilters.length > 0) {
                    db.searchWithModifiers(
                        itemFilters.map(f => ({ type: f.type, baseId: f.baseId, modifiers: f.modifiers, matchAnyModifier: f.matchAnyModifier })),
                        'or'
                    ).forEach(u => matchedIds.add(u.id));
                }
                if (statFilters.length > 0) {
                    factionUnits.forEach(u => {
                        if (statFilters.some(sf => matchesStat(u, sf))) matchedIds.add(u.id);
                    });
                }
                results = results.filter(u => matchedIds.has(u.id));
            } else {
                // AND: narrow sequentially
                if (itemFilters.length > 0) {
                    const searched = db.searchWithModifiers(
                        itemFilters.map(f => ({ type: f.type, baseId: f.baseId, modifiers: f.modifiers, matchAnyModifier: f.matchAnyModifier })),
                        'and'
                    );
                    const searchedIds = new Set(searched.map(u => u.id));
                    results = results.filter(u => searchedIds.has(u.id));
                }
                if (statFilters.length > 0) {
                    results = results.filter(u => statFilters.every(sf => matchesStat(u, sf)));
                }
            }
        }

        if (rosterTextQuery.trim()) {
            const q = rosterTextQuery.trim().toLowerCase();
            results = results.filter(unit => {
                if (unit.isc.toLowerCase().includes(q) || unit.name?.toLowerCase().includes(q)) return true;
                for (const group of unit.raw.profileGroups) {
                    for (const profile of group.profiles) {
                        if (profile.skills?.some(s => s.name.toLowerCase().includes(q))) return true;
                        if (profile.equipment?.some(e => e.name.toLowerCase().includes(q))) return true;
                    }
                    for (const opt of group.options) {
                        if (opt.weapons?.some(w => w.name.toLowerCase().includes(q))) return true;
                        if (opt.equipment?.some(e => e.name.toLowerCase().includes(q))) return true;
                        if (opt.skills?.some(s => s.name.toLowerCase().includes(q))) return true;
                        if (opt.name?.toLowerCase().includes(q) || group.isc?.toLowerCase().includes(q)) return true;
                    }
                }
                return false;
            });
        }

        return results;
    }, [factionUnits, rosterQuery, rosterTextQuery, db]);

    const isSearchActive = rosterTextQuery.trim().length > 0 || rosterQuery.filters.length > 0;

    const groupedRoster = useMemo(() => {
        const groups = new Map<number, Unit[]>();
        for (const unit of filteredRoster) {
            const primaryType = unit.raw.profileGroups[0]?.profiles[0]?.type ?? 0;
            if (!groups.has(primaryType)) groups.set(primaryType, []);
            groups.get(primaryType)!.push(unit);
        }

        const known = CLASSIFICATION_ORDER
            .filter(t => groups.has(t))
            .map(t => ({
                type: t,
                label: CLASSIFICATION_LABELS[t] || `Type ${t}`,
                color: CLASSIFICATION_COLORS[t] || '#94a3b8',
                units: groups.get(t)!,
            }));

        // Catch-all for units with types not in CLASSIFICATION_ORDER
        const knownTypes = new Set(CLASSIFICATION_ORDER);
        const others: Unit[] = [];
        for (const [type, units] of groups) {
            if (!knownTypes.has(type)) others.push(...units);
        }
        if (others.length > 0) {
            known.push({ type: -1, label: 'Other', color: '#94a3b8', units: others });
        }

        return known;
    }, [filteredRoster]);

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
        <div className={styles.rosterPanel}>
            <div className={styles.rosterHeader}>
                <h3>Unit Roster</h3>
                <div className="flex items-center gap-2">
                    <button
                        className={`p-1 rounded transition-colors ${expandMode === 'multiple' ? 'bg-blue-500/20 text-blue-400' : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/10'}`}
                        onClick={() => setExpandMode(m => m === 'single' ? 'multiple' : 'single')}
                        title={expandMode === 'single' ? 'Enable Multiple Expansion' : 'Enable Single Expansion'}
                    >
                        <Settings2 size={16} />
                    </button>
                    <span className={styles.rosterCount}>{factionUnits.length}</span>
                </div>
            </div>

            <div className={clsx(styles.rosterSearch, 'border-b border-[#1e293b]')}>
                <UnifiedSearchBar
                    query={rosterQuery}
                    setQuery={setRosterQuery}
                    textQuery={rosterTextQuery}
                    setTextQuery={setRosterTextQuery}
                    placeholder="Search by name, weapon, skill, equipment..."
                    className="bg-transparent w-full"
                />
            </div>

            <div className={clsx(styles.rosterList, 'overflow-y-auto')}>
                {!isSearchActive ? (
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
