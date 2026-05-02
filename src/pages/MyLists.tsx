import { useState, useMemo, useEffect, useRef } from 'react';
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
import { encodeArmyList, decodeArmyCode, type DecodedArmyList } from '@shared/armyCode';
import { generateId, getUnitDetails } from '@shared/listTypes';
import type { ArmyList, CombatGroup, ListUnit } from '@shared/listTypes';
import { indexList, type ListIndex } from '@shared/list-similarity';
import type { SearchSuggestion } from '@shared/types';
import { ListContentFilter } from '../components/MyLists/ListContentFilter';
import { NewListModal } from '../components/ListBuilder/NewListModal';

type SortKey = 'updated' | 'created' | 'name' | 'points_asc' | 'points_desc' | 'rating';

export function MyLists() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const db = useDatabase();
    const { loadList, createList } = useListStore();
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
    const [editingDescId, setEditingDescId] = useState<string | null>(null);
    const [descValue, setDescValue] = useState('');
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

    const groupedFactions = db.getGroupedFactions();

    // Map faction_id → super-faction id
    const factionToSuperFaction = useMemo(() => {
        const map = new Map<number, number>();
        for (const sf of groupedFactions) {
            if (sf.vanilla) map.set(sf.vanilla.id, sf.id);
            for (const s of sf.sectorials) map.set(s.id, sf.id);
        }
        return map;
    }, [groupedFactions]);

    // Which super-factions actually appear in the list collection
    const activeSuperFactions = useMemo(() => {
        if (!lists) return [];
        const sfIds = new Set(lists.map(l => factionToSuperFaction.get(l.faction_id)).filter(Boolean));
        return groupedFactions.filter(sf => sfIds.has(sf.id));
    }, [lists, groupedFactions, factionToSuperFaction]);

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
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-lists'] }),
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

    const descMutation = useMutation({
        mutationFn: ({ id, description }: { id: string; description: string }) =>
            listService.updateList(id, { description }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-lists'] }),
    });

    const handleDescCommit = (id: string) => {
        const trimmed = descValue.trim();
        const current = lists?.find(l => l.id === id)?.description ?? '';
        if (trimmed !== current) {
            descMutation.mutate({ id, description: trimmed });
        }
        setEditingDescId(null);
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

    const handleTagsCommit = (id: string) => {
        const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
        tagsMutation.mutate({ id, tags });
        setEditingTagsId(null);
    };

    if (!user) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Sign in required</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Log in with Google to view and manage your saved Army Lists.</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div style={{ color: 'var(--text-secondary)' }}>Loading your lists…</div>
            </div>
        );
    }

    const count = lists?.length ?? 0;

    return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem 1rem', minHeight: 0 }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

                {/* ── Page header ── */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '2rem', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                            My Army Lists
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
                            {count === 0 ? 'No lists saved yet' : `${count} list${count === 1 ? '' : 's'} saved`}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
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
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
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
                                        fontWeight: 600, fontSize: '0.875rem',
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
                                        fontWeight: 600, fontSize: '0.875rem',
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
                                fontWeight: 600,
                                fontSize: '0.875rem',
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
                                fontWeight: 600,
                                fontSize: '0.875rem',
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
                                    fontSize: '0.8rem',
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
                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
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
                                                    fontSize: '0.78rem',
                                                    fontWeight: 500,
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
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
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
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
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
                                    style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #64748b)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', textDecoration: 'underline' }}
                                >
                                    Clear
                                </button>
                            )}

                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #64748b)', marginLeft: 'auto' }}>
                                {displayedLists.length} / {count}
                            </span>
                        </div>

                        {/* ── Content filter (units / skills / weapons / equipment) ── */}
                        <div style={{ marginBottom: '1.25rem' }}>
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
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                {hasContentFilter && indexFetching && !indexMap
                                    ? 'Indexing list contents…'
                                    : 'No lists match the current filters.'}
                            </div>
                        )}
                    </>
                )}

                {/* ── Empty state ── */}
                {count === 0 && (
                    <div style={{
                        textAlign: 'center',
                        padding: '4rem 2rem',
                        background: 'var(--bg-secondary)',
                        border: '1px dashed var(--border)',
                        borderRadius: '12px',
                        color: 'var(--text-secondary)',
                    }}>
                        <p style={{ margin: 0 }}>Build a list in the workspace and hit the save button — it'll appear here.</p>
                    </div>
                )}

                {/* ── Import from Code modal ── */}
                {showImportModal && (
                    <ImportFromCodeModal
                        onImport={async (codes) => {
                            const results = await Promise.allSettled(
                                codes.map(code => {
                                    const armyList = armyListFromDecodedCode(decodeArmyCode(code), db);
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
                            createList(factionId, factionName, points, name);
                            setShowNewModal(false);
                            navigate('/');
                        }}
                        onCancel={() => setShowNewModal(false)}
                    />
                )}


                {/* ── List rows (dense) ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {displayedLists.map(list => {
                        const factionInfo = db.getFactionInfo(list.faction_id);
                        const logoSrc = factionInfo?.logo ? getSafeLogo(factionInfo.logo) : undefined;
                        const isRenaming = renamingId === list.id;
                        const isEditingTags = editingTagsId === list.id;
                        const isEditingDesc = editingDescId === list.id;
                        const isExpanded = expandedIds.has(list.id);
                        const updatedDate = new Date(list.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                        const tags = list.tags ?? [];
                        const inlineTags = tags.slice(0, 3);
                        const overflowCount = tags.length - inlineTags.length;
                        const description = list.description ?? '';

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
                                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
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
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600,
                                                    width: '100%',
                                                }}
                                            />
                                        ) : (
                                            <div
                                                onClick={() => { setRenamingId(list.id); setRenameValue(list.name); }}
                                                title={list.name}
                                                style={{
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600,
                                                    color: 'var(--text-primary)',
                                                    cursor: 'text',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {list.name}
                                                {description && (
                                                    <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-tertiary, #64748b)' }} title={description}>
                                                        — {description.length > 60 ? description.slice(0, 60) + '…' : description}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Stats */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0, whiteSpace: 'nowrap' }}>
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
                                                        fontSize: '0.68rem',
                                                        fontWeight: 500,
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
                                        {/* Description */}
                                        <div>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                                                Description
                                            </div>
                                            {isEditingDesc ? (
                                                <textarea
                                                    autoFocus
                                                    value={descValue}
                                                    onChange={e => setDescValue(e.target.value)}
                                                    onBlur={() => handleDescCommit(list.id)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleDescCommit(list.id);
                                                        if (e.key === 'Escape') setEditingDescId(null);
                                                    }}
                                                    placeholder="Notes about this list — strategy, opponent, occasion…"
                                                    rows={3}
                                                    style={{
                                                        background: 'var(--bg-secondary)',
                                                        border: '1px solid var(--accent)',
                                                        color: 'var(--text-primary)',
                                                        borderRadius: '6px',
                                                        padding: '0.4rem 0.55rem',
                                                        fontSize: '0.82rem',
                                                        width: '100%',
                                                        boxSizing: 'border-box',
                                                        resize: 'vertical',
                                                        fontFamily: 'inherit',
                                                    }}
                                                />
                                            ) : (
                                                <div
                                                    onClick={() => { setEditingDescId(list.id); setDescValue(description); }}
                                                    title="Click to edit"
                                                    style={{
                                                        fontSize: '0.82rem',
                                                        color: description ? 'var(--text-secondary)' : 'var(--text-tertiary, #64748b)',
                                                        fontStyle: description ? 'normal' : 'italic',
                                                        cursor: 'text',
                                                        whiteSpace: 'pre-wrap',
                                                        minHeight: '1.2em',
                                                        padding: '0.3rem 0.45rem',
                                                        borderRadius: '6px',
                                                        border: '1px dashed var(--border)',
                                                    }}
                                                >
                                                    {description || 'Click to add a description…'}
                                                </div>
                                            )}
                                        </div>

                                        {/* Units summary (per-group dot list) */}
                                        <div>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                                                Units
                                            </div>
                                            <ListUnitsSummary listId={list.id} fallback={fullListMap?.get(list.id)} />
                                        </div>

                                        {/* Tags editor */}
                                        <div>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
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
                                                            fontSize: '0.72rem',
                                                            fontWeight: 500,
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
                                                        onBlur={() => handleTagsCommit(list.id)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleTagsCommit(list.id);
                                                            if (e.key === 'Escape') setEditingTagsId(null);
                                                        }}
                                                        placeholder="tag1, tag2, …"
                                                        style={{
                                                            background: 'var(--bg-secondary)',
                                                            border: '1px solid var(--accent)',
                                                            color: 'var(--text-primary)',
                                                            borderRadius: '6px',
                                                            padding: '0.15rem 0.5rem',
                                                            fontSize: '0.75rem',
                                                            width: '160px',
                                                        }}
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => { setEditingTagsId(list.id); setTagInput(tags.join(', ')); }}
                                                        style={{
                                                            padding: '0.15rem 0.55rem',
                                                            borderRadius: '20px',
                                                            fontSize: '0.72rem',
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
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.75rem', fontSize: '0.72rem', color: 'var(--text-tertiary, #64748b)' }}>
                                            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
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
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {selectedIds.length} selected
                            {selectedIds.length === 2 && (
                                <span style={{ marginLeft: '0.5rem', color: 'var(--text-tertiary, #64748b)', fontWeight: 400, fontSize: '0.78rem' }}>
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
                                    fontSize: '0.8rem',
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
                                    fontSize: '0.8rem',
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
                                    fontSize: '0.8rem',
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
                                    color: '#ef4444',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
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
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
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

function fmtSwc(v: number): string {
    return v % 1 === 0 ? String(v) : v.toFixed(1);
}

function fmtStars(n: number): string {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function fmtDate(ts: number | string): string {
    return new Date(typeof ts === 'number' ? ts : ts).toISOString().slice(0, 10);
}

function generateMarkdownExport(
    items: Array<{ armyList: ArmyList; summary: import('../services/listService').ListSummary; factionName: string; armyCode: string }>
): string {
    const sections = items.map(({ armyList, summary, factionName, armyCode }) => {
        const url = `https://infinitytheuniverse.com/army/list/${armyCode}`;
        const lines: string[] = [];

        lines.push(`# ${armyList.name}`);
        lines.push('');
        lines.push(`**Faction:** ${factionName}  `);
        lines.push(`**Points:** ${summary.points} / ${armyList.pointsLimit} · **SWC:** ${fmtSwc(summary.swc)} / ${fmtSwc(armyList.swcLimit)}  `);
        if (armyList.rating) lines.push(`**Rating:** ${fmtStars(armyList.rating)}  `);
        if (armyList.tags?.length) lines.push(`**Tags:** ${armyList.tags.join(', ')}  `);
        lines.push(`**Created:** ${fmtDate(armyList.createdAt)} · **Updated:** ${fmtDate(armyList.updatedAt)}`);

        if (armyList.description?.trim()) {
            lines.push('');
            lines.push(`> ${armyList.description.trim().replace(/\n/g, '\n> ')}`);
        }

        lines.push('');
        lines.push(`[Open in Infinity Army →](${url})`);
        lines.push('');
        lines.push('```');
        lines.push(armyCode);
        lines.push('```');

        for (const group of armyList.groups) {
            if (group.units.length === 0) continue;
            lines.push('');
            lines.push(`### ${group.name || 'Combat Group'}`);
            lines.push('');
            lines.push('| Unit | Loadout | Pts | SWC |');
            lines.push('|------|---------|----:|----:|');
            for (const lu of group.units) {
                const profileGroup = lu.unit.raw.profileGroups.find(pg => pg.id === lu.profileGroupId);
                const option = profileGroup?.options.find(o => o.id === lu.optionId);
                const unitLabel = lu.isPeripheral
                    ? `↳ ${profileGroup?.isc ?? lu.unit.name}`
                    : (profileGroup?.isc ?? lu.unit.name);
                lines.push(`| ${unitLabel} | ${option?.name ?? '—'} | ${lu.points} | ${fmtSwc(lu.swc)} |`);
            }
            const gPts = group.units.filter(u => !u.isPeripheral).reduce((s, u) => s + u.points, 0);
            const gSwc = group.units.filter(u => !u.isPeripheral).reduce((s, u) => s + u.swc, 0);
            lines.push('');
            lines.push(`*${gPts} pts / ${fmtSwc(gSwc)} SWC*`);
        }

        lines.push('');
        lines.push(`**Total: ${summary.points} pts / ${fmtSwc(summary.swc)} SWC** (${summary.unit_count} units)`);

        return lines.join('\n');
    });

    return sections.join('\n\n---\n\n');
}

function serializeListForJson(
    armyList: ArmyList,
    summary: import('../services/listService').ListSummary,
    factionName: string,
    armyCode: string,
) {
    return {
        id: armyList.id,
        name: armyList.name,
        description: armyList.description ?? null,
        tags: armyList.tags,
        rating: armyList.rating ?? null,
        factionId: armyList.factionId,
        factionName,
        pointsLimit: armyList.pointsLimit,
        swcLimit: armyList.swcLimit,
        points: summary.points,
        swc: summary.swc,
        unitCount: summary.unit_count,
        createdAt: armyList.createdAt,
        updatedAt: armyList.updatedAt,
        armyCode,
        groups: armyList.groups.map(g => ({
            id: g.id,
            name: g.name,
            fireteams: g.fireteams ?? [],
            units: g.units.map(lu => ({
                id: lu.id,
                unitId: lu.unit.id,
                unitIdArmy: lu.unit.idArmy ?? null,
                unitName: lu.unit.name,
                profileGroupId: lu.profileGroupId,
                profileId: lu.profileId,
                optionId: lu.optionId,
                points: lu.points,
                swc: lu.swc,
                isPeripheral: lu.isPeripheral ?? false,
                parentId: lu.parentId ?? null,
                fireteamId: lu.fireteamId ?? null,
                fireteamColor: lu.fireteamColor ?? null,
                fireteamNotes: lu.fireteamNotes ?? null,
            })),
        })),
    };
}

/** Build a full ArmyList from a decoded army code, resolving units from the db. */
function armyListFromDecodedCode(
    decoded: DecodedArmyList,
    db: ReturnType<typeof import('../hooks/useDatabase').useDatabase>,
): ArmyList {
    const now = Date.now();
    const groups: CombatGroup[] = decoded.combatGroups.map((cg, i) => {
        const units: ListUnit[] = [];
        for (const member of cg.members) {
            const unit = db.units.find(u => u.id === member.unitId || u.idArmy === member.unitId);
            if (!unit) continue;
            const { option } = getUnitDetails(unit, member.groupChoice, member.groupChoice, member.optionChoice);
            units.push({
                id: generateId(),
                unit,
                profileGroupId: member.groupChoice,
                profileId: member.groupChoice,
                optionId: member.optionChoice,
                points: Number(option?.points ?? 0),
                swc: Number(option?.swc ?? 0),
            });
        }
        return { id: generateId(), name: `Combat Group ${i + 1}`, units };
    });

    return {
        id: generateId(),
        name: decoded.armyName || 'Imported List',
        tags: [],
        factionId: decoded.factionId,
        pointsLimit: decoded.maxPoints,
        swcLimit: decoded.maxPoints / 50,
        groups,
        createdAt: now,
        updatedAt: now,
    };
}

function parseCodes(raw: string): string[] {
    return raw
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(Boolean);
}

function ImportFromCodeModal({ onImport, onCancel }: {
    onImport: (codes: string[]) => Promise<void>;
    onCancel: () => void;
}) {
    const [raw, setRaw] = useState('');
    const [error, setError] = useState('');
    const [importing, setImporting] = useState(false);

    const codes = parseCodes(raw);

    const handleSubmit = async () => {
        setError('');
        setImporting(true);
        try {
            await onImport(codes);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Import failed — check that all codes are valid.');
        } finally {
            setImporting(false);
        }
    };

    const placeholder = `Paste one or more army codes, one per line or comma-separated:\n\nABC123...\nDEF456...\nGHI789...`;

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
            onClick={onCancel}
        >
            <div
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.75rem', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
                onClick={e => e.stopPropagation()}
            >
                <div>
                    <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>Import from Army Code</h2>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Paste one or more codes from Infinity Army. Separate multiple codes with commas or newlines.
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Army Code(s)</label>
                        {codes.length > 1 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                                {codes.length} lists detected
                            </span>
                        )}
                    </div>
                    <textarea
                        autoFocus
                        value={raw}
                        onChange={e => { setRaw(e.target.value); setError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && codes.length > 0) handleSubmit(); }}
                        placeholder={placeholder}
                        rows={6}
                        style={{
                            background: 'var(--bg-primary)',
                            border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
                            color: 'var(--text-primary)',
                            borderRadius: '8px',
                            padding: '0.6rem 0.75rem',
                            fontSize: '0.78rem',
                            fontFamily: 'monospace',
                            resize: 'vertical',
                            width: '100%',
                            boxSizing: 'border-box',
                        }}
                    />
                    {error && <p style={{ margin: 0, fontSize: '0.78rem', color: '#ef4444' }}>{error}</p>}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button onClick={onCancel} disabled={importing} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: importing ? 'not-allowed' : 'pointer', fontSize: '0.875rem', opacity: importing ? 0.5 : 1 }}>
                        Cancel
                    </button>
                    <button
                        disabled={codes.length === 0 || importing}
                        onClick={handleSubmit}
                        style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', background: codes.length > 0 && !importing ? '#10b981' : 'var(--bg-tertiary)', color: '#fff', cursor: codes.length > 0 && !importing ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.875rem', opacity: codes.length > 0 && !importing ? 1 : 0.5 }}
                    >
                        {importing ? 'Importing…' : `Import ${codes.length > 1 ? `${codes.length} Lists` : 'List'}`}
                    </button>
                </div>
            </div>
        </div>
    );
}


function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [hover, setHover] = useState(0);
    const display = hover || value;
    return (
        <div
            style={{ display: 'flex', alignItems: 'center', gap: '1px', flexShrink: 0 }}
            onMouseLeave={() => setHover(0)}
            title={value > 0 ? `${value} / 5 — click same star to clear` : 'Rate this list'}
        >
            {[1, 2, 3, 4, 5].map(n => {
                const filled = n <= display;
                return (
                    <button
                        key={n}
                        onClick={(e) => { e.stopPropagation(); onChange(value === n ? 0 : n); }}
                        onMouseEnter={() => setHover(n)}
                        style={{
                            background: 'none',
                            border: 'none',
                            padding: '2px',
                            cursor: 'pointer',
                            color: filled ? '#f59e0b' : 'var(--text-tertiary, #64748b)',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: filled ? 1 : 0.45,
                            transition: 'opacity 0.1s, color 0.1s',
                        }}
                        aria-label={`${n} star${n === 1 ? '' : 's'}`}
                    >
                        <Star size={13} fill={filled ? '#f59e0b' : 'none'} strokeWidth={1.8} />
                    </button>
                );
            })}
        </div>
    );
}

function ListUnitsSummary({ listId, fallback }: { listId: string; fallback?: ArmyList }) {
    const { data, isLoading } = useQuery<ArmyList>({
        queryKey: ['list-detail', listId],
        queryFn: () => listService.getList(listId),
        enabled: !fallback,
        initialData: fallback,
        staleTime: 60_000,
    });

    const muted: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--text-tertiary, #64748b)', fontStyle: 'italic' };
    if (isLoading && !data) return <div style={muted}>Loading units…</div>;
    if (!data) return <div style={muted}>(unable to load)</div>;

    const groups = (data.groups ?? []).filter(g => g.units.some(u => !u.isPeripheral));
    if (groups.length === 0) return <div style={muted}>(empty list)</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {groups.map((g, idx) => {
                const realUnits = g.units.filter(u => !u.isPeripheral);
                return (
                    <div key={g.id} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        <span style={{ color: 'var(--text-tertiary, #64748b)', fontWeight: 600, marginRight: '0.4rem', fontSize: '0.72rem' }}>
                            G{idx + 1}
                        </span>
                        {realUnits.map((u, i) => {
                            const label = unitLabel(u);
                            return (
                                <span key={u.id}>
                                    {i > 0 && <span style={{ color: 'var(--border)', margin: '0 0.35rem' }}>·</span>}
                                    {label}
                                </span>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}

function unitLabel(u: ListUnit): string {
    const isc = u.unit?.isc || u.unit?.name || '?';
    const { option } = getUnitDetails(u.unit, u.profileGroupId, u.profileId, u.optionId);
    const optName = option?.name?.trim();
    if (optName && optName !== isc && !isc.toLowerCase().includes(optName.toLowerCase())) {
        return `${isc} (${optName})`;
    }
    return isc;
}

function actionBtnSm(accentColor: string, disabled: boolean): React.CSSProperties {
    return {
        padding: '0.2rem 0.65rem',
        borderRadius: '5px',
        fontSize: '0.72rem',
        fontWeight: 600,
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

function KebabMenu({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        // Defer one tick so the click that opened the menu doesn't immediately close it
        const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
        return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
    }, [onClose]);
    return (
        <div
            ref={ref}
            style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                minWidth: 160,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                zIndex: 50,
                padding: '0.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.15rem',
            }}
        >
            {children}
        </div>
    );
}

function KebabItem({ color, disabled, onClick, children }: {
    color: string;
    disabled?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.6rem',
                borderRadius: '5px',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                border: 'none',
                background: 'transparent',
                color,
                textAlign: 'left',
                whiteSpace: 'nowrap',
                transition: 'background 0.1s',
            }}
            onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${color}15`; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
            {children}
        </button>
    );
}
