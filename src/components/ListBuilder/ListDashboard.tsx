import { useState, useMemo } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
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
import { useList } from '../../context/ListContext';
import { UnitStatsModal } from '../UnitStatsModal';
import { calculateListPoints, calculateListSWC, type ArmyList, type ListUnit } from '../../types/list';
import { Plus, Trash2, Eye, Search, GripVertical } from 'lucide-react';
import type { Unit } from '../../types';

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
}: {
    listUnit: ListUnit;
    groupIndex: number;
    onViewUnit: (unit: Unit) => void;
    onRemove: () => void;
    db: ReturnType<typeof useDatabase>;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: listUnit.id,
        data: { groupIndex, listUnit },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const option = listUnit.unit.raw.profileGroups
        .find(pg => pg.id === listUnit.profileGroupId)
        ?.options.find(o => o.id === listUnit.optionId);

    const weapons = option?.weapons?.map(w => db.weaponMap.get(w.id) || 'Unknown').join(', ') || '—';
    const equipment = option?.equip?.map(e => db.equipmentMap.get(e.id) || 'Unknown').join(', ') || '';

    return (
        <tr ref={setNodeRef} style={style} className={`unit-row ${isDragging ? 'dragging' : ''}`}>
            <td className="drag-handle" {...attributes} {...listeners}>
                <GripVertical size={14} />
            </td>
            <td className="unit-name">
                <span className="name">{listUnit.unit.isc}</span>
            </td>
            <td className="unit-weapons">
                <span className="weapons">{weapons}</span>
                {equipment && <span className="equipment">{equipment}</span>}
            </td>
            <td className="unit-swc">{option?.swc || 0}</td>
            <td className="unit-pts">{option?.points || 0}</td>
            <td className="unit-actions">
                <button onClick={() => onViewUnit(listUnit.unit)} title="View unit">
                    <Eye size={14} />
                </button>
                <button onClick={onRemove} title="Remove" className="delete">
                    <Trash2 size={14} />
                </button>
            </td>
        </tr>
    );
}

// Overlay component shown while dragging
function DragOverlayUnit({ listUnit }: { listUnit: ListUnit }) {
    const option = listUnit.unit.raw.profileGroups
        .find(pg => pg.id === listUnit.profileGroupId)
        ?.options.find(o => o.id === listUnit.optionId);

    return (
        <div className="drag-overlay-unit">
            <GripVertical size={14} />
            <span className="name">{listUnit.unit.isc}</span>
            <span className="pts">{option?.points || 0} pts</span>
        </div>
    );
}

export function ListDashboard({ list, onViewUnit }: ListDashboardProps) {
    const db = useDatabase();
    const { addUnit, removeUnit, addCombatGroup, removeCombatGroup, reorderUnit, moveUnitToGroup } = useList();
    const [showUnitSelector, setShowUnitSelector] = useState(false);
    const [targetGroupIndex, setTargetGroupIndex] = useState(0);
    const [rosterSearch, setRosterSearch] = useState('');
    const [preselectedUnit, setPreselectedUnit] = useState<Unit | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeUnit, setActiveUnit] = useState<ListUnit | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Get roster for this faction
    const factionUnits = useMemo(() => {
        return db.units.filter(unit => unit.factions.includes(list.factionId));
    }, [db.units, list.factionId]);

    // Filter roster by search
    const filteredRoster = useMemo(() => {
        if (!rosterSearch.trim()) return factionUnits;
        const q = rosterSearch.toLowerCase();
        return factionUnits.filter(unit =>
            unit.isc.toLowerCase().includes(q) ||
            unit.name.toLowerCase().includes(q)
        );
    }, [factionUnits, rosterSearch]);

    const totalPoints = calculateListPoints(list);
    const totalSWC = calculateListSWC(list);
    const pointsOver = totalPoints > list.pointsLimit;
    const swcOver = totalSWC > list.swcLimit;

    const handleAddFromRoster = (unit: Unit) => {
        // If unit has only one option, add directly
        if (unit.raw.profileGroups.length === 1 && unit.raw.profileGroups[0].options.length === 1) {
            const pg = unit.raw.profileGroups[0];
            addUnit(unit, targetGroupIndex, pg.id, pg.profiles[0].id, pg.options[0].id);
        } else {
            // Open modal for option selection
            setPreselectedUnit(unit);
            setShowUnitSelector(true);
        }
    };

    const handleSelectUnit = (unit: Unit, profileGroupId: number, profileId: number, optionId: number) => {
        addUnit(unit, targetGroupIndex, profileGroupId, profileId, optionId);
        setShowUnitSelector(false);
        setPreselectedUnit(null);
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
        const overData = over.data.current as { groupIndex: number; listUnit?: ListUnit };

        if (!activeData) return;

        const fromGroupIndex = activeData.groupIndex;
        const toGroupIndex = overData?.groupIndex ?? fromGroupIndex;

        if (fromGroupIndex === toGroupIndex) {
            // Reorder within same group
            const group = list.groups[fromGroupIndex];
            const fromIndex = group.units.findIndex(u => u.id === active.id);
            const toIndex = group.units.findIndex(u => u.id === over.id);
            if (fromIndex !== -1 && toIndex !== -1) {
                reorderUnit(fromGroupIndex, fromIndex, toIndex);
            }
        } else {
            // Move to different group
            const targetGroup = list.groups[toGroupIndex];
            const toIndex = overData?.listUnit
                ? targetGroup.units.findIndex(u => u.id === over.id)
                : targetGroup.units.length;
            moveUnitToGroup(fromGroupIndex, toGroupIndex, active.id as string, toIndex);
        }
    };

    // Collect all unit IDs for sortable context
    const allUnitIds = list.groups.flatMap(g => g.units.map(u => u.id));

    return (
        <div className="list-dashboard-dense">
            {/* Left Column - Unit Roster */}
            <div className="roster-panel">
                <div className="roster-header">
                    <h3>Unit Roster</h3>
                    <span className="roster-count">{factionUnits.length}</span>
                </div>

                <div className="roster-search">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search units..."
                        value={rosterSearch}
                        onChange={e => setRosterSearch(e.target.value)}
                    />
                </div>

                <div className="roster-list">
                    {filteredRoster.map(unit => {
                        const pointsRange = unit.pointsRange;
                        const pointsDisplay = pointsRange[0] === pointsRange[1]
                            ? `${pointsRange[0]}`
                            : `${pointsRange[0]}–${pointsRange[1]}`;

                        return (
                            <button
                                key={unit.id}
                                className="roster-item"
                                onClick={() => handleAddFromRoster(unit)}
                            >
                                <span className="name">{unit.isc}</span>
                                <span className="pts">{pointsDisplay}</span>
                            </button>
                        );
                    })}
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
                        {list.groups.map((group, groupIndex) => (
                            <div key={group.id} className="combat-group">
                                <div className="group-header">
                                    <div className="group-info">
                                        <span className="group-name">{group.name}</span>
                                        <span className="group-count">{group.units.length} units</span>
                                    </div>
                                    <div className="group-actions">
                                        <button
                                            className="add-btn"
                                            onClick={() => {
                                                setTargetGroupIndex(groupIndex);
                                                setPreselectedUnit(null);
                                            }}
                                        >
                                            <Plus size={14} />
                                        </button>
                                        {list.groups.length > 1 && (
                                            <button
                                                className="delete-btn"
                                                onClick={() => removeCombatGroup(groupIndex)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {group.units.length === 0 ? (
                                    <div className="empty-group">
                                        Click a unit from the roster to add it here
                                    </div>
                                ) : (
                                    <table className="units-table">
                                        <thead>
                                            <tr>
                                                <th className="col-drag"></th>
                                                <th className="col-name">Name</th>
                                                <th className="col-weapons">Weapons / Equipment</th>
                                                <th className="col-swc">SWC</th>
                                                <th className="col-pts">Pts</th>
                                                <th className="col-actions"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.units.map(listUnit => (
                                                <DraggableUnitRow
                                                    key={listUnit.id}
                                                    listUnit={listUnit}
                                                    groupIndex={groupIndex}
                                                    onViewUnit={onViewUnit}
                                                    onRemove={() => removeUnit(groupIndex, listUnit.id)}
                                                    db={db}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        ))}
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

            {/* Unit Selection Modal */}
            {showUnitSelector && preselectedUnit && (
                <UnitStatsModal
                    selectionMode={{
                        unit: preselectedUnit,
                        onSelectLoadout: (unit, profileGroupId, profileId, optionId) => {
                            handleSelectUnit(unit, profileGroupId, profileId, optionId);
                        },
                        onClose: () => {
                            setShowUnitSelector(false);
                            setPreselectedUnit(null);
                        }
                    }}
                />
            )}

            <style>{`
                .list-dashboard-dense {
                    display: grid;
                    grid-template-columns: 280px 1fr;
                    gap: 1rem;
                    min-height: calc(100vh - 200px);
                }

                /* Roster Panel */
                .roster-panel {
                    background: #0d1117;
                    border: 1px solid #1e293b;
                    border-radius: 8px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    height: fit-content;
                    max-height: calc(100vh - 200px);
                    position: sticky;
                    top: 1rem;
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
                    padding: 0.25rem;
                }

                .roster-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    background: transparent;
                    border: 1px solid transparent;
                    border-radius: 4px;
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.1s;
                    margin-bottom: 1px;
                }
                .roster-item:hover {
                    background: #1e293b;
                    border-color: #334155;
                }
                .roster-item .name {
                    font-size: 0.8rem;
                    color: #e2e8f0;
                    font-weight: 500;
                }
                .roster-item .pts {
                    font-size: 0.7rem;
                    color: #3b82f6;
                    font-weight: 600;
                }

                /* List Panel */
                .list-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .summary-bar {
                    display: flex;
                    gap: 1.5rem;
                    padding: 0.75rem 1rem;
                    background: #0d1117;
                    border: 1px solid #1e293b;
                    border-radius: 8px;
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
                }

                .group-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.5rem 0.75rem;
                    background: linear-gradient(90deg, #1a365d 0%, #0d1117 100%);
                    border-bottom: 1px solid #1e4a7d;
                }
                .group-info {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .group-name {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: #60a5fa;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .group-count {
                    font-size: 0.7rem;
                    color: #64748b;
                }
                .group-actions {
                    display: flex;
                    gap: 0.25rem;
                }
                .group-actions button {
                    padding: 0.25rem;
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
                .group-actions .delete-btn:hover {
                    background: #7f1d1d;
                    color: #fca5a5;
                }

                .empty-group {
                    padding: 1.5rem;
                    text-align: center;
                    color: #475569;
                    font-size: 0.8rem;
                    font-style: italic;
                }

                /* Units Table */
                .units-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }
                .units-table th,
                .units-table td {
                    padding: 0.375rem 0.5rem;
                    vertical-align: middle;
                    text-align: left;
                }
                .units-table th {
                    font-size: 0.65rem;
                    font-weight: 600;
                    color: #475569;
                    text-transform: uppercase;
                    background: #161b22;
                    border-bottom: 1px solid #1e293b;
                }
                .units-table th:nth-child(1),
                .units-table td:nth-child(1) { width: 30px; }
                .units-table th:nth-child(2),
                .units-table td:nth-child(2) { width: 180px; }
                .units-table th:nth-child(3),
                .units-table td:nth-child(3) { } /* weapons - auto */
                .units-table th:nth-child(4),
                .units-table td:nth-child(4) { width: 50px; text-align: right; }
                .units-table th:nth-child(5),
                .units-table td:nth-child(5) { width: 50px; text-align: right; }
                .units-table th:nth-child(6),
                .units-table td:nth-child(6) { width: 70px; }

                .unit-row {
                    background: #0d1117;
                    transition: background 0.1s;
                }
                .unit-row:nth-child(even) {
                    background: #0f1419;
                }
                .unit-row:hover {
                    background: #1e293b;
                }
                .unit-row.dragging {
                    background: #1e3a5f;
                }

                .unit-row td {
                    border-bottom: 1px solid #1e293b;
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
                    padding: 0.25rem;
                    background: transparent;
                    border: 1px solid transparent;
                    border-radius: 4px;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.1s;
                }
                .unit-actions button:hover {
                    background: #1e293b;
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
                    }
                    .roster-panel {
                        position: static;
                        max-height: 300px;
                    }
                }
            `}</style>
        </div>
    );
}
