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
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { getColumnPanels } from '../../types/workspace';
import { useArmyListImportExport } from '../../hooks/useArmyListImportExport';
import { useAuth } from '../../hooks/useAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { calculateListPoints, calculateListSWC, getUnitDetails, type ListUnit, type FireteamDef } from '@shared/listTypes';
import { Plus, Trash2, Users, Copy, Check, CloudUpload, CloudCheck } from 'lucide-react';
import { ArmyLogo } from '../shared/ArmyLogo';
import { getPossibleFireteams } from '@shared/fireteams';
import type { Unit } from '@shared/types';
import { OrderIcon } from '../shared/OrderIcon';
import { countGroupOrders } from '../../utils/orderUtils';
import { SortableFireteamContainer } from '../ListBuilder/SortableFireteamContainer';
import { DraggableUnitRow } from '../ListBuilder/DraggableUnitRow';
import { DragOverlayUnit } from '../ListBuilder/DragOverlayUnit';
import { CompactFactionSelector } from '../shared/CompactFactionSelector';
import { clsx } from 'clsx';
import styles from '../ListBuilder/ListDashboard.module.css';

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
            className={clsx(styles.combatGroup, isTarget && styles.isTarget, isOver && styles.isDragOver)}
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
        addFireteamDef, removeFireteamDef, moveFireteam, resetList, updatePointsLimit, setServerId,
        updateListName, updateTags,
    } = useListStore();

    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState('');
    const [editingTags, setEditingTags] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const { globalFactionId, setGlobalFactionId } = useGlobalFactionStore();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const saveListMutation = useMutation({
        mutationFn: async () => {
            if (!currentList) return null;
            const body = {
                name: currentList.name,
                description: currentList.description ?? null,
                tags: currentList.tags ?? [],
                rating: currentList.rating ?? 0,
                faction_id: currentList.factionId,
                points: calculateListPoints(currentList),
                swc: calculateListSWC(currentList),
                units_json: currentList as unknown as Record<string, unknown>,
            };
            if (currentList.serverId) {
                const { data, error } = await api.PUT('/api/lists/{listId}', {
                    params: { path: { listId: String(currentList.serverId) } },
                    body,
                });
                if (error) throw error;
                return data;
            } else {
                const { data, error } = await api.POST('/api/lists', { body });
                if (error) throw error;
                return data;
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['my-lists'] });
            if (data && !currentList?.serverId) setServerId(data.id);
        },
    });

    const {
        hoveredUnitISC, targetGroupIndex,
        setHoveredFireteamId, setTargetGroupIndex, selectUnitForDetail,
        setRosterScrollTarget,
    } = useListBuilderUIStore();

    const { layoutMode, columnCount, windows, openWindow, setActiveColumn } = useWorkspaceStore();

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
                        const possible = getPossibleFireteams({ teams: [activeTeamDef], spec: chart.spec }, testMembers);
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

    const handleViewUnit = (unit: Unit, profileGroupId?: number, optionId?: number, _listUnitId?: string) => {
        selectUnitForDetail(unit, profileGroupId, optionId);

        if (layoutMode === 'columns') {
            const panels = getColumnPanels(columnCount ?? 3);
            const detailIdx = panels.indexOf('UNIT_DETAIL');
            if (detailIdx === -1) {
                // 2-column mode: scroll and expand unit in the roster instead of floating window
                setRosterScrollTarget({ unitId: unit.id, optionId });
            } else if (window.innerWidth < 768) {
                // Mobile: swipe to the UNIT_DETAIL column
                setActiveColumn(detailIdx);
            }
        } else {
            // multi-window / tabbed: open if not already visible
            const isVisible = windows.some(w => w.type === 'UNIT_DETAIL' && !w.isMinimized);
            if (!isVisible) openWindow('UNIT_DETAIL');
        }
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

        type DndData = {
            type?: string;
            groupIndex: number;
            fireteamId?: string;
            listUnit?: ListUnit;
            color?: string;
            notes?: string;
        };
        const activeData = active.data.current as DndData | undefined;
        const overData = over.data.current as DndData | undefined;

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
                targetFireteamId = overData.fireteamId ?? null;
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
    const totalLt = list.groups.reduce((sum, g) => sum + countGroupOrders(g.units.map(lu => {
        const { profile, option } = getUnitDetails(lu.unit, lu.profileGroupId, lu.profileId, lu.optionId);
        return { profile, option };
    })).lieutenant, 0);
    const ltInvalid = totalLt !== 1;

    return (
        <div className={styles.listPanel} style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                    {editingName ? (
                        <input
                            autoFocus
                            value={nameValue}
                            onChange={e => setNameValue(e.target.value)}
                            onBlur={() => { if (nameValue.trim()) updateListName(nameValue.trim()); setEditingName(false); }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') { if (nameValue.trim()) updateListName(nameValue.trim()); setEditingName(false); }
                                if (e.key === 'Escape') setEditingName(false);
                            }}
                            style={{ background: 'var(--bg-primary)', border: '1px solid var(--accent)', color: 'var(--text-primary)', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.85rem', fontWeight: 700, width: '100%', minWidth: 0 }}
                        />
                    ) : (
                        <span
                            title="Click to rename"
                            onClick={() => { setNameValue(list.name); setEditingName(true); }}
                            style={{
                                fontFamily: "'Oxanium', sans-serif",
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                cursor: 'text',
                            }}
                        >{list.name}</span>
                    )}
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
                        flexShrink: 0,
                    }}>{db.getFactionName(list.factionId)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    <select
                        className={styles.pointsDropdownInline}
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
                    {user && (
                        <button
                            className={styles.codeButton}
                            onClick={() => saveListMutation.mutate()}
                            disabled={saveListMutation.isPending}
                            title="Save to My Lists"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                        >
                            {saveListMutation.isSuccess && !saveListMutation.isPending
                                ? <CloudCheck size={14} />
                                : <CloudUpload size={14} className={saveListMutation.isPending ? 'animate-pulse' : ''} />}
                        </button>
                    )}
                    <button className={styles.codeButton} onClick={handleOpenInArmy} title="Open in Infinity Army" style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: '#F29107', borderColor: 'rgba(242,145,7,0.35)', background: 'rgba(242,145,7,0.1)' }}>
                        <ArmyLogo size={14} backdrop />
                    </button>
                    <button className={styles.codeButton} onClick={handleCopyCode} style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}>
                        {codeCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button className={styles.resetButton} onClick={resetList} style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}>
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Tags row */}
            <div style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.75rem', borderBottom: '1px solid var(--border, #1e293b)', minHeight: '30px' }}>
                {(list.tags ?? []).map(tag => (
                    <span
                        key={tag}
                        onClick={() => updateTags((list.tags ?? []).filter(t => t !== tag))}
                        title="Click to remove"
                        style={{ padding: '0.1rem 0.5rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 500, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', cursor: 'pointer' }}
                    >
                        #{tag}
                    </span>
                ))}
                {editingTags ? (
                    <input
                        autoFocus
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onBlur={() => { updateTags(tagInput.split(',').map(t => t.trim()).filter(Boolean)); setEditingTags(false); }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { updateTags(tagInput.split(',').map(t => t.trim()).filter(Boolean)); setEditingTags(false); }
                            if (e.key === 'Escape') setEditingTags(false);
                        }}
                        placeholder="tag1, tag2, …"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--accent)', color: 'var(--text-primary)', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', width: '110px' }}
                    />
                ) : (
                    <button
                        onClick={() => { setTagInput((list.tags ?? []).join(', ')); setEditingTags(true); }}
                        style={{ padding: '0.1rem 0.5rem', borderRadius: '20px', fontSize: '0.7rem', border: '1px dashed var(--border, #334155)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                        + tag
                    </button>
                )}
            </div>

            {/* Summary Bar */}
            <div className={styles.summaryBar} style={{ flexShrink: 0 }}>
                <div className={clsx(styles.stat, pointsOver && styles.over)}>
                    <span className={styles.label}>Points</span>
                    <span className={styles.value}>{totalPoints} / {list.pointsLimit}</span>
                </div>
                <div className={clsx(styles.stat, swcOver && styles.over)}>
                    <span className={styles.label}>SWC</span>
                    <span className={styles.value}>{totalSWC.toFixed(1)} / {list.swcLimit}</span>
                </div>
                <div className={styles.stat}>
                    <span className={clsx(styles.label, 'flex items-center gap-1')}><Users size={12} /> Units</span>
                    <span className={styles.value}>{list.groups.reduce((t, g) => t + g.units.length, 0)}</span>
                </div>
                <div className={clsx(styles.stat, ltInvalid && styles.over)}>
                    <span className={clsx(styles.label, 'flex items-center gap-1')}><OrderIcon type="lieutenant" size={12} /> LT</span>
                    <span className={styles.value}>{totalLt} / 1</span>
                </div>
                {db.getFireteamChart(list.factionId)?.spec && Object.entries(db.getFireteamChart(list.factionId)!.spec).map(([type, limit]) => {
                    if (limit >= 256) return null;
                    const count = fireteamCounts[type] || 0;
                    return (
                        <div key={type} className={clsx(styles.stat, count > limit && 'text-red-400 border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded')}>
                            <span className={clsx(styles.label, 'text-gray-400 uppercase text-[10px]')}>{type} LIMIT</span>
                            <span className={styles.value}>{count} / {limit}</span>
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
                    <div className={styles.combatGroupsContainer}>
                        {list.groups.map((group, groupIndex) => {
                            const groupOrders = countGroupOrders(
                                group.units.map(lu => {
                                    const { profile, option } = getUnitDetails(lu.unit, lu.profileGroupId, lu.profileId, lu.optionId);
                                    return { profile, option };
                                })
                            );

                            return (
                                <DroppableCombatGroup key={group.id} groupIndex={groupIndex} isTarget={targetGroupIndex === groupIndex}>
                                    <div className={styles.groupHeader}>
                                        <div className={styles.groupInfo}>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-3">
                                                    <span className={styles.groupName}>{group.name}</span>
                                                    <span className={styles.groupCount}>{group.units.filter(u => !u.isPeripheral).length} units</span>
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
                                        <div className={clsx(styles.groupActions, 'self-start')}>
                                            <div className="flex items-center">
                                                <button
                                                    className={clsx(styles.targetBtn, 'mr-1')}
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
                                                className={clsx(styles.targetBtn, targetGroupIndex === groupIndex && styles.active)}
                                                title="Select as target for added units"
                                                onClick={() => setTargetGroupIndex(groupIndex)}
                                            >
                                                {targetGroupIndex === groupIndex ? 'Targeted' : 'Set Target'}
                                            </button>
                                            {list.groups.length > 1 && (
                                                <button
                                                    className={styles.deleteBtn}
                                                    onClick={() => removeCombatGroup(groupIndex)}
                                                    title="Remove Combat Group"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {group.units.length === 0 && (!group.fireteams || group.fireteams.length === 0) ? (
                                        <div className={styles.emptyGroup}>
                                            Click a unit from the roster to add it here
                                        </div>
                                    ) : (
                                        <div className={clsx(styles.unitsTable, 'relative')}>
                                            <div className={clsx(styles.unitsThead, 'flex items-center')}>
                                                <div className={styles.colDrag}></div>
                                                <div className={clsx(styles.colOrders, 'text-center')}>Ord</div>
                                                <div className={styles.colName}>Name</div>
                                                <div className={styles.colWeapons}>Weapons / Equipment</div>
                                                <div className={clsx(styles.colSwc, 'text-right')}>SWC</div>
                                                <div className={clsx(styles.colPts, 'text-right')}>Pts</div>
                                                <div className={styles.colActions}></div>
                                            </div>
                                            <div>
                                                {(() => {
                                                    const fireteamItems: { ft: FireteamDef, members: ListUnit[] }[] = [];
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
                                                            />
                                                            {peripheralsMap.get(u.id)?.map(p => (
                                                                <DraggableUnitRow
                                                                    key={p.id}
                                                                    listUnit={p}
                                                                    groupIndex={groupIndex}
                                                                    onViewUnit={() => handleViewUnit(u.unit, u.profileGroupId, u.optionId, u.id)}
                                                                    onRemove={() => {}}
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
                    <button className={styles.addGroupBtn} onClick={addCombatGroup}>
                        <Plus size={16} />
                        Add Combat Group
                    </button>
                )}
            </div>
        </div>
    );
}
