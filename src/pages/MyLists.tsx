import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { useListStore } from '../stores/useListStore';
import { useGlobalFactionStore } from '../stores/useGlobalFactionStore';
import { ArmyLogo } from '../components/shared/ArmyLogo';
import { Download, Upload, ChevronDown, ChevronRight, MoreHorizontal, Star } from 'lucide-react';
import { getSafeLogo } from '../utils/assets';
import { listService } from '../services/listService';
import type { ListSummary } from '../services/listService';
import { encodeArmyList, decodeArmyCode } from '@shared/armyCode';
import type { ArmyList } from '@shared/listTypes';
import { indexList, type ListIndex } from '@shared/list-similarity';
import type { SearchSuggestion } from '@shared/types';
import { ListContentFilter } from '../components/MyLists/ListContentFilter';
import { NewListModal } from '../components/ListBuilder/NewListModal';
import { StarRating } from '../components/MyLists/StarRating';
import { KebabMenu, KebabItem } from '../components/MyLists/KebabMenu';
import { ListUnitsSummary } from '../components/MyLists/ListUnitsSummary';
import { ImportFromCodeModal } from '../components/MyLists/ImportFromCodeModal';
import { useFactionMapping } from '../hooks/useFactionMapping';
import { generateMarkdownExport, serializeListForJson } from '../utils/listExport';
import { armyListFromDecodedCode, uniqueListName } from '../utils/listImport';

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
                <div className="flex items-end justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-[1.75rem] font-bold text-text-primary tracking-tight">
                            My Lists
                        </h1>
                        <p className="text-text-secondary text-sm mt-1">
                            {count === 0 ? 'No lists saved yet' : `${count} list${count === 1 ? '' : 's'} saved`}
                        </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        {count >= 2 && (
                            <button
                                onClick={() => navigate('/lists/overview')}
                                title="See similarity matrix across all your lists"
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: 'rgba(99,102,241,0.1)',
                                    color: 'var(--accent, #6366f1)',
                                    border: '1px solid rgba(99,102,241,0.35)',
                                    borderRadius: '8px',
                                    fontWeight: 'var(--font-semibold)',
                                    fontSize: 'var(--text-md)',
                                    cursor: 'pointer',
                                }}
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
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                                        padding: '0.5rem 1rem',
                                        background: 'rgba(242,145,7,0.1)', color: '#F29107',
                                        border: '1px solid rgba(242,145,7,0.35)', borderRadius: '8px',
                                        fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-md)',
                                        cursor: isExporting ? 'not-allowed' : 'pointer',
                                        opacity: isExporting ? 0.6 : 1,
                                    }}
                                >
                                    <Download size={16} />
                                    Export .md
                                </button>
                                <button
                                    onClick={() => handleExport(lists ?? [], 'json')}
                                    disabled={isExporting}
                                    title="Export all lists as full JSON"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                                        padding: '0.5rem 1rem',
                                        background: 'rgba(242,145,7,0.1)', color: '#F29107',
                                        border: '1px solid rgba(242,145,7,0.35)', borderRadius: '8px',
                                        fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-md)',
                                        cursor: isExporting ? 'not-allowed' : 'pointer',
                                        opacity: isExporting ? 0.6 : 1,
                                    }}
                                >
                                    <Download size={16} />
                                    Export .json
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => setShowImportModal(true)}
                            title="Import list from army code"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.5rem 1rem',
                                background: 'rgba(16,185,129,0.1)',
                                color: '#10b981',
                                border: '1px solid rgba(16,185,129,0.35)',
                                borderRadius: '8px',
                                fontWeight: 'var(--font-semibold)',
                                fontSize: 'var(--text-md)',
                                cursor: 'pointer',
                            }}
                        >
                            <Upload size={15} />
                            Import
                        </button>
                        <button
                            onClick={() => setShowNewModal(true)}
                            style={{
                                padding: '0.5rem 1.25rem',
                                background: 'var(--accent, #6366f1)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 'var(--font-semibold)',
                                fontSize: 'var(--text-md)',
                                cursor: 'pointer',
                            }}
                        >
                            + New List
                        </button>
                    </div>
                </div>

                {count > 0 && (
                    <>
                        {/* ── Filter / sort bar ── */}
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '1.25rem',
                            padding: '0.75rem 1rem',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '10px',
                        }}>
                            {/* Sort */}
                            <select
                                value={sortKey}
                                onChange={e => setSortKey(e.target.value as SortKey)}
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-secondary)',
                                    fontSize: 'var(--text-sm)',
                                    borderRadius: '6px',
                                    padding: '0.3rem 0.6rem',
                                    cursor: 'pointer',
                                }}
                            >
                                <option value="updated">Recently Updated</option>
                                <option value="created">Recently Created</option>
                                <option value="name">Name A–Z</option>
                                <option value="rating">Rating ↓</option>
                                <option value="points_desc">Points ↓</option>
                                <option value="points_asc">Points ↑</option>
                            </select>

                            {/* Super-faction filter pills */}
                            {activeSuperFactions.length > 1 && (
                                <div className="flex gap-1 flex-wrap">
                                    {activeSuperFactions.map(sf => {
                                        const logo = getSafeLogo(sf.vanilla?.logo);
                                        const active = filterSuperFaction === sf.id;
                                        return (
                                            <button
                                                key={sf.id}
                                                onClick={() => setFilterSuperFaction(active ? null : sf.id)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem',
                                                    padding: '0.25rem 0.65rem 0.25rem 0.4rem',
                                                    borderRadius: '20px',
                                                    fontSize: 'var(--text-sm)',
                                                    fontWeight: 'var(--font-medium)',
                                                    cursor: 'pointer',
                                                    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                                                    background: active ? 'rgba(99,102,241,0.15)' : 'var(--bg-tertiary)',
                                                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                                                    transition: 'all 0.15s',
                                                }}
                                            >
                                                {logo && <img src={logo} alt="" style={{ width: 16, height: 16, objectFit: 'contain', opacity: 0.85 }} onError={e => { e.currentTarget.style.display = 'none'; }} />}
                                                {sf.shortName || sf.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Tag filters */}
                            {allTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                                    style={{
                                        padding: '0.25rem 0.65rem',
                                        borderRadius: '20px',
                                        fontSize: 'var(--text-xs)',
                                        fontWeight: 'var(--font-medium)',
                                        cursor: 'pointer',
                                        border: filterTag === tag ? '1px solid var(--accent)' : '1px solid var(--border)',
                                        background: filterTag === tag ? 'rgba(99,102,241,0.15)' : 'transparent',
                                        color: filterTag === tag ? 'var(--accent)' : 'var(--text-secondary)',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    #{tag}
                                </button>
                            ))}

                            {/* Min-rating filter pill (cycles 0 → 3 → 4 → 5 → 0) */}
                            <button
                                onClick={() => setMinRating(prev => prev === 0 ? 3 : prev === 3 ? 4 : prev === 4 ? 5 : 0)}
                                title="Filter by minimum rating"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.25rem 0.65rem',
                                    borderRadius: '20px',
                                    fontSize: 'var(--text-xs)',
                                    fontWeight: 'var(--font-medium)',
                                    cursor: 'pointer',
                                    border: minRating > 0 ? '1px solid #f59e0b' : '1px solid var(--border)',
                                    background: minRating > 0 ? 'rgba(245,158,11,0.15)' : 'transparent',
                                    color: minRating > 0 ? '#f59e0b' : 'var(--text-secondary)',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <Star size={12} fill={minRating > 0 ? '#f59e0b' : 'none'} strokeWidth={1.8} />
                                {minRating > 0 ? `${minRating}+` : 'Any'}
                            </button>

                            {(filterSuperFaction !== null || filterTag !== null || minRating > 0) && (
                                <button
                                    onClick={() => { setFilterSuperFaction(null); setFilterTag(null); setMinRating(0); }}
                                    style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary, #64748b)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', textDecoration: 'underline' }}
                                >
                                    Clear
                                </button>
                            )}

                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary, #64748b)', marginLeft: 'auto' }}>
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
                        const isRenaming = renamingId === list.id;
                        const isEditingTags = editingTagsId === list.id;
                        const isEditingNotes = editingNotesId === list.id;
                        const isExpanded = expandedIds.has(list.id);
                        const updatedDate = new Date(list.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                        const tags = list.tags ?? [];
                        const inlineTags = tags.slice(0, 3);
                        const overflowCount = tags.length - inlineTags.length;
                        const notes = list.notes ?? '';

                        return (
                            <div
                                key={list.id}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    overflow: 'visible',
                                    transition: 'border-color 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover, #475569)')}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                            >
                                {/* Collapsed row (always visible) */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.6rem',
                                    padding: '0.4rem 0.5rem 0.4rem 0.6rem',
                                    minHeight: '36px',
                                }}>
                                    {/* Selection checkbox */}
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(list.id)}
                                        onChange={() => toggleSelected(list.id)}
                                        title="Select for compare"
                                        style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--accent, #6366f1)', flexShrink: 0 }}
                                    />

                                    {/* Expand toggle */}
                                    <button
                                        onClick={() => toggleExpanded(list.id)}
                                        title={isExpanded ? 'Collapse' : 'Expand'}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'var(--text-tertiary, #64748b)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: 0,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </button>

                                    {/* Faction logo */}
                                    <div style={{ width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {logoSrc ? (
                                            <img
                                                src={logoSrc}
                                                alt={factionInfo?.name}
                                                title={factionInfo?.name}
                                                style={{ width: 22, height: 22, objectFit: 'contain', opacity: 0.9 }}
                                                onError={e => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        ) : (
                                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-bold)', color: 'var(--text-secondary)' }}>
                                                {(factionInfo?.shortName || factionInfo?.name || '?')[0]}
                                            </div>
                                        )}
                                    </div>

                                    {/* Name (click to rename) */}
                                    <div style={{ flex: '1 1 200px', minWidth: 120, overflow: 'hidden' }}>
                                        {isRenaming ? (
                                            <input
                                                autoFocus
                                                value={renameValue}
                                                onChange={e => setRenameValue(e.target.value)}
                                                onBlur={() => handleRenameCommit(list.id)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleRenameCommit(list.id);
                                                    if (e.key === 'Escape') setRenamingId(null);
                                                }}
                                                style={{
                                                    background: 'var(--bg-primary)',
                                                    border: '1px solid var(--accent)',
                                                    color: 'var(--text-primary)',
                                                    borderRadius: '4px',
                                                    padding: '0.15rem 0.4rem',
                                                    fontSize: 'var(--text-md)',
                                                    fontWeight: 'var(--font-semibold)',
                                                    width: '100%',
                                                }}
                                            />
                                        ) : (
                                            <div
                                                onClick={() => { setRenamingId(list.id); setRenameValue(list.name); }}
                                                title={list.name}
                                                style={{
                                                    fontSize: 'var(--text-md)',
                                                    fontWeight: 'var(--font-semibold)',
                                                    color: 'var(--text-primary)',
                                                    cursor: 'text',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {list.name}
                                                {notes && (
                                                    <span style={{ marginLeft: '0.4rem', fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--text-tertiary, #64748b)' }} title={notes}>
                                                        — {notes.length > 60 ? notes.slice(0, 60) + '…' : notes}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Stats */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                        <span>{list.points}<span style={{ color: 'var(--text-tertiary, #64748b)' }}>/{list.swc}</span></span>
                                        <span style={{ color: 'var(--border)' }}>·</span>
                                        <span>{list.unit_count ?? 0}u</span>
                                    </div>

                                    {/* Inline tags (truncated) */}
                                    {tags.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                                            {inlineTags.map(tag => (
                                                <span
                                                    key={tag}
                                                    style={{
                                                        padding: '0.1rem 0.45rem',
                                                        borderRadius: '20px',
                                                        fontSize: 'var(--text-2xs)',
                                                        fontWeight: 'var(--font-medium)',
                                                        background: 'rgba(99,102,241,0.1)',
                                                        border: '1px solid rgba(99,102,241,0.3)',
                                                        color: '#a5b4fc',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    #{tag}
                                                </span>
                                            ))}
                                            {overflowCount > 0 && (
                                                <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary, #64748b)' }}>+{overflowCount}</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Star rating */}
                                    <StarRating
                                        value={list.rating ?? 0}
                                        onChange={(v) => ratingMutation.mutate({ id: list.id, rating: v })}
                                    />

                                    {/* Primary action: Load */}
                                    <button
                                        onClick={() => handleLoad(list.id)}
                                        disabled={loadingId === list.id}
                                        style={{ ...actionBtnSm('#10b981', loadingId === list.id), flexShrink: 0 }}
                                    >
                                        {loadingId === list.id ? '…' : 'Load'}
                                    </button>

                                    {/* Kebab menu */}
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <button
                                            onClick={() => setOpenKebabId(openKebabId === list.id ? null : list.id)}
                                            title="More actions"
                                            style={{
                                                background: 'none',
                                                border: '1px solid var(--border)',
                                                borderRadius: '6px',
                                                padding: '0.25rem',
                                                cursor: 'pointer',
                                                color: 'var(--text-secondary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <MoreHorizontal size={14} />
                                        </button>
                                        {openKebabId === list.id && (
                                            <KebabMenu onClose={() => setOpenKebabId(null)}>
                                                <KebabItem
                                                    color="#F29107"
                                                    disabled={openingInArmyId === list.id}
                                                    onClick={() => { setOpenKebabId(null); handleOpenInArmy(list.id); }}
                                                >
                                                    <ArmyLogo size={12} backdrop />
                                                    {openingInArmyId === list.id ? 'Opening…' : 'Open in Army'}
                                                </KebabItem>
                                                <KebabItem
                                                    color="#6366f1"
                                                    disabled={forkMutation.status === 'pending'}
                                                    onClick={() => { setOpenKebabId(null); forkMutation.mutate(list.id); }}
                                                >
                                                    Fork
                                                </KebabItem>
                                                <KebabItem
                                                    color="#a78bfa"
                                                    onClick={() => { setOpenKebabId(null); navigate(`/lists/overview?focus=${list.id}`); }}
                                                >
                                                    Find similar
                                                </KebabItem>
                                                <KebabItem
                                                    color="#ef4444"
                                                    disabled={deleteMutation.status === 'pending'}
                                                    onClick={() => {
                                                        setOpenKebabId(null);
                                                        if (confirm('Delete this list?')) deleteMutation.mutate(list.id);
                                                    }}
                                                >
                                                    Delete
                                                </KebabItem>
                                            </KebabMenu>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded panel */}
                                {isExpanded && (
                                    <div style={{
                                        borderTop: '1px solid var(--border)',
                                        padding: '0.75rem 0.85rem 0.85rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.65rem',
                                        background: 'var(--bg-primary)',
                                    }}>
                                        {/* Notes */}
                                        <div>
                                            <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-semibold)', color: 'var(--text-tertiary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                                                Notes
                                            </div>
                                            {isEditingNotes ? (
                                                <textarea
                                                    autoFocus
                                                    value={notesValue}
                                                    onChange={e => setNotesValue(e.target.value)}
                                                    onBlur={() => handleNotesCommit(list.id)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleNotesCommit(list.id);
                                                        if (e.key === 'Escape') setEditingNotesId(null);
                                                    }}
                                                    placeholder="Notes about this list — strategy, opponent, occasion…"
                                                    rows={3}
                                                    style={{
                                                        background: 'var(--bg-secondary)',
                                                        border: '1px solid var(--accent)',
                                                        color: 'var(--text-primary)',
                                                        borderRadius: '6px',
                                                        padding: '0.4rem 0.55rem',
                                                        fontSize: 'var(--text-sm)',
                                                        width: '100%',
                                                        boxSizing: 'border-box',
                                                        resize: 'vertical',
                                                        fontFamily: 'inherit',
                                                    }}
                                                />
                                            ) : (
                                                <div
                                                    onClick={() => { setEditingNotesId(list.id); setNotesValue(notes); }}
                                                    title="Click to edit"
                                                    style={{
                                                        fontSize: 'var(--text-sm)',
                                                        color: notes ? 'var(--text-secondary)' : 'var(--text-tertiary, #64748b)',
                                                        fontStyle: notes ? 'normal' : 'italic',
                                                        cursor: 'text',
                                                        whiteSpace: 'pre-wrap',
                                                        minHeight: '1.2em',
                                                        padding: '0.3rem 0.45rem',
                                                        borderRadius: '6px',
                                                        border: '1px dashed var(--border)',
                                                    }}
                                                >
                                                    {notes || 'Click to add notes…'}
                                                </div>
                                            )}
                                        </div>

                                        {/* Units summary (per-group dot list) */}
                                        <div>
                                            <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-semibold)', color: 'var(--text-tertiary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                                                Units
                                            </div>
                                            <ListUnitsSummary listId={list.id} fallback={fullListMap?.get(list.id)} />
                                        </div>

                                        {/* Tags editor */}
                                        <div>
                                            <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-semibold)', color: 'var(--text-tertiary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                                                Tags
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem' }}>
                                                {tags.map(tag => (
                                                    <span
                                                        key={tag}
                                                        onClick={() => tagsMutation.mutate({ id: list.id, tags: tags.filter(t => t !== tag) })}
                                                        title="Click to remove"
                                                        style={{
                                                            padding: '0.15rem 0.55rem',
                                                            borderRadius: '20px',
                                                            fontSize: 'var(--text-2xs)',
                                                            fontWeight: 'var(--font-medium)',
                                                            background: 'rgba(99,102,241,0.1)',
                                                            border: '1px solid rgba(99,102,241,0.3)',
                                                            color: '#a5b4fc',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        #{tag}
                                                    </span>
                                                ))}
                                                {isEditingTags ? (
                                                    <input
                                                        autoFocus
                                                        value={tagInput}
                                                        onChange={e => setTagInput(e.target.value)}
                                                        onBlur={() => handleTagsCommit(list.id, tags)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleTagsCommit(list.id, tags);
                                                            if (e.key === 'Escape') setEditingTagsId(null);
                                                        }}
                                                        placeholder="tag1, tag2, …"
                                                        style={{
                                                            background: 'var(--bg-secondary)',
                                                            border: '1px solid var(--accent)',
                                                            color: 'var(--text-primary)',
                                                            borderRadius: '6px',
                                                            padding: '0.15rem 0.5rem',
                                                            fontSize: 'var(--text-xs)',
                                                            width: '160px',
                                                        }}
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => { setEditingTagsId(list.id); setTagInput(''); }}
                                                        style={{
                                                            padding: '0.15rem 0.55rem',
                                                            borderRadius: '20px',
                                                            fontSize: 'var(--text-2xs)',
                                                            border: '1px dashed var(--border)',
                                                            background: 'none',
                                                            color: 'var(--text-tertiary, #64748b)',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        + tag
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Meta */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.75rem', fontSize: 'var(--text-2xs)', color: 'var(--text-tertiary, #64748b)' }}>
                                            <span style={{ color: 'var(--accent)', fontWeight: 'var(--font-semibold)' }}>
                                                {factionInfo?.name ?? db.getFactionName(list.faction_id)}
                                            </span>
                                            <span>·</span>
                                            <span>Updated {updatedDate}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Multi-select action bar */}
                {selectedIds.length > 0 && (
                    <div style={{
                        position: 'sticky',
                        bottom: '1rem',
                        marginTop: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        padding: '0.75rem 1rem',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--accent)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                        zIndex: 10,
                    }}>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 'var(--font-semibold)' }}>
                            {selectedIds.length} selected
                            {selectedIds.length === 2 && (
                                <span style={{ marginLeft: '0.5rem', color: 'var(--text-tertiary, #64748b)', fontWeight: 400, fontSize: 'var(--text-sm)' }}>
                                    — ready to compare
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => setSelectedIds([])}
                                style={{
                                    padding: '0.4rem 0.85rem',
                                    background: 'none',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-secondary)',
                                    borderRadius: '8px',
                                    fontSize: 'var(--text-sm)',
                                    cursor: 'pointer',
                                }}
                            >
                                Clear
                            </button>
                            <button
                                onClick={() => handleExport((lists ?? []).filter(l => selectedIds.includes(l.id)), 'md')}
                                disabled={isExporting}
                                style={{
                                    padding: '0.4rem 0.85rem',
                                    background: 'none',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-secondary)',
                                    borderRadius: '8px',
                                    fontSize: 'var(--text-sm)',
                                    cursor: isExporting ? 'not-allowed' : 'pointer',
                                    opacity: isExporting ? 0.5 : 1,
                                }}
                            >
                                Export .md
                            </button>
                            <button
                                onClick={() => handleExport((lists ?? []).filter(l => selectedIds.includes(l.id)), 'json')}
                                disabled={isExporting}
                                style={{
                                    padding: '0.4rem 0.85rem',
                                    background: 'none',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-secondary)',
                                    borderRadius: '8px',
                                    fontSize: 'var(--text-sm)',
                                    cursor: isExporting ? 'not-allowed' : 'pointer',
                                    opacity: isExporting ? 0.5 : 1,
                                }}
                            >
                                Export .json
                            </button>
                            <button
                                onClick={handleDeleteSelected}
                                style={{
                                    padding: '0.4rem 0.85rem',
                                    background: 'none',
                                    border: '1px solid #ef4444',
                                    color: 'var(--error)',
                                    borderRadius: '8px',
                                    fontSize: 'var(--text-sm)',
                                    cursor: 'pointer',
                                }}
                            >
                                Delete
                            </button>
                            <button
                                onClick={() => navigate(`/lists/compare?ids=${selectedIds.join(',')}`)}
                                disabled={selectedIds.length !== 2}
                                style={{
                                    padding: '0.4rem 1rem',
                                    background: selectedIds.length === 2 ? 'var(--accent, #6366f1)' : 'var(--bg-tertiary)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: 'var(--text-sm)',
                                    fontWeight: 'var(--font-semibold)',
                                    cursor: selectedIds.length === 2 ? 'pointer' : 'not-allowed',
                                    opacity: selectedIds.length === 2 ? 1 : 0.5,
                                }}
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
function actionBtnSm(accentColor: string, disabled: boolean): React.CSSProperties {
    return {
        padding: '0.2rem 0.65rem',
        borderRadius: '5px',
        fontSize: 'var(--text-2xs)',
        fontWeight: 'var(--font-semibold)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        border: `1px solid ${accentColor}40`,
        background: `${accentColor}15`,
        color: accentColor,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap' as const,
        textAlign: 'center' as const,
    };
}

