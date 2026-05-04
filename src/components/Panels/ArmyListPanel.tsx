import React, { useState, useMemo, useRef, useEffect } from 'react';
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
import { listService, forkListLocally } from '../../services/listService';
import { calculateListPoints, calculateListSWC, getUnitDetails, type ListUnit, type FireteamDef } from '@shared/listTypes';
import { Plus, Trash2, Users, Lock, Unlock } from 'lucide-react';
import { getPossibleFireteams } from '@shared/fireteams';
import type { Unit } from '@shared/types';
import { OrderIcon } from '../shared/OrderIcon';
import { countGroupOrders } from '../../utils/orderUtils';
import { SortableFireteamContainer } from '../ListBuilder/SortableFireteamContainer';
import { DraggableUnitRow } from '../ListBuilder/DraggableUnitRow';
import { DragOverlayUnit } from '../ListBuilder/DragOverlayUnit';
import { StarRating } from '../MyLists/StarRating';
import { SaveStatusPill, DiscardButton, ListOverflowMenu } from '../ListBuilder/ListHeaderActions';
import { ListDetailsStrip } from '../ListBuilder/ListDetailsStrip';
import { getSafeLogo } from '../../utils/assets';
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
        updateListName, updateTags, updateNotes, updateRating, setLocked, loadList,
        lastSavedAt, isDirty, lastDirtyKind, recordSave,
    } = useListStore();

    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState('');
    const { setGlobalFactionId } = useGlobalFactionStore();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const saveListMutation = useMutation({
        mutationFn: async () => {
            if (!currentList) return null;
            if (currentList.serverId) {
                return listService.updateList(String(currentList.serverId), currentList);
            } else {
                return listService.createList(currentList, currentList.factionId);
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['my-lists'] });
            if (data && !currentList?.serverId) setServerId(Number(data.id));
            recordSave();
        },
    });

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!user || !currentList || !isDirty || saveListMutation.isPending) return;
        const delay = lastDirtyKind === 'metadata' ? 300 : 3500;
        saveTimerRef.current = setTimeout(() => saveListMutation.mutate(), delay);
        return () => {
            if (saveTimerRef.current !== null) {
                clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentList?.updatedAt, isDirty, lastDirtyKind, user, saveListMutation.isPending]);

    const {
        hoveredUnitISC, targetGroupIndex,
        setHoveredFireteamId, setTargetGroupIndex, selectUnitForDetail,
        setRosterScrollTarget,
        detailsExpanded, setDetailsExpanded,
    } = useListBuilderUIStore();

    const { layoutMode, columnCount, windows, openWindow, setActiveColumn } = useWorkspaceStore();

    const {
        codeCopied, handleCopyCode, handleOpenInArmy,
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
                    const activeTeamDef = chart.teams.find(t => t.name === ft.selectedTeamName && (!ft.selectedTeamType || (t.type as string[]).includes(ft.selectedTeamType)));
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
        selectUnitForDetail(unit, profileGroupId, optionId, currentList?.factionId ?? null);

        if (layoutMode === 'columns') {
            const panels = getColumnPanels(columnCount ?? 3);
            const detailIdx = panels.indexOf('UNIT_DETAIL');
            if (detailIdx === -1) {
                // 2-column mode: scroll and expand unit in the roster instead of floating window
                setRosterScrollTarget({ unitId: unit.id, optionId, profileGroupId });
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

    if (!currentList) return null;

    const list = currentList;
    const isLocked = !!list.isLocked;
    const totalPoints = calculateListPoints(list);
    const totalSWC = calculateListSWC(list);
    const pointsOver = totalPoints > list.pointsLimit;
    const swcOver = totalSWC > list.swcLimit;
    const totalLt = list.groups.reduce((sum, g) => sum + countGroupOrders(g.units.map(lu => {
        const { profile, option } = getUnitDetails(lu.unit, lu.profileGroupId, lu.profileId, lu.optionId);
        return { profile, option };
    })).lieutenant, 0);
    const ltInvalid = totalLt !== 1;

    const factionInfo = db.getFactionInfo(list.factionId);
    const factionLogo = factionInfo?.logo ? getSafeLogo(factionInfo.logo) : undefined;
    const factionName = db.getFactionName(list.factionId);

    const saveState: 'saving' | 'dirty' | 'saved' = saveListMutation.isPending
        ? 'saving'
        : isDirty ? 'dirty' : 'saved';

    const handleSaveAsNew = () => {
        const forked = forkListLocally(list);
        loadList(forked);
        if (user) {
            // Persist immediately so the new list lands on the server.
            // Use a short timeout to ensure the loaded list has propagated through the store.
            setTimeout(() => saveListMutation.mutate(), 0);
        }
        queryClient.invalidateQueries({ queryKey: ['my-lists'] });
    };

    const handleDiscard = async () => {
        if (!list.serverId) return;
        try {
            const fresh = await listService.getList(String(list.serverId));
            loadList(fresh);
        } catch (err) {
            console.error('Failed to discard changes:', err);
        }
    };

    return (
        <div className={styles.listPanel} style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Identity row */}
            <div style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.55rem 0.75rem',
                background: 'var(--surface-elevated, var(--bg-secondary))',
                borderBottom: '1px solid var(--border-subtle, var(--border))',
            }}>
                {factionLogo && (
                    <img
                        src={factionLogo}
                        alt=""
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }}
                    />
                )}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
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
                            style={{ background: 'var(--bg-primary)', border: '1px solid var(--accent)', color: 'var(--text-primary)', borderRadius: '4px', padding: '0.15rem 0.45rem', fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', width: '100%', minWidth: 0 }}
                        />
                    ) : (
                        <span
                            title={isLocked ? 'List is locked — unlock to rename' : 'Click to rename'}
                            onClick={() => { if (isLocked) return; setNameValue(list.name); setEditingName(true); }}
                            style={{
                                fontFamily: "'Oxanium', sans-serif",
                                fontSize: 'var(--text-base)',
                                fontWeight: 'var(--font-bold)',
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                cursor: isLocked ? 'default' : 'text',
                                lineHeight: 1.2,
                            }}
                        >{list.name}</span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--text-2xs)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        <span style={{ color: 'var(--color-primary, var(--accent))', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {factionName}
                        </span>
                        <span style={{ color: 'var(--text-tertiary, #64748b)' }}>·</span>
                        <span>{list.pointsLimit} pts</span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                    <StarRating value={list.rating ?? 0} onChange={updateRating} />
                    <button
                        onClick={() => {
                            if (isLocked) {
                                if (!confirm('Unlock this list? It will become editable again.')) return;
                                setLocked(false);
                            } else {
                                setLocked(true);
                            }
                        }}
                        title={isLocked ? 'Unlock — allow edits' : 'Lock — read-only view'}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 28,
                            height: 28,
                            border: `1px solid ${isLocked ? 'rgba(245,158,11,0.35)' : 'var(--border)'}`,
                            background: isLocked ? 'rgba(245,158,11,0.10)' : 'var(--surface, rgba(255,255,255,0.03))',
                            color: isLocked ? '#f59e0b' : 'var(--text-secondary)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                        }}
                    >
                        {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                    {user && (
                        <>
                            <SaveStatusPill
                                saveState={saveState}
                                lastSavedAt={lastSavedAt}
                                onSaveNow={() => saveListMutation.mutate()}
                            />
                            {isDirty && list.serverId && !saveListMutation.isPending && (
                                <DiscardButton onDiscard={handleDiscard} />
                            )}
                        </>
                    )}
                    <ListOverflowMenu
                        pointsLimit={list.pointsLimit}
                        onPointsLimitChange={updatePointsLimit}
                        codeCopied={codeCopied}
                        onCopyCode={handleCopyCode}
                        onOpenInArmy={handleOpenInArmy}
                        onFork={handleSaveAsNew}
                        onReset={resetList}
                    />
                </div>
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
                            <span className={clsx(styles.label, 'text-gray-400 uppercase text-[length:var(--text-2xs)]')}>{type} LIMIT</span>
                            <span className={styles.value}>{count} / {limit}</span>
                        </div>
                    );
                })}
            </div>

            {/* Collapsible Details strip (notes + tags) */}
            <ListDetailsStrip
                expanded={detailsExpanded}
                onToggle={() => setDetailsExpanded(!detailsExpanded)}
                notes={list.notes ?? ''}
                onNotesChange={updateNotes}
                tags={list.tags ?? []}
                onTagsChange={updateTags}
            />

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
                                                    {groupOrders['regular'] > 0 && <span className="flex items-center gap-1.5 text-[length:var(--text-2xs)] font-bold text-gray-300"><OrderIcon type="regular" size={12} /> {groupOrders['regular']}</span>}
                                                    {groupOrders['irregular'] > 0 && <span className="flex items-center gap-1.5 text-[length:var(--text-2xs)] font-bold text-gray-300"><OrderIcon type="irregular" size={12} /> {groupOrders['irregular']}</span>}
                                                    {groupOrders['impetuous'] > 0 && <span className="flex items-center gap-1.5 text-[length:var(--text-2xs)] font-bold text-gray-300"><OrderIcon type="impetuous" size={12} /> {groupOrders['impetuous']}</span>}
                                                    {groupOrders['lieutenant'] > 0 && <span className="flex items-center gap-1.5 text-[length:var(--text-2xs)] font-bold text-gray-300"><OrderIcon type="lieutenant" size={12} /> {groupOrders['lieutenant']}</span>}
                                                    {groupOrders['tactical-awareness'] > 0 && <span className="flex items-center gap-1.5 text-[length:var(--text-2xs)] font-bold text-gray-300"><OrderIcon type="tactical-awareness" size={12} /> {groupOrders['tactical-awareness']}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        {!isLocked && (
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
                                        )}
                                    </div>

                                    {group.units.length === 0 && (!group.fireteams || group.fireteams.length === 0) ? (
                                        isLocked ? null : (
                                            <div className={styles.emptyGroup}>
                                                Click a unit from the roster to add it here
                                            </div>
                                        )
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
                                                                locked={isLocked}
                                                            />
                                                            {peripheralsMap.get(u.id)?.map(p => (
                                                                <DraggableUnitRow
                                                                    key={p.id}
                                                                    listUnit={p}
                                                                    groupIndex={groupIndex}
                                                                    onViewUnit={handleViewUnit}
                                                                    onRemove={() => {}}
                                                                    locked={isLocked}
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

                {!isLocked && list.groups.length < 2 && (
                    <button className={styles.addGroupBtn} onClick={addCombatGroup}>
                        <Plus size={16} />
                        Add Combat Group
                    </button>
                )}
            </div>
        </div>
    );
}
