import React, { useState, useMemo } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDatabase } from '../../hooks/useDatabase';
import { useListStore } from '../../stores/useListStore';
import { calculateListPoints, calculateListSWC, getUnitDetails, type ArmyList, type ListUnit } from '@shared/listTypes';
import { Plus, Trash2, Users } from 'lucide-react';
import { getPossibleFireteams } from '@shared/fireteams';
import type { Unit } from '@shared/types';
import { OrderIcon } from '../shared/OrderIcon';
import { countGroupOrders } from '../../utils/orderUtils';
import { SortableFireteamContainer } from './SortableFireteamContainer';
import { DraggableUnitRow } from './DraggableUnitRow';
import { DragOverlayUnit } from './DragOverlayUnit';
import { ListSearchPanel } from './ListSearchPanel';
import './ListDashboard.css';

interface ListDashboardProps {
    list: ArmyList;
    onViewUnit: (unit: Unit) => void;
}

// Droppable container for empty groups or the whole group area
function DroppableCombatGroup({
    groupIndex,
    isTarget,
    children
}: {
    groupIndex: number;
    isTarget: boolean;
    children: React.ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `group-${groupIndex}`,
        data: { type: 'combat-group', groupIndex },
    });

    return (
        <div
            ref={setNodeRef}
            className={`combat-group ${isTarget ? 'is-target' : ''} ${isOver ? 'is-drag-over' : ''}`}
        >
            {children}
        </div>
    );
}

export function ListDashboard({ list, onViewUnit }: ListDashboardProps) {
    const db = useDatabase();
    const { addUnit, removeUnit, addCombatGroup, removeCombatGroup, reorderUnit, moveUnitToGroup, assignToFireteam, removeFromFireteam, addFireteamDef, removeFireteamDef, moveFireteam } = useListStore();

    // Hover state for highlighting
    const [hoveredFireteamId, setHoveredFireteamId] = useState<string | null>(null);
    const [hoveredUnitISC, setHoveredUnitISC] = useState<string | null>(null);

    const hoveredFireteamData = useMemo(() => {
        if (!hoveredFireteamId) return null;
        for (const g of list.groups) {
            const ft = g.fireteams?.find(f => f.id === hoveredFireteamId);
            if (ft) {
                const members = g.units.filter(u => u.fireteamId === ft.id).map(lu => ({ name: lu.unit.isc, comment: '' }));
                const chart = db.getFireteamChart(list.factionId);
                const possibleTeams = chart ? getPossibleFireteams(chart, members) : [];
                const activeTeamDef = ft.selectedTeamName
                    ? chart?.teams.find(t => t.name === ft.selectedTeamName && (!ft.selectedTeamType || t.type.includes(ft.selectedTeamType)))
                    : (possibleTeams.length === 1 && members.length > 0 ? possibleTeams[0] : null);

                return { activeTeamDef, members };
            }
        }
        return null;
    }, [hoveredFireteamId, list, db]);

    const validISCsForHoveredFireteam = useMemo(() => {
        if (!hoveredFireteamData?.activeTeamDef || !db.units.length) return new Set<string>();
        const iscs = new Set<string>();
        for (const u of db.units) {
            if (u.factions.includes(list.factionId)) {
                const testMembers = [...hoveredFireteamData.members, { name: u.isc, comment: '' }];
                const dummyChart = { teams: [hoveredFireteamData.activeTeamDef] };
                const possible = getPossibleFireteams(dummyChart as any, testMembers);
                if (possible.length > 0) iscs.add(u.isc);
            }
        }
        return iscs;
    }, [hoveredFireteamData, db.units, list.factionId]);

    const validFireteamIdsForHoveredUnit = useMemo(() => {
        if (!hoveredUnitISC) return new Set<string>();
        const chart = db.getFireteamChart(list.factionId);
        if (!chart) return new Set<string>();

        const validIds = new Set<string>();

        for (const g of list.groups) {
            for (const ft of g.fireteams || []) {
                const members = g.units.filter(u => u.fireteamId === ft.id).map(lu => ({ name: lu.unit.isc, comment: '' }));
                const testMembers = [...members, { name: hoveredUnitISC, comment: '' }];

                if (ft.selectedTeamName) {
                    const activeTeamDef = chart.teams.find(t => t.name === ft.selectedTeamName && (!ft.selectedTeamType || t.type.includes(ft.selectedTeamType)));
                    if (activeTeamDef) {
                        const possible = getPossibleFireteams({ teams: [activeTeamDef] } as any, testMembers);
                        if (possible.length > 0) validIds.add(ft.id);
                    }
                } else {
                    const possible = getPossibleFireteams(chart, testMembers);
                    if (possible.length > 0) validIds.add(ft.id);
                }
            }
        }
        return validIds;
    }, [hoveredUnitISC, list, db]);

    const [targetGroupIndex, setTargetGroupIndex] = useState(0);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeUnit, setActiveUnit] = useState<ListUnit | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const fireteamCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        const chart = db.getFireteamChart(list.factionId);
        if (!chart) return counts;

        for (const g of list.groups) {
            for (const ft of g.fireteams || []) {
                const members = g.units.filter(u => u.fireteamId === ft.id).map(lu => ({ name: lu.unit.isc, comment: '' }));
                let activeType = ft.selectedTeamType;

                if (!activeType) {
                    const possible = getPossibleFireteams(chart, members);
                    if (possible.length === 1 && possible[0].type.length === 1) {
                        activeType = possible[0].type[0];
                    }
                }

                if (activeType) {
                    counts[activeType] = (counts[activeType] || 0) + 1;
                }
            }
        }
        return counts;
    }, [list, db]);

    const totalPoints = calculateListPoints(list);
    const totalSWC = calculateListSWC(list);
    const pointsOver = totalPoints > list.pointsLimit;
    const swcOver = totalSWC > list.swcLimit;

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
        const data = active.data.current as { type?: string; listUnit?: ListUnit; groupIndex?: number; fireteamId?: string } | undefined;
        if (data?.type === 'unit' && data.listUnit) {
            setActiveUnit(data.listUnit);
        } else {
            setActiveUnit(null);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveUnit(null);

        if (!over || active.id === over.id) return;

        const activeData = active.data.current as any;
        const overData = over.data.current as any;

        if (!activeData) return;

        const fromGroupIndex = activeData.groupIndex;
        let toGroupIndex = fromGroupIndex;

        // CASE 1: Moving a Fireteam Container
        if (activeData.type === 'fireteam-container') {
            const fireteamId = activeData.fireteamId as string;
            let targetIndex = list.groups[toGroupIndex].fireteams?.length || 0;

            if (overData) {
                toGroupIndex = overData.groupIndex;
                if (overData.type === 'fireteam-container') {
                    const overFtId = overData.fireteamId;
                    const overIndex = list.groups[toGroupIndex].fireteams?.findIndex(ft => ft.id === overFtId) ?? -1;
                    if (overIndex !== -1) {
                        targetIndex = overIndex;
                    }
                }
            }

            moveFireteam(
                fromGroupIndex,
                toGroupIndex,
                fireteamId,
                targetIndex
            );
            return;
        }

        // CASE 2: Moving a Unit
        if (activeData.type === 'unit') {
            let toIndex = -1; // -1 means append
            let targetFireteamId: string | null = null;
            let dropType: 'group' | 'fireteam' | 'unit' = 'unit';

            if (overData && overData.type === 'combat-group') {
                toGroupIndex = overData.groupIndex;
                toIndex = list.groups[toGroupIndex].units.length; // append to end
                dropType = 'group';
            } else if (overData && overData.type === 'fireteam-container') {
                toGroupIndex = overData.groupIndex;
                targetFireteamId = overData.fireteamId;
                toIndex = list.groups[toGroupIndex].units.length; // append to end for now
                dropType = 'fireteam';
            } else if (overData) {
                toGroupIndex = overData.groupIndex;
                // over a specific unit
                const targetGroup = list.groups[toGroupIndex];
                toIndex = targetGroup.units.findIndex(u => u.id === over.id);
                // If dropping on a unit inside a fireteam, inherit its fireteam
                const targetUnit = targetGroup.units[toIndex];
                if (targetUnit && targetUnit.fireteamId) {
                    targetFireteamId = targetUnit.fireteamId;
                }
            }

            // Move the unit in the list order
            if (fromGroupIndex === toGroupIndex) {
                if (toIndex !== -1) {
                    const group = list.groups[fromGroupIndex];
                    const fromIndex = group.units.findIndex(u => u.id === active.id);
                    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
                        reorderUnit(fromGroupIndex, fromIndex, toIndex);
                    }
                }
            } else {
                moveUnitToGroup(
                    fromGroupIndex,
                    toGroupIndex,
                    active.id as string,
                    toIndex === -1 ? list.groups[toGroupIndex].units.length : toIndex
                );
            }

            // Assign fireteam state for the unit
            if (dropType === 'fireteam' && targetFireteamId) {
                assignToFireteam(toGroupIndex, [active.id as string], targetFireteamId, overData?.color || '', overData?.notes || '');
            } else if (dropType === 'group' || (dropType === 'unit' && !targetFireteamId)) {
                // If dropped into the generic group area or onto a standalone unit, remove from fireteam
                if (activeData.listUnit?.fireteamId) {
                    removeFromFireteam(toGroupIndex, [active.id as string]);
                }
            } else if (targetFireteamId && targetFireteamId !== activeData.listUnit?.fireteamId) {
                // Dropped onto a unit in a different fireteam
                const ftDef = list.groups[toGroupIndex].fireteams?.find(f => f.id === targetFireteamId);
                if (ftDef) {
                    assignToFireteam(toGroupIndex, [active.id as string], targetFireteamId, ftDef.color, ftDef.notes || '');
                } else if (overData?.listUnit) {
                    assignToFireteam(toGroupIndex, [active.id as string], targetFireteamId, overData.listUnit.fireteamColor || '', overData.listUnit.fireteamNotes || '');
                }
            }
        }
    };



    return (
        <div className="list-dashboard-dense">
            {/* Left Column - Unit Roster */}
            <ListSearchPanel
                list={list}
                onAddUnit={(unit, pgId, pId, oId) => addUnit(unit, targetGroupIndex, pgId, pId, oId)}
                onViewUnit={onViewUnit}
                validISCsForHoveredFireteam={validISCsForHoveredFireteam}
                onUnitHover={setHoveredUnitISC}
            />

            {/* Right Column - Army List Table */}
            <div className="list-panel">
                {/* Summary Bar */}
                <div className="summary-bar">
                    <div className={`stat ${pointsOver ? 'over' : ''}`}>
                        <span className="label">Points</span>
                        <span className="value">{totalPoints} / {list.pointsLimit}</span>
                    </div>
                    <div className={`stat ${swcOver ? 'over' : ''}`}>
                        <span className="label">SWC</span>
                        <span className="value">{totalSWC.toFixed(1)} / {list.swcLimit}</span>
                    </div>
                    <div className="stat">
                        <span className="label flex items-center gap-1"><Users size={12} /> Units</span>
                        <span className="value">{list.groups.reduce((t, g) => t + g.units.length, 0)}</span>
                    </div>
                    {db.getFireteamChart(list.factionId)?.spec && Object.entries(db.getFireteamChart(list.factionId)!.spec).map(([type, limit]) => {
                        if (limit >= 256) return null; // Don't show unlimited like DUO usually is
                        const count = fireteamCounts[type] || 0;
                        return (
                            <div key={type} className={`stat ${count > limit ? 'text-red-400 border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded' : ''}`}>
                                <span className="label text-gray-400 uppercase text-[10px]">{type} LIMIT</span>
                                <span className="value">{count} / {limit}</span>
                            </div>
                        );
                    })}
                </div>

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="combat-groups-container">
                        {/* Combat Groups */}
                        {list.groups.map((group, groupIndex) => {
                            const groupOrders = countGroupOrders(
                                group.units.map(lu => {
                                    const { profile, option } = getUnitDetails(lu.unit, lu.profileGroupId, lu.profileId, lu.optionId);
                                    return { profile, option };
                                })
                            );

                            return (
                                <DroppableCombatGroup key={group.id} groupIndex={groupIndex} isTarget={targetGroupIndex === groupIndex}>
                                    <div className="group-header">
                                        <div className="group-info">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-3">
                                                    <span className="group-name">{group.name}</span>
                                                    <span className="group-count">{group.units.length} units</span>
                                                </div>
                                                <div className="flex gap-2.5 mt-1.5">
                                                    {groupOrders['regular'] > 0 && <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-300"><OrderIcon type="regular" size={12} /> {groupOrders['regular']}</span>}
                                                    {groupOrders['irregular'] > 0 && <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-300"><OrderIcon type="irregular" size={12} /> {groupOrders['irregular']}</span>}
                                                    {groupOrders['impetuous'] > 0 && <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-300"><OrderIcon type="impetuous" size={12} /> {groupOrders['impetuous']}</span>}
                                                    {groupOrders['lieutenant'] > 0 && <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-300"><OrderIcon type="lieutenant" size={12} /> {groupOrders['lieutenant']}</span>}
                                                    {groupOrders['tactical-awareness'] > 0 && <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-300"><OrderIcon type="tactical-awareness" size={12} /> {groupOrders['tactical-awareness']}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="group-actions self-start">
                                            <div className="flex items-center">
                                                <button
                                                    className="target-btn group-ft-btn mr-1"
                                                    title="Add a fireteam container"
                                                    onClick={() => {
                                                        const id = `ft-${Date.now()}`;
                                                        const hue = Math.floor(Math.random() * 360);
                                                        const color = `hsl(${hue}, 80%, 65%)`;
                                                        addFireteamDef(groupIndex, id, color, '');
                                                    }}
                                                >
                                                    <Users size={12} className="inline mr-1" /> Add Fireteam
                                                </button>
                                            </div>
                                            <button
                                                className={`target-btn ${targetGroupIndex === groupIndex ? 'active' : ''}`}
                                                title="Select as target for added units"
                                                onClick={() => setTargetGroupIndex(groupIndex)}
                                            >
                                                {targetGroupIndex === groupIndex ? 'Targeted' : 'Set Target'}
                                            </button>
                                            {list.groups.length > 1 && (
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => removeCombatGroup(groupIndex)}
                                                    title="Remove Combat Group"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {group.units.length === 0 && (!group.fireteams || group.fireteams.length === 0) ? (
                                        <div className="empty-group">
                                            Click a unit from the roster to add it here
                                        </div>
                                    ) : (
                                        <div className="units-table relative">

                                            <div className="units-thead flex items-center">
                                                <div className="col-drag"></div>
                                                <div className="col-orders text-center">Ord</div>
                                                <div className="col-name">Name</div>
                                                <div className="col-weapons">Weapons / Equipment</div>
                                                <div className="col-swc text-right">SWC</div>
                                                <div className="col-pts text-right">Pts</div>
                                                <div className="col-actions"></div>
                                            </div>
                                            <div className="units-tbody">
                                                {(() => {
                                                    const fireteamItems: { ft: any, members: ListUnit[] }[] = [];
                                                    const seenFireteams = new Set<string>();

                                                    // Map explicitly defined fireteams
                                                    const fireteamDefs = group.fireteams || [];
                                                    fireteamDefs.forEach(ft => {
                                                        const members = group.units.filter(u => u.fireteamId === ft.id);
                                                        fireteamItems.push({ ft, members });
                                                        seenFireteams.add(ft.id);
                                                    });

                                                    // Then map implicit fireteams for backwards compatibility
                                                    group.units.forEach(u => {
                                                        if (u.fireteamId) {
                                                            if (!seenFireteams.has(u.fireteamId)) {
                                                                seenFireteams.add(u.fireteamId);
                                                                fireteamItems.push({
                                                                    ft: { id: u.fireteamId, color: u.fireteamColor || '#3b82f6', notes: u.fireteamNotes },
                                                                    members: group.units.filter(member => member.fireteamId === u.fireteamId)
                                                                });
                                                            }
                                                        }
                                                    });

                                                    const unboundUnits = group.units.filter(u => !u.fireteamId);

                                                    return (
                                                        <>
                                                            <SortableContext items={fireteamItems.map(f => `fireteam-${f.ft.id}`)} strategy={verticalListSortingStrategy}>
                                                                {fireteamItems.map(item => (
                                                                    <div
                                                                        key={item.ft.id}
                                                                        onMouseEnter={() => setHoveredFireteamId(item.ft.id)}
                                                                        onMouseLeave={() => setHoveredFireteamId(null)}
                                                                    >
                                                                        <SortableFireteamContainer
                                                                            groupIndex={groupIndex}
                                                                            fireteamId={item.ft.id}
                                                                            color={item.ft.color}
                                                                            notes={item.ft.notes}
                                                                            selectedTeamName={item.ft.selectedTeamName}
                                                                            selectedTeamType={item.ft.selectedTeamType}
                                                                            isHighlighted={validFireteamIdsForHoveredUnit.has(item.ft.id)}
                                                                            listUnits={item.members}
                                                                            factionId={list.factionId}
                                                                            onRemove={() => removeFireteamDef(groupIndex, item.ft.id)}
                                                                        >
                                                                            <SortableContext items={item.members.map(u => u.id)} strategy={verticalListSortingStrategy}>
                                                                                {item.members.map((u: ListUnit) => (
                                                                                    <DraggableUnitRow
                                                                                        key={u.id}
                                                                                        listUnit={u}
                                                                                        groupIndex={groupIndex}
                                                                                        onViewUnit={onViewUnit}
                                                                                        onRemove={() => removeUnit(groupIndex, u.id)}
                                                                                        db={db}
                                                                                    />
                                                                                ))}
                                                                            </SortableContext>
                                                                        </SortableFireteamContainer>
                                                                    </div>
                                                                ))}
                                                            </SortableContext>

                                                            <SortableContext items={unboundUnits.map(u => u.id)} strategy={verticalListSortingStrategy}>
                                                                {unboundUnits.map(u => (
                                                                    <DraggableUnitRow
                                                                        key={u.id}
                                                                        listUnit={u}
                                                                        groupIndex={groupIndex}
                                                                        onViewUnit={onViewUnit}
                                                                        onRemove={() => removeUnit(groupIndex, u.id)}
                                                                        db={db}
                                                                    />
                                                                ))}
                                                            </SortableContext>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </DroppableCombatGroup>
                            );
                        })}
                    </div>

                    <DragOverlay>
                        {activeId && activeUnit ? (
                            <DragOverlayUnit listUnit={activeUnit} />
                        ) : null}
                    </DragOverlay>
                </DndContext>

                {list.groups.length < 2 && (
                    <button className="add-group-btn" onClick={addCombatGroup}>
                        <Plus size={16} />
                        Add Combat Group
                    </button>
                )}
            </div>
        </div>
    );
}
