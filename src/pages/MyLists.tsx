import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { useListStore } from '../stores/useListStore';
import { useGlobalFactionStore } from '../stores/useGlobalFactionStore';
import { Download, Upload, Star } from 'lucide-react';
import { clsx } from 'clsx';
import { getSafeLogo } from '../utils/assets';
import { listService } from '../services/listService';
import type { ListSummary } from '../services/listService';
import { encodeArmyList, decodeArmyCode } from '@shared/armyCode';
import type { ArmyList } from '@shared/listTypes';
import { indexList, type ListIndex } from '@shared/list-similarity';
import type { SearchSuggestion } from '@shared/types';
import { ListContentFilter } from '../components/MyLists/ListContentFilter';
import { NewListModal } from '../components/ListBuilder/NewListModal';
import { ImportFromCodeModal } from '../components/MyLists/ImportFromCodeModal';
import { FilterPill } from '../components/MyLists/FilterPill';
import { ListRow } from '../components/MyLists/ListRow';
import { useFactionMapping } from '../hooks/useFactionMapping';
import { generateMarkdownExport, serializeListForJson } from '../utils/listExport';
import { armyListFromDecodedCode, uniqueListName } from '../utils/listImport';
import styles from './MyLists.module.css';

type SortKey = 'updated' | 'created' | 'name' | 'points_asc' | 'points_desc' | 'rating';

export function MyLists() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const db = useDatabase();
    const { loadList, createList, resetList, currentList: activeList } = useListStore();

    const clearStoreIfActive = (deletedId: string) => {
        if (activeList?.serverId !== undefined && String(activeList.serverId) === String(deletedId)) {
            resetList();
        }
    };
    const { globalFactionId, setGlobalFactionId } = useGlobalFactionStore();

    const [showNewModal, setShowNewModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [openingInArmyId, setOpeningInArmyId] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
    const [tagInput, setTagInput] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
    const [notesValue, setNotesValue] = useState('');
    const [openKebabId, setOpenKebabId] = useState<string | null>(null);

    const toggleExpanded = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const [sortKey, setSortKey] = useState<SortKey>('updated');
    const [filterSuperFaction, setFilterSuperFaction] = useState<number | null>(null);
    const [filterTag, setFilterTag] = useState<string | null>(null);
    const [minRating, setMinRating] = useState<number>(0);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const toggleSelected = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    // Content-search state. Driving any of these triggers a lazy fetch of full
    // list contents so we can index weapons / skills / equipment / unit names.
    const [contentFilters, setContentFilters] = useState<SearchSuggestion[]>([]);
    const [unitNameQuery, setUnitNameQuery] = useState('');
    const hasContentFilter = contentFilters.length > 0 || unitNameQuery.trim().length > 0;

    const { data: lists, isLoading } = useQuery<ListSummary[]>({
        queryKey: ['my-lists'],
        queryFn: () => listService.getLists(),
        enabled: !!user,
    });

    const { groupedFactions, activeSuperFactions } = useFactionMapping(lists);

    const allTags = useMemo(() => {
        if (!lists) return [];
        const set = new Set<string>();
        lists.forEach(l => (l.tags ?? []).forEach(t => set.add(t)));
        return Array.from(set).sort();
    }, [lists]);

    // Lazy-fetch full list contents only when a content filter is active.
    const allListIds = useMemo(() => (lists ?? []).map(l => l.id), [lists]);
    const { data: fullLists, isFetching: indexFetching } = useQuery<ArmyList[]>({
        queryKey: ['my-lists-full', allListIds.join(',')],
        queryFn: () => Promise.all(allListIds.map(id => listService.getList(id))),
        enabled: hasContentFilter && allListIds.length > 0,
        staleTime: 60_000,
    });

    const indexMap = useMemo(() => {
        if (!fullLists) return null;
        const m = new Map<string, ListIndex>();
        for (const l of fullLists) m.set(l.id, indexList(l));
        return m;
    }, [fullLists]);

    const fullListMap = useMemo(() => {
        if (!fullLists) return null;
        const m = new Map<string, ArmyList>();
        for (const l of fullLists) m.set(l.id, l);
        return m;
    }, [fullLists]);

    const displayedLists = useMemo(() => {
        if (!lists) return [];
        let result = [...lists];
        if (filterSuperFaction !== null) {
            const sf = groupedFactions.find(s => s.id === filterSuperFaction);
            if (sf) {
                const ids = new Set([sf.vanilla?.id, ...sf.sectorials.map(s => s.id)].filter(Boolean) as number[]);
                result = result.filter(l => ids.has(l.faction_id));
            }
        }
        if (filterTag !== null) result = result.filter(l => (l.tags ?? []).includes(filterTag));
        if (minRating > 0) result = result.filter(l => (l.rating ?? 0) >= minRating);
        if (hasContentFilter && indexMap) {
            const q = unitNameQuery.trim().toLowerCase();
            result = result.filter(l => {
                const idx = indexMap.get(l.id);
                if (!idx) return false;
                if (q) {
                    let hit = false;
                    for (const n of idx.unitNames) {
                        if (n.includes(q)) { hit = true; break; }
                    }
                    if (!hit) return false;
                }
                for (const cf of contentFilters) {
                    const set = cf.type === 'weapon' ? idx.weaponIds
                        : cf.type === 'skill' ? idx.skillIds
                            : idx.equipmentIds;
                    if (!set.has(cf.id)) return false;
                }
                return true;
            });
        }
        result.sort((a, b) => {
            switch (sortKey) {
                case 'updated': return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                case 'created': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'name': return a.name.localeCompare(b.name);
                case 'points_asc': return a.points - b.points;
                case 'points_desc': return b.points - a.points;
                case 'rating': {
                    const diff = (b.rating ?? 0) - (a.rating ?? 0);
                    return diff !== 0 ? diff : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                }
            }
        });
        return result;
    }, [lists, filterSuperFaction, filterTag, minRating, sortKey, groupedFactions, hasContentFilter, indexMap, unitNameQuery, contentFilters]);

    const deleteMutation = useMutation({
        mutationFn: (id: string) => listService.deleteList(id),
        onSuccess: (_data, id) => {
            clearStoreIfActive(id);
            queryClient.invalidateQueries({ queryKey: ['my-lists'] });
        },
    });

    const renameMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) =>
            listService.updateList(id, { name }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-lists'] }),
    });

    const tagsMutation = useMutation({
        mutationFn: ({ id, tags }: { id: string; tags: string[] }) =>
            listService.updateList(id, { tags }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-lists'] }),
    });

    const ratingMutation = useMutation({
        mutationFn: ({ id, rating }: { id: string; rating: number }) =>
            listService.updateList(id, { rating }),
        onMutate: async ({ id, rating }) => {
            await queryClient.cancelQueries({ queryKey: ['my-lists'] });
            const prev = queryClient.getQueryData<ListSummary[]>(['my-lists']);
            queryClient.setQueryData<ListSummary[]>(['my-lists'], old =>
                old?.map(l => l.id === id ? { ...l, rating } : l));
            return { prev };
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(['my-lists'], ctx.prev);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['my-lists'] }),
    });

    const notesMutation = useMutation({
        mutationFn: ({ id, notes }: { id: string; notes: string }) =>
            listService.updateList(id, { notes }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-lists'] }),
    });

    const handleNotesCommit = (id: string) => {
        const trimmed = notesValue.trim();
        const current = lists?.find(l => l.id === id)?.notes ?? '';
        if (trimmed !== current) {
            notesMutation.mutate({ id, notes: trimmed });
        }
        setEditingNotesId(null);
    };

    const forkMutation = useMutation({
        mutationFn: (id: string) => listService.forkList(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-lists'] }),
    });

    const handleLoad = async (id: string) => {
        setLoadingId(id);
        try {
            const armyList = await listService.getList(id);
            if (!armyList.tags) armyList.tags = [];
            loadList(armyList);
            navigate('/');
        } catch (e) {
            console.error('Failed to load list', e);
        } finally {
            setLoadingId(null);
        }
    };

    const handleOpenInArmy = async (id: string) => {
        setOpeningInArmyId(id);
        try {
            const armyList = await listService.getList(id);
            const factionInfo = db.getFactionInfo(armyList.factionId);
            const code = encodeArmyList(armyList, factionInfo?.slug ?? 'unknown', (unit) => unit.idArmy || unit.id);
            window.open(`https://infinitytheuniverse.com/army/list/${code}`, '_blank');
        } catch (e) {
            console.error('Failed to open in Army', e);
        } finally {
            setOpeningInArmyId(null);
        }
    };

    const handleExport = async (summaries: ListSummary[], format: 'md' | 'json') => {
        if (summaries.length === 0) return;
        setIsExporting(true);
        try {
            const items = await Promise.all(
                summaries.map(async (summary) => {
                    const armyList = await listService.getList(summary.id);
                    const factionInfo = db.getFactionInfo(summary.faction_id);
                    const factionSlug = factionInfo?.slug ?? 'unknown';
                    const factionName = factionInfo?.name ?? factionSlug;
                    const armyCode = encodeArmyList(armyList, factionSlug, (unit) => unit.idArmy || unit.id);
                    return { armyList, summary, factionName, armyCode };
                })
            );
            const dateStr = new Date().toISOString().slice(0, 10);
            const stem = summaries === lists
                ? `infinity-army-lists-${dateStr}`
                : `infinity-army-lists-selected-${dateStr}`;
            let blob: Blob;
            let filename: string;
            if (format === 'md') {
                blob = new Blob([generateMarkdownExport(items)], { type: 'text/markdown' });
                filename = `${stem}.md`;
            } else {
                const data = items.map(({ armyList, summary, factionName, armyCode }) =>
                    serializeListForJson(armyList, summary, factionName, armyCode));
                blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                filename = `${stem}.json`;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export failed', e);
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Delete ${selectedIds.length} list${selectedIds.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
        await Promise.all(selectedIds.map(id => listService.deleteList(id)));
        selectedIds.forEach(clearStoreIfActive);
        setSelectedIds([]);
        queryClient.invalidateQueries({ queryKey: ['my-lists'] });
    };

    const handleRenameCommit = (id: string) => {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== lists?.find(l => l.id === id)?.name) {
            renameMutation.mutate({ id, name: trimmed });
        }
        setRenamingId(null);
    };

    const handleTagsCommit = (id: string, existingTags: string[]) => {
        const newTags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
        const merged = [...new Set([...existingTags, ...newTags])];
        if (merged.length !== existingTags.length || newTags.some(t => !existingTags.includes(t))) {
            tagsMutation.mutate({ id, tags: merged });
        }
        setEditingTagsId(null);
    };

    if (!user) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-3 text-text-primary">Sign in required</h2>
                    <p className="text-text-secondary">Log in with Google to view and manage your saved Army Lists.</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="text-text-secondary">Loading your lists…</div>
            </div>
        );
    }

    const count = lists?.length ?? 0;

    return (
        <div className="flex-1 overflow-y-auto px-4 py-10 min-h-0">
            <div className="max-w-[1100px] mx-auto">

                {/* ── Page header ── */}
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.headerTitle}>My Lists</h1>
                        <p className={styles.headerSubtitle}>
                            {count === 0 ? 'No lists saved yet' : `${count} list${count === 1 ? '' : 's'} saved`}
                        </p>
                    </div>
                    <div className={styles.headerActions}>
                        {count >= 2 && (
                            <button
                                onClick={() => navigate('/lists/overview')}
                                title="See similarity matrix across all your lists"
                                className={clsx(styles.actionBtn, styles.toneAccent)}
                            >
                                Overview
                            </button>
                        )}
                        {count > 0 && (
                            <>
                                <button
                                    onClick={() => handleExport(lists ?? [], 'md')}
                                    disabled={isExporting}
                                    title="Export all lists as Markdown"
                                    className={clsx(styles.actionBtn, styles.toneAmber)}
                                >
                                    <Download size={16} />
                                    Export .md
                                </button>
                                <button
                                    onClick={() => handleExport(lists ?? [], 'json')}
                                    disabled={isExporting}
                                    title="Export all lists as full JSON"
                                    className={clsx(styles.actionBtn, styles.toneAmber)}
                                >
                                    <Download size={16} />
                                    Export .json
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => setShowImportModal(true)}
                            title="Import list from army code"
                            className={clsx(styles.actionBtn, styles.toneGreen)}
                        >
                            <Upload size={15} />
                            Import
                        </button>
                        <button
                            onClick={() => setShowNewModal(true)}
                            className={clsx(styles.actionBtn, styles.tonePrimary)}
                        >
                            + New List
                        </button>
                    </div>
                </div>

                {count > 0 && (
                    <>
                        {/* ── Filter / sort bar ── */}
                        <div className={styles.filterBar}>
                            <select
                                value={sortKey}
                                onChange={e => setSortKey(e.target.value as SortKey)}
                                className={styles.sortSelect}
                            >
                                <option value="updated">Recently Updated</option>
                                <option value="created">Recently Created</option>
                                <option value="name">Name A–Z</option>
                                <option value="rating">Rating ↓</option>
                                <option value="points_desc">Points ↓</option>
                                <option value="points_asc">Points ↑</option>
                            </select>

                            {activeSuperFactions.length > 1 && activeSuperFactions.map(sf => (
                                <FilterPill
                                    key={sf.id}
                                    active={filterSuperFaction === sf.id}
                                    onClick={() => setFilterSuperFaction(filterSuperFaction === sf.id ? null : sf.id)}
                                    logo={getSafeLogo(sf.vanilla?.logo)}
                                >
                                    {sf.shortName || sf.name}
                                </FilterPill>
                            ))}

                            {allTags.map(tag => (
                                <FilterPill
                                    key={tag}
                                    active={filterTag === tag}
                                    onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                                >
                                    #{tag}
                                </FilterPill>
                            ))}

                            <FilterPill
                                active={minRating > 0}
                                onClick={() => setMinRating(prev => prev === 0 ? 3 : prev === 3 ? 4 : prev === 4 ? 5 : 0)}
                                tone="amber"
                                title="Filter by minimum rating"
                            >
                                <Star size={12} fill={minRating > 0 ? '#f59e0b' : 'none'} strokeWidth={1.8} />
                                {minRating > 0 ? `${minRating}+` : 'Any'}
                            </FilterPill>

                            {(filterSuperFaction !== null || filterTag !== null || minRating > 0) && (
                                <button
                                    onClick={() => { setFilterSuperFaction(null); setFilterTag(null); setMinRating(0); }}
                                    className={styles.filterClear}
                                >
                                    Clear
                                </button>
                            )}

                            <span className={styles.filterCount}>
                                {displayedLists.length} / {count}
                            </span>
                        </div>

                        {/* ── Content filter (units / skills / weapons / equipment) ── */}
                        <div className="mb-5">
                            <ListContentFilter
                                contentFilters={contentFilters}
                                setContentFilters={setContentFilters}
                                unitNameQuery={unitNameQuery}
                                setUnitNameQuery={setUnitNameQuery}
                                busy={hasContentFilter && indexFetching}
                            />
                        </div>

                        {/* ── Empty filtered state ── */}
                        {displayedLists.length === 0 && (
                            <div className="text-center p-12 text-text-secondary">
                                {hasContentFilter && indexFetching && !indexMap
                                    ? 'Indexing list contents…'
                                    : 'No lists match the current filters.'}
                            </div>
                        )}
                    </>
                )}

                {/* ── Empty state ── */}
                {count === 0 && (
                    <div className="text-center py-16 px-8 bg-bg-secondary border border-dashed border-border rounded-xl text-text-secondary">
                        <p>Build a list in the workspace and hit the save button — it'll appear here.</p>
                    </div>
                )}

                {/* ── Import from Code modal ── */}
                {showImportModal && (
                    <ImportFromCodeModal
                        onImport={async (codes) => {
                            const takenNames = [...(lists ?? []).map(l => l.name)];
                            const results = await Promise.allSettled(
                                codes.map(code => {
                                    const armyList = armyListFromDecodedCode(decodeArmyCode(code), db);
                                    armyList.name = uniqueListName(armyList.name, takenNames);
                                    takenNames.push(armyList.name);
                                    return listService.createList(armyList, armyList.factionId);
                                })
                            );
                            queryClient.invalidateQueries({ queryKey: ['my-lists'] });
                            const failed = results.filter(r => r.status === 'rejected').length;
                            if (failed > 0) throw new Error(`${failed} code${failed > 1 ? 's' : ''} failed to import`);
                            setShowImportModal(false);
                        }}
                        onCancel={() => setShowImportModal(false)}
                    />
                )}

                {/* ── New List modal ── */}
                {showNewModal && (
                    <NewListModal
                        db={db}
                        globalFactionId={globalFactionId}
                        setGlobalFactionId={setGlobalFactionId}
                        onConfirm={(name, factionId, points) => {
                            const factionName = db.getFactionName(factionId);
                            const uniqueName = uniqueListName(name, (lists ?? []).map(l => l.name));
                            createList(factionId, factionName, points, uniqueName);
                            setShowNewModal(false);
                            navigate('/');
                        }}
                        onCancel={() => setShowNewModal(false)}
                    />
                )}


                {/* ── List rows (dense) ── */}
                <div className="flex flex-col gap-1.5">
                    {displayedLists.map(list => {
                        const factionInfo = db.getFactionInfo(list.faction_id);
                        const logoSrc = factionInfo?.logo ? getSafeLogo(factionInfo.logo) : undefined;
                        const updatedDate = new Date(list.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                        const tags = list.tags ?? [];
                        const factionName = factionInfo?.name ?? db.getFactionName(list.faction_id);

                        return (
                            <ListRow
                                key={list.id}
                                list={list}
                                factionInfo={factionInfo}
                                logoSrc={logoSrc}
                                factionName={factionName}
                                updatedDate={updatedDate}
                                fullListFallback={fullListMap?.get(list.id)}
                                selected={selectedIds.includes(list.id)}
                                onToggleSelect={() => toggleSelected(list.id)}
                                isExpanded={expandedIds.has(list.id)}
                                onToggleExpand={() => toggleExpanded(list.id)}
                                isLoading={loadingId === list.id}
                                onLoad={() => handleLoad(list.id)}
                                isOpeningInArmy={openingInArmyId === list.id}
                                onOpenInArmy={() => handleOpenInArmy(list.id)}
                                isForking={forkMutation.status === 'pending'}
                                onFork={() => forkMutation.mutate(list.id)}
                                onFindSimilar={() => navigate(`/lists/overview?focus=${list.id}`)}
                                isDeleting={deleteMutation.status === 'pending'}
                                onDelete={() => { if (confirm('Delete this list?')) deleteMutation.mutate(list.id); }}
                                isRenaming={renamingId === list.id}
                                renameValue={renameValue}
                                onRenameStart={() => { setRenamingId(list.id); setRenameValue(list.name); }}
                                onRenameChange={setRenameValue}
                                onRenameCommit={() => handleRenameCommit(list.id)}
                                onRenameCancel={() => setRenamingId(null)}
                                isEditingTags={editingTagsId === list.id}
                                tagInput={tagInput}
                                onTagsEditStart={() => { setEditingTagsId(list.id); setTagInput(''); }}
                                onTagsInputChange={setTagInput}
                                onTagsCommit={() => handleTagsCommit(list.id, tags)}
                                onTagsCancel={() => setEditingTagsId(null)}
                                onTagRemove={(tag) => tagsMutation.mutate({ id: list.id, tags: tags.filter(t => t !== tag) })}
                                isEditingNotes={editingNotesId === list.id}
                                notesValue={notesValue}
                                onNotesEditStart={() => { setEditingNotesId(list.id); setNotesValue(list.notes ?? ''); }}
                                onNotesChange={setNotesValue}
                                onNotesCommit={() => handleNotesCommit(list.id)}
                                onNotesCancel={() => setEditingNotesId(null)}
                                isKebabOpen={openKebabId === list.id}
                                onKebabToggle={() => setOpenKebabId(openKebabId === list.id ? null : list.id)}
                                onKebabClose={() => setOpenKebabId(null)}
                                onRatingChange={(v) => ratingMutation.mutate({ id: list.id, rating: v })}
                            />
                        );
                    })}
                </div>

                {/* Multi-select action bar */}
                {selectedIds.length > 0 && (
                    <div className={styles.multiSelectBar}>
                        <div className={styles.multiSelectLabel}>
                            {selectedIds.length} selected
                            {selectedIds.length === 2 && <> — ready to compare</>}
                        </div>
                        <div className={styles.multiSelectActions}>
                            <button onClick={() => setSelectedIds([])} className={styles.multiSelectBtn}>
                                Clear
                            </button>
                            <button
                                onClick={() => handleExport((lists ?? []).filter(l => selectedIds.includes(l.id)), 'md')}
                                disabled={isExporting}
                                className={styles.multiSelectBtn}
                            >
                                Export .md
                            </button>
                            <button
                                onClick={() => handleExport((lists ?? []).filter(l => selectedIds.includes(l.id)), 'json')}
                                disabled={isExporting}
                                className={styles.multiSelectBtn}
                            >
                                Export .json
                            </button>
                            <button
                                onClick={handleDeleteSelected}
                                className={clsx(styles.multiSelectBtn, styles.multiSelectBtnDanger)}
                            >
                                Delete
                            </button>
                            <button
                                onClick={() => navigate(`/lists/compare?ids=${selectedIds.join(',')}`)}
                                disabled={selectedIds.length !== 2}
                                className={styles.multiSelectBtnPrimary}
                            >
                                Compare
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

