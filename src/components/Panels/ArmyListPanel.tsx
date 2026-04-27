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
import { useListBuilderUIStore } from '../../stores/useListBuilderUIStore';
import { useGlobalFactionStore } from '../../stores/useGlobalFactionStore';
import { useArmyListImportExport } from '../../hooks/useArmyListImportExport';
import { calculateListPoints, calculateListSWC, getUnitDetails, type ListUnit } from '@shared/listTypes';
import { Plus, Trash2, Users, Copy, Check, ExternalLink } from 'lucide-react';
import { getPossibleFireteams } from '@shared/fireteams';
import type { Unit } from '@shared/types';
import { OrderIcon } from '../shared/OrderIcon';
import { countGroupOrders } from '../../utils/orderUtils';
import { SortableFireteamContainer } from '../ListBuilder/SortableFireteamContainer';
import { DraggableUnitRow } from '../ListBuilder/DraggableUnitRow';
import { DragOverlayUnit } from '../ListBuilder/DragOverlayUnit';
import { CompactFactionSelector } from '../shared/CompactFactionSelector';
import '../ListBuilder/ListDashboard.css';

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

export function ArmyListPanel() {
    const db = useDatabase();
    const currentList = useListStore(s => s.currentList);
    const {
        createList, addUnit, removeUnit, addCombatGroup, removeCombatGroup,
        reorderUnit, moveUnitToGroup, assignToFireteam, removeFromFireteam,
        addFireteamDef, removeFireteamDef, moveFireteam, resetList, updatePointsLimit,
    } = useListStore();
    const { globalFactionId, setGlobalFactionId } = useGlobalFactionStore();

    const {
        hoveredUnitISC, targetGroupIndex,
        setHoveredFireteamId, setTargetGroupIndex, selectUnitForDetail,
    } = useListBuilderUIStore();

    const {
        codeCopied, importCode, importError, setImportCode,
        handleImportCode, handleCopyCode, handleOpenInArmy,
    } = useArmyListImportExport({ db, currentList, createList, setGlobalFactionId, addCombatGroup, addUnit });

    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeUnit, setActiveUnit] = useState<ListUnit | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Fireteam validity for hovered unit (from roster)
    const validFireteamIdsForHoveredUnit = useMemo(() => {
        if (!hoveredUnitISC || !currentList) return new Set<string>();
        const chart = db.getFireteamChart(currentList.factionId);
        if (!chart) return new Set<string>();

        const validIds = new Set<string>();
        for (const g of currentList.groups) {
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
    }, [hoveredUnitISC, currentList, db]);

    const fireteamCounts = useMemo(() => {
        if (!currentList) return {} as Record<string, number>;
        const counts: Record<string, number> = {};
        const chart = db.getFireteamChart(currentList.factionId);
        if (!chart) return counts;

        for (const g of currentList.groups) {
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
    }, [currentList, db]);

    const handleViewUnit = (unit: Unit) => {
        selectUnitForDetail(unit);
    };

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

        if (!over || active.id === over.id || !currentList) return;

        const activeData = active.data.current as any;
        const overData = over.data.current as any;

        if (!activeData) return;

        const fromGroupIndex = activeData.groupIndex;
        let toGroupIndex = fromGroupIndex;

        // CASE 1: Moving a Fireteam Container
        if (activeData.type === 'fireteam-container') {
            const fireteamId = activeData.fireteamId as string;
            let targetIndex = currentList.groups[toGroupIndex].fireteams?.length || 0;

            if (overData) {
                toGroupIndex = overData.groupIndex;
                if (overData.type === 'fireteam-container') {
                    const overFtId = overData.fireteamId;
                    const overIndex = currentList.groups[toGroupIndex].fireteams?.findIndex(ft => ft.id === overFtId) ?? -1;
                    if (overIndex !== -1) {
                        targetIndex = overIndex;
                    }
                }
            }

            moveFireteam(fromGroupIndex, toGroupIndex, fireteamId, targetIndex);
            return;
        }

        // CASE 2: Moving a Unit
        if (activeData.type === 'unit') {
            let toIndex = -1;
            let targetFireteamId: string | null = null;
            let dropType: 'group' | 'fireteam' | 'unit' = 'unit';

            if (overData && overData.type === 'combat-group') {
                toGroupIndex = overData.groupIndex;
                toIndex = currentList.groups[toGroupIndex].units.length;
                dropType = 'group';
            } else if (overData && overData.type === 'fireteam-container') {
                toGroupIndex = overData.groupIndex;
                targetFireteamId = overData.fireteamId;
                toIndex = currentList.groups[toGroupIndex].units.length;
                dropType = 'fireteam';
            } else if (overData) {
                toGroupIndex = overData.groupIndex;
                const targetGroup = currentList.groups[toGroupIndex];
                toIndex = targetGroup.units.findIndex(u => u.id === over.id);
                const targetUnit = targetGroup.units[toIndex];
                if (targetUnit && targetUnit.fireteamId) {
                    targetFireteamId = targetUnit.fireteamId;
                }
            }

            if (fromGroupIndex === toGroupIndex) {
                if (toIndex !== -1) {
                    const group = currentList.groups[fromGroupIndex];
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
                    toIndex === -1 ? currentList.groups[toGroupIndex].units.length : toIndex
                );
            }

            if (dropType === 'fireteam' && targetFireteamId) {
                assignToFireteam(toGroupIndex, [active.id as string], targetFireteamId, overData?.color || '', overData?.notes || '');
            } else if (dropType === 'group' || (dropType === 'unit' && !targetFireteamId)) {
                if (activeData.listUnit?.fireteamId) {
                    removeFromFireteam(toGroupIndex, [active.id as string]);
                }
            } else if (targetFireteamId && targetFireteamId !== activeData.listUnit?.fireteamId) {
                const ftDef = currentList.groups[toGroupIndex].fireteams?.find(f => f.id === targetFireteamId);
                if (ftDef) {
                    assignToFireteam(toGroupIndex, [active.id as string], targetFireteamId, ftDef.color, ftDef.notes || '');
                } else if (overData?.listUnit) {
                    assignToFireteam(toGroupIndex, [active.id as string], targetFireteamId, overData.listUnit.fireteamColor || '', overData.listUnit.fireteamNotes || '');
                }
            }
        }
    };

    // No list — show faction selection / import
    if (!currentList) {
        const groupedFactions = db.getGroupedFactions();

        const handleCreateList = () => {
            if (!globalFactionId) return;
            const factionName = db.getFactionName(globalFactionId);
            createList(globalFactionId, factionName, 300);
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '3rem', paddingBottom: '3rem', height: '100%', minHeight: '50vh', gap: '1.5rem', maxWidth: '600px', margin: '0 auto', padding: '1.5rem', overflowY: 'auto' }}>
                <div style={{ width: '100%', padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Create New Army List</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Select a faction to start building a new roster.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', width: '100%', alignItems: 'stretch' }}>
                        <div style={{ flex: 1 }}>
                            <CompactFactionSelector
                                groupedFactions={groupedFactions}
                                value={globalFactionId}
                                onChange={setGlobalFactionId}
                            />
                        </div>
                        <button
                            className="px-6 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-base flex items-center justify-center whitespace-nowrap"
                            onClick={handleCreateList}
                            disabled={!globalFactionId}
                        >
                            Create List
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '1rem' }}>
                    <hr style={{ flex: 1, borderColor: 'var(--border-color)', borderTop: 'none' }} />
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>OR</span>
                    <hr style={{ flex: 1, borderColor: 'var(--border-color)', borderTop: 'none' }} />
                </div>

                <div style={{ width: '100%', padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Import Existing List</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Paste an army code from the official Infinity builder.</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                        <textarea
                            value={importCode}
                            onChange={e => setImportCode(e.target.value)}
                            placeholder="Paste army code here..."
                            rows={3}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', resize: 'none' }}
                        />
                        {importError && <div style={{ color: 'var(--error-color)', fontSize: '0.85rem', textAlign: 'center' }}>{importError}</div>}
                        <button
                            className="px-6 py-3 bg-[#18181b] hover:bg-[#1f1f23] border border-[#ffffff14] text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-base w-full flex items-center justify-center whitespace-nowrap"
                            onClick={handleImportCode}
                            disabled={!importCode.trim()}
                        >
                            Import Code
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const list = currentList;
    const totalPoints = calculateListPoints(list);
    const totalSWC = calculateListSWC(list);
    const pointsOver = totalPoints > list.pointsLimit;
    const swcOver = totalSWC > list.swcLimit;

    return (
        <div className="list-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* List Header - compact single-line */}
            <div style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                background: 'var(--surface-elevated)',
                borderBottom: '1px solid var(--border-subtle)',
                minHeight: 0,
            }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{
                        fontFamily: "'Oxanium', sans-serif",
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>{list.name}</span>
                    <span style={{ color: '#475569', fontSize: '0.75rem', flexShrink: 0 }}>|</span>
                    <span style={{
                        color: 'var(--color-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>{db.getFactionName(list.factionId)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    <select
                        className="points-dropdown-inline"
                        value={list.pointsLimit}
                        onChange={e => updatePointsLimit(Number(e.target.value))}
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem', minWidth: 0 }}
                    >
                        <option value={150}>150</option>
                        <option value={200}>200</option>
                        <option value={250}>250</option>
                        <option value={300}>300</option>
                        <option value={400}>400</option>
                    </select>
                    <button className="code-button" onClick={handleOpenInArmy} title="Open in Infinity Army" style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}>
                        <ExternalLink size={14} />
                    </button>
                    <button className="code-button" onClick={handleCopyCode} style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}>
                        {codeCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button className="reset-button" onClick={resetList} style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}>
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Summary Bar */}
            <div className="summary-bar" style={{ flexShrink: 0 }}>
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
                    if (limit >= 256) return null;
                    const count = fireteamCounts[type] || 0;
                    return (
                        <div key={type} className={`stat ${count > limit ? 'text-red-400 border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded' : ''}`}>
                            <span className="label text-gray-400 uppercase text-[10px]">{type} LIMIT</span>
                            <span className="value">{count} / {limit}</span>
                        </div>
                    );
                })}
            </div>

            {/* Scrollable combat groups area */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="combat-groups-container">
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
                                                    <span className="group-count">{group.units.filter(u => !u.isPeripheral).length} units</span>
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

                                                    const fireteamDefs = group.fireteams || [];
                                                    fireteamDefs.forEach(ft => {
                                                        const members = group.units.filter(u => u.fireteamId === ft.id);
                                                        fireteamItems.push({ ft, members });
                                                        seenFireteams.add(ft.id);
                                                    });

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

                                                    const unboundUnits = group.units.filter(u => !u.fireteamId && !u.isPeripheral);
                                                    const peripheralsMap = new Map<string, ListUnit[]>();
                                                    for (const u of group.units) {
                                                        if (u.isPeripheral && u.parentId) {
                                                            if (!peripheralsMap.has(u.parentId)) peripheralsMap.set(u.parentId, []);
                                                            peripheralsMap.get(u.parentId)!.push(u);
                                                        }
                                                    }

                                                    const renderUnitWithPeripherals = (u: ListUnit) => (
                                                        <React.Fragment key={u.id}>
                                                            <DraggableUnitRow
                                                                listUnit={u}
                                                                groupIndex={groupIndex}
                                                                onViewUnit={handleViewUnit}
                                                                onRemove={() => removeUnit(groupIndex, u.id)}
                                                                db={db}
                                                            />
                                                            {peripheralsMap.get(u.id)?.map(p => (
                                                                <DraggableUnitRow
                                                                    key={p.id}
                                                                    listUnit={p}
                                                                    groupIndex={groupIndex}
                                                                    onViewUnit={handleViewUnit}
                                                                    onRemove={() => {}}
                                                                    db={db}
                                                                />
                                                            ))}
                                                        </React.Fragment>
                                                    );

                                                    return (
                                                        <>
                                                            <SortableContext items={fireteamItems.map(f => `fireteam-${f.ft.id}`)} strategy={verticalListSortingStrategy}>
                                                                {fireteamItems.map(item => {
                                                                    const nonPeripheralMembers = item.members.filter(u => !u.isPeripheral);
                                                                    return (
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
                                                                            listUnits={nonPeripheralMembers}
                                                                            factionId={list.factionId}
                                                                            onRemove={() => removeFireteamDef(groupIndex, item.ft.id)}
                                                                        >
                                                                            <SortableContext items={nonPeripheralMembers.map(u => u.id)} strategy={verticalListSortingStrategy}>
                                                                                {nonPeripheralMembers.map(u => renderUnitWithPeripherals(u))}
                                                                            </SortableContext>
                                                                        </SortableFireteamContainer>
                                                                    </div>
                                                                    );
                                                                })}
                                                            </SortableContext>

                                                            <SortableContext items={unboundUnits.map(u => u.id)} strategy={verticalListSortingStrategy}>
                                                                {unboundUnits.map(u => renderUnitWithPeripherals(u))}
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
