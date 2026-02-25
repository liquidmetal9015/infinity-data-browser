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
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDatabase } from '../../context/DatabaseContext';
import { useListStore } from '../../stores/useListStore';
import { useContextMenu } from '../../context/ContextMenuContext';
import { calculateListPoints, calculateListSWC, getUnitDetails, type ArmyList, type ListUnit } from '../../types/list';
import { Plus, Trash2, Eye, GripVertical, Settings2, Users } from 'lucide-react';
import type { Unit } from '../../types';
import { ExpandableUnitCard } from '../shared/ExpandableUnitCard';
import { OrderIcon } from '../shared/OrderIcon';
import { countGroupOrders, getProfileOrders } from '../../utils/orderUtils';
import { UnifiedSearchBar, type QueryState } from '../shared/UnifiedSearchBar';

interface ListDashboardProps {
    list: ArmyList;
    onViewUnit: (unit: Unit) => void;
}

// Draggable unit row component
function DraggableUnitRow({
    listUnit,
    groupIndex,
    onViewUnit,
    onRemove,
    db,
    isSelectable,
    isSelected,
    onSelect
}: {
    listUnit: ListUnit;
    groupIndex: number;
    onViewUnit: (unit: Unit) => void;
    onRemove: () => void;
    db: ReturnType<typeof useDatabase>;
    isSelectable?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
}) {
    const { showMenu } = useContextMenu();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: listUnit.id,
        data: { groupIndex, listUnit },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const profileGroup = listUnit.unit.raw.profileGroups.find(g => g.id === listUnit.profileGroupId);
    const { profile, option } = getUnitDetails(listUnit.unit, listUnit.profileGroupId, listUnit.profileId, listUnit.optionId);
    const orders = getProfileOrders(profile, option);

    const weapons = option?.weapons?.map(w => db.weaponMap.get(w.id) || 'Unknown').join(', ') || '—';
    const equipment = option?.equip?.map(e => db.equipmentMap.get(e.id) || 'Unknown').join(', ') || '';
    const displayName = profileGroup?.isco || listUnit.unit.isc;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...(isSelectable ? {} : attributes)}
            {...(isSelectable ? {} : listeners)}
            className={`unit-row ${isDragging ? 'dragging' : ''} ${isSelectable ? 'cursor-pointer hover:bg-blue-900/20' : 'cursor-grab active:cursor-grabbing'}`}
            onClick={isSelectable ? onSelect : undefined}
            onContextMenu={(e) => {
                e.preventDefault();
                if (isSelectable) return; // Don't show menu when forming fireteam
                showMenu(e.clientX, e.clientY, [
                    { label: 'View Attributes & Rules', action: () => onViewUnit(listUnit.unit), icon: <Eye size={14} /> },
                    { divider: true, action: () => { } },
                    { label: 'Remove Unit', action: onRemove, icon: <Trash2 size={14} />, destructive: true }
                ]);
            }}
        >
            <div className="drag-handle col-drag flex items-center justify-center">
                {isSelectable ? (
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={onSelect}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 cursor-pointer accent-blue-500"
                    />
                ) : (
                    <div className="text-gray-400 p-1">
                        <GripVertical size={14} />
                    </div>
                )}
            </div>
            <div className="unit-orders col-orders">
                <div className="flex items-center justify-center">
                    {orders.map((o, i) => <OrderIcon key={i} type={o} size={16} className={i > 0 ? "-ml-1.5" : ""} />)}
                </div>
            </div>
            <div className="unit-name col-name">
                <span className="name" title={displayName}>{displayName}</span>
            </div>
            <div className="unit-weapons col-weapons">
                <span className="weapons" title={weapons}>{weapons}</span>
                {equipment && <span className="equipment" title={equipment}>{equipment}</span>}
            </div>
            <div className="unit-swc col-swc">{option?.swc || 0}</div>
            <div className="unit-pts col-pts">{option?.points || 0}</div>
            <div className="unit-actions col-actions">
                <button
                    onClick={(e) => { e.stopPropagation(); onViewUnit(listUnit.unit); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="View unit"
                >
                    <Eye size={14} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Remove"
                    className="delete"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}

// Overlay component shown while dragging
function DragOverlayUnit({ listUnit }: { listUnit: ListUnit }) {
    const profileGroup = listUnit.unit.raw.profileGroups.find(g => g.id === listUnit.profileGroupId);
    const { option } = getUnitDetails(listUnit.unit, listUnit.profileGroupId, listUnit.profileId, listUnit.optionId);
    const displayName = profileGroup?.isco || listUnit.unit.isc;

    return (
        <div className="drag-overlay-unit">
            <GripVertical size={14} />
            <span className="name">{displayName}</span>
            <span className="pts">{option?.points || 0} pts</span>
        </div>
    );
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

// Droppable container for empty fireteams
function DroppableFireteamContainer({
    groupIndex,
    fireteamId,
    color,
    notes,
    children,
    onRemove
}: {
    groupIndex: number;
    fireteamId: string;
    color: string;
    notes?: string;
    children: React.ReactNode;
    onRemove: () => void;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `fireteam-${fireteamId}`,
        data: { type: 'fireteam', groupIndex, fireteamId, color, notes },
    });

    return (
        <div
            ref={setNodeRef}
            className={`fireteam-container mt-2 mb-2 rounded-md overflow-hidden transition-colors ${isOver ? 'ring-2 ring-blue-400 bg-white/10' : ''}`}
            style={{
                borderLeft: `4px solid ${color}`,
                backgroundColor: `${color}10`,
                borderTop: `1px solid ${color}30`,
                borderRight: `1px solid ${color}30`,
                borderBottom: `1px solid ${color}30`
            }}
        >
            <div className="flex items-center justify-between px-2.5 py-1.5 text-xs font-bold tracking-wider" style={{ backgroundColor: `${color}25`, color }}>
                <div className="flex items-center gap-1.5"><Users size={12} /> {notes ? `Fireteam - ${notes}` : 'Fireteam'}</div>
                <button onClick={onRemove} className="hover:text-red-400 p-1"><Trash2 size={12} /></button>
            </div>
            <div className="min-h-[30px] w-full">
                {children}
                {React.Children.count(children) === 0 && (
                    <div className="flex items-center justify-center py-2 text-xs text-white/30 italic">
                        Drag units here
                    </div>
                )}
            </div>
        </div>
    );
}

export function ListDashboard({ list, onViewUnit }: ListDashboardProps) {
    const db = useDatabase();
    const { addUnit, removeUnit, addCombatGroup, removeCombatGroup, reorderUnit, moveUnitToGroup, assignToFireteam, removeFromFireteam, addFireteamDef, removeFireteamDef } = useListStore();

    // Toggleable unit expanded states
    const [expandedUnitIds, setExpandedUnitIds] = useState<Set<number>>(new Set());
    const [expandMode, setExpandMode] = useState<'single' | 'multiple'>('single');

    const [targetGroupIndex, setTargetGroupIndex] = useState(0);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeUnit, setActiveUnit] = useState<ListUnit | null>(null);

    // Fireteam state
    const [formingFireteamGroupIndex, setFormingFireteamGroupIndex] = useState<number | null>(null);
    const [selectedUnitIdsForFireteam, setSelectedUnitIdsForFireteam] = useState<Set<string>>(new Set());
    const [fireteamNotes, setFireteamNotes] = useState<string>('');

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Search state for UnifiedSearchBar
    const [rosterQuery, setRosterQuery] = useState<QueryState>({ filters: [], operator: 'or' });
    const [rosterTextQuery, setRosterTextQuery] = useState('');

    // Get roster for this faction
    const factionUnits = useMemo(() => {
        return db.units.filter(unit => unit.factions.includes(list.factionId));
    }, [db.units, list.factionId]);

    // Filter roster by search (text + query filters)
    const filteredRoster = useMemo(() => {
        let results = factionUnits;

        // Apply item filters from UnifiedSearchBar
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

        // Apply text query
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

    const totalPoints = calculateListPoints(list);
    const totalSWC = calculateListSWC(list);
    const pointsOver = totalPoints > list.pointsLimit;
    const swcOver = totalSWC > list.swcLimit;

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

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        const data = event.active.data.current as { groupIndex: number; listUnit: ListUnit };
        setActiveUnit(data?.listUnit || null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveUnit(null);

        if (!over || active.id === over.id) return;

        const activeData = active.data.current as { groupIndex: number; listUnit: ListUnit };
        const overData = over.data.current;

        if (!activeData) return;

        const fromGroupIndex = activeData.groupIndex;
        let toGroupIndex = fromGroupIndex;
        let toIndex = -1; // -1 means append
        let targetFireteamId: string | null = null;
        let dropType: 'group' | 'fireteam' | 'unit' = 'unit';

        if (overData && overData.type === 'combat-group') {
            toGroupIndex = overData.groupIndex;
            toIndex = list.groups[toGroupIndex].units.length; // append to end
            dropType = 'group';
        } else if (overData && overData.type === 'fireteam') {
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

        if (fromGroupIndex === toGroupIndex) {
            // Reorder within same group
            if (toIndex !== -1) {
                const group = list.groups[fromGroupIndex];
                const fromIndex = group.units.findIndex(u => u.id === active.id);
                if (fromIndex !== -1 && toIndex !== -1) {
                    reorderUnit(fromGroupIndex, fromIndex, toIndex);
                }
            }
        } else {
            // Move to different group
            moveUnitToGroup(
                fromGroupIndex,
                toGroupIndex,
                active.id as string,
                toIndex === -1 ? list.groups[toGroupIndex].units.length : toIndex
            );
        }

        // Fireteam logic
        if (dropType === 'fireteam' && targetFireteamId) {
            assignToFireteam(toGroupIndex, [active.id as string], targetFireteamId, overData?.color || '', overData?.notes || '');
        } else if (dropType === 'group' || (dropType === 'unit' && !targetFireteamId)) {
            // If dropped into the generic group area or onto a standalone unit, remove from fireteam
            if (activeData.listUnit.fireteamId) {
                removeFromFireteam(toGroupIndex, [active.id as string]);
            }
        } else if (targetFireteamId && targetFireteamId !== activeData.listUnit.fireteamId) {
            // Dropped onto a unit in a different fireteam
            const ftDef = list.groups[toGroupIndex].fireteams?.find(f => f.id === targetFireteamId);
            if (ftDef) {
                assignToFireteam(toGroupIndex, [active.id as string], targetFireteamId, ftDef.color, ftDef.notes || '');
            } else if (overData?.listUnit) {
                assignToFireteam(toGroupIndex, [active.id as string], targetFireteamId, overData.listUnit.fireteamColor || '', overData.listUnit.fireteamNotes || '');
            }
        }
    };

    const handleSaveFireteam = () => {
        if (formingFireteamGroupIndex === null) return;

        const id = `ft-${Date.now()}`;
        // Generate a vibrant color for the fireteam
        const hue = Math.floor(Math.random() * 360);
        const color = `hsl(${hue}, 80%, 65%)`;

        addFireteamDef(formingFireteamGroupIndex, id, color, fireteamNotes);

        if (selectedUnitIdsForFireteam.size > 0) {
            assignToFireteam(
                formingFireteamGroupIndex,
                Array.from(selectedUnitIdsForFireteam),
                id,
                color,
                fireteamNotes
            );
        }

        setFormingFireteamGroupIndex(null);
        setSelectedUnitIdsForFireteam(new Set());
        setFireteamNotes('');
    };

    const toggleFireteamSelect = (unitId: string) => {
        setSelectedUnitIdsForFireteam(prev => {
            const next = new Set(prev);
            if (next.has(unitId)) {
                next.delete(unitId);
            } else {
                next.add(unitId);
            }
            return next;
        });
    };

    // Collect all unit IDs for sortable context
    const allUnitIds = list.groups.flatMap(g => g.units.map(u => u.id));

    return (
        <div className="list-dashboard-dense">
            {/* Left Column - Unit Roster */}
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
                            onAddUnit={(unit, pgId, pId, oId) => {
                                addUnit(unit, targetGroupIndex, pgId, pId, oId);
                            }}
                            onViewUnit={onViewUnit}
                        />
                    ))}
                </div>
            </div>

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
                        <span className="label">Units</span>
                        <span className="value">{list.groups.reduce((t, g) => t + g.units.length, 0)}</span>
                    </div>
                </div>

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={allUnitIds} strategy={verticalListSortingStrategy}>
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
                                                        setFormingFireteamGroupIndex(groupIndex);
                                                        setSelectedUnitIdsForFireteam(new Set());
                                                        setFireteamNotes('');
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

                                    {group.units.length === 0 ? (
                                        <div className="empty-group">
                                            Click a unit from the roster to add it here
                                        </div>
                                    ) : (
                                        <div className="units-table relative">
                                            {formingFireteamGroupIndex === groupIndex && (
                                                <div className="fireteam-creator-bar p-2.5 bg-blue-900/40 border-b border-blue-500/30 flex items-center justify-between z-10 sticky top-0 backdrop-blur-md">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm text-blue-300 font-bold flex items-center gap-1.5"><Users size={14} /> FORM FIRETEAM</span>
                                                        <span className="text-xs text-blue-200 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-500/20">{selectedUnitIdsForFireteam.size} units selected</span>
                                                        <input
                                                            type="text"
                                                            placeholder="Type (e.g. Core, Haris)"
                                                            value={fireteamNotes}
                                                            onChange={e => setFireteamNotes(e.target.value)}
                                                            className="ml-2 bg-black/40 border border-blue-500/40 focus:border-blue-400 focus:outline-none text-white text-xs px-2.5 py-1.5 rounded w-48 transition-colors"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => { setFormingFireteamGroupIndex(null); setSelectedUnitIdsForFireteam(new Set()); }} className="text-xs px-3 py-1.5 text-gray-300 bg-white/5 hover:bg-white/10 hover:text-white rounded border border-white/5 transition-colors">Cancel</button>
                                                        <button
                                                            onClick={handleSaveFireteam}
                                                            className="text-xs px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded font-bold transition-colors shadow-lg shadow-blue-500/20"
                                                        >
                                                            Create Team
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
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
                                                    const items: any[] = [];
                                                    const seenFireteams = new Set<string>();

                                                    // Map explicitly defined fireteams
                                                    const fireteamDefs = group.fireteams || [];
                                                    fireteamDefs.forEach(ft => {
                                                        const members = group.units.filter(u => u.fireteamId === ft.id);
                                                        items.push({
                                                            type: 'fireteam',
                                                            id: ft.id,
                                                            color: ft.color,
                                                            notes: ft.notes,
                                                            members
                                                        });
                                                        seenFireteams.add(ft.id);
                                                    });

                                                    // Then map unbound units and implicitly grouped units (for backwards compatibility)
                                                    group.units.forEach(u => {
                                                        if (u.fireteamId) {
                                                            if (!seenFireteams.has(u.fireteamId)) {
                                                                seenFireteams.add(u.fireteamId);
                                                                items.push({
                                                                    type: 'fireteam',
                                                                    id: u.fireteamId,
                                                                    color: u.fireteamColor || '#3b82f6',
                                                                    notes: u.fireteamNotes,
                                                                    members: group.units.filter(member => member.fireteamId === u.fireteamId)
                                                                });
                                                            }
                                                        } else {
                                                            items.push({ type: 'single', unit: u });
                                                        }
                                                    });

                                                    return items.map(item => {
                                                        if (item.type === 'single') {
                                                            return <DraggableUnitRow
                                                                key={item.unit.id}
                                                                listUnit={item.unit}
                                                                groupIndex={groupIndex}
                                                                onViewUnit={onViewUnit}
                                                                onRemove={() => removeUnit(groupIndex, item.unit.id)}
                                                                db={db}
                                                                isSelectable={formingFireteamGroupIndex === groupIndex}
                                                                isSelected={selectedUnitIdsForFireteam.has(item.unit.id)}
                                                                onSelect={() => toggleFireteamSelect(item.unit.id)}
                                                            />;
                                                        } else {
                                                            return (
                                                                <DroppableFireteamContainer
                                                                    key={item.id}
                                                                    groupIndex={groupIndex}
                                                                    fireteamId={item.id}
                                                                    color={item.color}
                                                                    notes={item.notes}
                                                                    onRemove={() => removeFireteamDef(groupIndex, item.id)}
                                                                >
                                                                    {item.members.map((u: ListUnit) => (
                                                                        <DraggableUnitRow
                                                                            key={u.id}
                                                                            listUnit={u}
                                                                            groupIndex={groupIndex}
                                                                            onViewUnit={onViewUnit}
                                                                            onRemove={() => removeUnit(groupIndex, u.id)}
                                                                            db={db}
                                                                            isSelectable={formingFireteamGroupIndex === groupIndex}
                                                                            isSelected={selectedUnitIdsForFireteam.has(u.id)}
                                                                            onSelect={() => toggleFireteamSelect(u.id)}
                                                                        />
                                                                    ))}
                                                                </DroppableFireteamContainer>
                                                            );
                                                        }
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </DroppableCombatGroup>
                            );
                        })}
                    </SortableContext>

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

            <style>{`
                .list-dashboard-dense {
                    display: grid;
                    grid-template-columns: 420px 1fr;
                    gap: 1rem;
                    min-height: 400px;
                    height: calc(100vh - 100px);
                }

                /* Roster Panel */
                .roster-panel {
                    background: #0d1117;
                    border: 1px solid #1e293b;
                    border-radius: 8px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    height: 100%;
                }

                .roster-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem 1rem;
                    background: #161b22;
                    border-bottom: 1px solid #1e293b;
                }
                .roster-header h3 {
                    margin: 0;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .roster-count {
                    font-size: 0.75rem;
                    color: #64748b;
                    background: #1e293b;
                    padding: 0.125rem 0.5rem;
                    border-radius: 4px;
                }

                .roster-search {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0.75rem;
                    background: #0d1117;
                    border-bottom: 1px solid #1e293b;
                    color: #64748b;
                }
                .roster-search input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: #f1f5f9;
                    font-size: 0.8rem;
                    outline: none;
                }

                .roster-list {
                    flex: 1;
                    overflow-y: auto;
                    scrollbar-width: thin;
                    scrollbar-color: #334155 transparent;
                }

                /* List Panel */
                .list-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    overflow-y: auto;
                    padding-right: 0.5rem;
                }

                .summary-bar {
                    display: flex;
                    gap: 1.5rem;
                    padding: 0.75rem 1rem;
                    background: #0d1117;
                    border: 1px solid #1e293b;
                    border-radius: 8px;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                .summary-bar .stat {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .summary-bar .label {
                    font-size: 0.7rem;
                    color: #64748b;
                    text-transform: uppercase;
                }
                .summary-bar .value {
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: #22c55e;
                }
                .summary-bar .stat.over .value {
                    color: #ef4444;
                }

                /* Combat Groups */
                .combat-group {
                    background: #0d1117;
                    border: 1px solid #1e293b;
                    border-radius: 8px;
                    overflow: hidden;
                    margin-bottom: 0.75rem;
                    transition: all 0.2s ease;
                }
                .combat-group.is-target {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 1px #3b82f6;
                }
                .combat-group.is-target .group-header {
                    background: linear-gradient(90deg, #1e3a8a 0%, #0d1117 100%);
                    border-bottom-color: #2563eb;
                }
                .combat-group.is-drag-over {
                    border-color: #10b981;
                    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.4);
                }

                .group-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem 1rem;
                    background: linear-gradient(90deg, #1a365d 0%, #0d1117 100%);
                    border-bottom: 1px solid #1e4a7d;
                    transition: all 0.2s ease;
                }
                .group-info {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .group-name {
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: #60a5fa;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .group-count {
                    font-size: 0.75rem;
                    color: #64748b;
                }
                .group-actions {
                    display: flex;
                    gap: 0.5rem;
                    align-items: center;
                }
                .group-actions button {
                    padding: 0.35rem;
                    background: transparent;
                    border: 1px solid transparent;
                    border-radius: 4px;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.1s;
                }
                .group-actions button:hover {
                    background: #1e293b;
                    color: #f1f5f9;
                }
                .target-btn {
                    font-size: 0.75rem;
                    font-weight: 600;
                    padding: 0.25rem 0.5rem !important;
                    background: rgba(59, 130, 246, 0.1) !important;
                    color: #60a5fa !important;
                    border: 1px solid rgba(59, 130, 246, 0.2) !important;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .target-btn:hover {
                    background: rgba(59, 130, 246, 0.2) !important;
                    border-color: rgba(59, 130, 246, 0.4) !important;
                    color: #93c5fd !important;
                }
                .target-btn.active {
                    background: #3b82f6 !important;
                    color: #ffffff !important;
                    border-color: #2563eb !important;
                    box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
                }
                .group-actions .delete-btn:hover {
                    background: rgba(127, 29, 29, 0.4);
                    color: #fca5a5;
                }

                .empty-group {
                    padding: 1.5rem;
                    text-align: center;
                    color: #475569;
                    font-size: 0.8rem;
                    font-style: italic;
                }

                /* Units Table styles adapted for Grid/Flex */
                .units-table {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                }
                .units-thead {
                    padding: 0.5rem;
                    font-size: 0.65rem;
                    font-weight: 600;
                    color: #475569;
                    text-transform: uppercase;
                    background: #161b22;
                    border-bottom: 1px solid #1e293b;
                }
                
                .col-drag { width: 30px; flex-shrink: 0; }
                .col-orders { width: 50px; flex-shrink: 0; display: flex; justify-content: center; }
                .col-name { width: 200px; flex-shrink: 0; }
                .col-weapons { flex: 1; min-width: 0; }
                .col-swc { width: 50px; flex-shrink: 0; text-align: right; }
                .col-pts { width: 50px; flex-shrink: 0; text-align: right; }
                .col-actions { width: 80px; flex-shrink: 0; display: flex; justify-content: flex-end; }

                .unit-row {
                    display: flex;
                    align-items: center;
                    padding: 0.5rem;
                    background: #0d1117;
                    border-bottom: 1px solid #1e293b;
                    transition: background 0.1s;
                }
                .unit-row:hover {
                    background: #1e293b;
                }
                .unit-row.dragging {
                    background: #1e3a5f;
                    opacity: 0.8 !important;
                }

                .drag-handle {
                    cursor: grab;
                    color: #475569;
                }
                .drag-handle:active {
                    cursor: grabbing;
                }

                .unit-name .name {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #e2e8f0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: block;
                }

                .unit-weapons {
                    font-size: 0.75rem;
                    color: #94a3b8;
                }
                .unit-weapons .weapons {
                    display: block;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .unit-weapons .equipment {
                    display: block;
                    color: #64748b;
                    font-style: italic;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .unit-swc {
                    font-size: 0.8rem;
                    color: #f59e0b;
                    font-weight: 500;
                }

                .unit-pts {
                    font-size: 0.9rem;
                    color: #3b82f6;
                    font-weight: 700;
                }

                .unit-actions {
                    display: flex;
                    gap: 0.25rem;
                    justify-content: flex-end;
                }
                .unit-actions button {
                    padding: 0.35rem;
                    background: transparent;
                    border: 1px solid transparent;
                    border-radius: 4px;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.1s;
                }
                .unit-actions button:hover {
                    background: #3b82f6;
                    color: #f1f5f9;
                }
                .unit-actions button.delete:hover {
                    background: #7f1d1d;
                    color: #fca5a5;
                }

                .add-group-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 0.75rem;
                    background: #0d1117;
                    border: 2px dashed #1e293b;
                    border-radius: 8px;
                    color: #64748b;
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .add-group-btn:hover {
                    border-color: #3b82f6;
                    color: #3b82f6;
                    background: rgba(59, 130, 246, 0.05);
                }

                /* Drag Overlay */
                .drag-overlay-unit {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.5rem 1rem;
                    background: #1e3a5f;
                    border: 1px solid #3b82f6;
                    border-radius: 4px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    color: #e2e8f0;
                }
                .drag-overlay-unit .name {
                    font-weight: 600;
                    font-size: 0.85rem;
                }
                .drag-overlay-unit .pts {
                    font-size: 0.75rem;
                    color: #3b82f6;
                }

                @media (max-width: 900px) {
                    .list-dashboard-dense {
                        grid-template-columns: 1fr;
                        height: auto;
                    }
                    .roster-panel {
                        position: static;
                        max-height: 400px;
                    }
                }
            `}</style>
        </div>
    );
}
