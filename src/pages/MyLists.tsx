import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { useListStore } from '../stores/useListStore';
import { useGlobalFactionStore } from '../stores/useGlobalFactionStore';
import { CompactFactionSelector } from '../components/shared/CompactFactionSelector';
import { ArmyLogo } from '../components/shared/ArmyLogo';
import { Download } from 'lucide-react';
import { getSafeLogo } from '../utils/assets';
import { listService } from '../services/listService';
import type { ListSummary } from '../services/listService';
import { encodeArmyList } from '@shared/armyCode';

type SortKey = 'updated' | 'created' | 'name' | 'points_asc' | 'points_desc';

export function MyLists() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const db = useDatabase();
    const { loadList, createList } = useListStore();
    const { globalFactionId, setGlobalFactionId } = useGlobalFactionStore();

    const [showNewModal, setShowNewModal] = useState(false);

    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [openingInArmyId, setOpeningInArmyId] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
    const [tagInput, setTagInput] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('updated');
    const [filterSuperFaction, setFilterSuperFaction] = useState<number | null>(null);
    const [filterTag, setFilterTag] = useState<string | null>(null);

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
        result.sort((a, b) => {
            switch (sortKey) {
                case 'updated': return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                case 'created': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'name': return a.name.localeCompare(b.name);
                case 'points_asc': return a.points - b.points;
                case 'points_desc': return b.points - a.points;
            }
        });
        return result;
    }, [lists, filterSuperFaction, filterTag, sortKey, groupedFactions]);

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

    const handleExportAll = async () => {
        if (!lists || lists.length === 0) return;
        setIsExporting(true);
        try {
            const exported = await Promise.all(
                lists.map(async (summary) => {
                    const armyList = await listService.getList(summary.id);
                    const factionSlug = db.getFactionInfo(summary.faction_id)?.slug ?? 'unknown';
                    const armyCode = encodeArmyList(armyList, factionSlug, (unit) => unit.idArmy || unit.id);
                    return { name: summary.name, army_code: armyCode };
                })
            );
            const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `infinity-army-lists-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export failed', e);
        } finally {
            setIsExporting(false);
        }
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
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>

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
                        {count > 0 && (
                            <button
                                onClick={handleExportAll}
                                disabled={isExporting}
                                title="Export all lists as JSON"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.5rem 1rem',
                                    background: 'rgba(242,145,7,0.1)',
                                    color: '#F29107',
                                    border: '1px solid rgba(242,145,7,0.35)',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                    cursor: isExporting ? 'not-allowed' : 'pointer',
                                    opacity: isExporting ? 0.6 : 1,
                                    transition: 'all 0.15s',
                                }}
                            >
                                <Download size={16} />
                                {isExporting ? 'Exporting…' : 'Export All'}
                            </button>
                        )}
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

                            {(filterSuperFaction !== null || filterTag !== null) && (
                                <button
                                    onClick={() => { setFilterSuperFaction(null); setFilterTag(null); }}
                                    style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #64748b)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', textDecoration: 'underline' }}
                                >
                                    Clear
                                </button>
                            )}

                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #64748b)', marginLeft: 'auto' }}>
                                {displayedLists.length} / {count}
                            </span>
                        </div>

                        {/* ── Empty filtered state ── */}
                        {displayedLists.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                No lists match the current filters.
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

                {/* ── List cards ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {displayedLists.map(list => {
                        const factionInfo = db.getFactionInfo(list.faction_id);
                        const logoSrc = factionInfo?.logo ? getSafeLogo(factionInfo.logo) : undefined;
                        const isRenaming = renamingId === list.id;
                        const isEditingTags = editingTagsId === list.id;
                        const updatedDate = new Date(list.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

                        return (
                            <div
                                key={list.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'stretch',
                                    gap: 0,
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    transition: 'border-color 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover, #475569)')}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                            >
                                {/* Faction logo strip */}
                                <div style={{
                                    width: '72px',
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'var(--bg-tertiary)',
                                    borderRight: '1px solid var(--border)',
                                    padding: '1rem 0',
                                }}>
                                    {logoSrc ? (
                                        <img
                                            src={logoSrc}
                                            alt={factionInfo?.name}
                                            style={{ width: 44, height: 44, objectFit: 'contain', opacity: 0.9 }}
                                            onError={e => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: 44, height: 44, borderRadius: '50%',
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)',
                                        }}>
                                            {(factionInfo?.shortName || factionInfo?.name || '?')[0]}
                                        </div>
                                    )}
                                </div>

                                {/* Main content */}
                                <div style={{ flex: 1, minWidth: 0, padding: '0.875rem 1rem' }}>
                                    {/* Name row */}
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
                                                borderRadius: '6px',
                                                padding: '0.2rem 0.5rem',
                                                fontSize: '1rem',
                                                fontWeight: 700,
                                                width: '100%',
                                                marginBottom: '0.25rem',
                                            }}
                                        />
                                    ) : (
                                        <div
                                            onClick={() => { setRenamingId(list.id); setRenameValue(list.name); }}
                                            title="Click to rename"
                                            style={{
                                                fontSize: '1rem',
                                                fontWeight: 700,
                                                color: 'var(--text-primary)',
                                                cursor: 'text',
                                                marginBottom: '0.2rem',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {list.name}
                                        </div>
                                    )}

                                    {/* Faction + stats row */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{factionInfo?.name ?? db.getFactionName(list.faction_id)}</span>
                                        <span style={{ color: 'var(--border)' }}>·</span>
                                        <span>{list.points} pts · {list.swc} SWC</span>
                                        <span style={{ color: 'var(--border)' }}>·</span>
                                        <span>{list.unit_count ?? 0} units</span>
                                        <span style={{ color: 'var(--border)' }}>·</span>
                                        <span style={{ color: 'var(--text-tertiary, #64748b)' }}>{updatedDate}</span>
                                    </div>

                                    {/* Tags row */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', minHeight: '22px' }}>
                                        {(list.tags ?? []).map(tag => (
                                            <span
                                                key={tag}
                                                onClick={() => tagsMutation.mutate({ id: list.id, tags: (list.tags ?? []).filter(t => t !== tag) })}
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
                                                    background: 'var(--bg-primary)',
                                                    border: '1px solid var(--accent)',
                                                    color: 'var(--text-primary)',
                                                    borderRadius: '6px',
                                                    padding: '0.15rem 0.5rem',
                                                    fontSize: '0.75rem',
                                                    width: '130px',
                                                }}
                                            />
                                        ) : (
                                            <button
                                                onClick={() => { setEditingTagsId(list.id); setTagInput((list.tags ?? []).join(', ')); }}
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

                                {/* Actions */}
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.4rem',
                                    padding: '0.875rem 0.75rem',
                                    borderLeft: '1px solid var(--border)',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <button
                                        onClick={() => handleLoad(list.id)}
                                        disabled={loadingId === list.id}
                                        style={actionBtn('#10b981', loadingId === list.id)}
                                    >
                                        {loadingId === list.id ? '…' : 'Load'}
                                    </button>
                                    <button
                                        onClick={() => handleOpenInArmy(list.id)}
                                        disabled={openingInArmyId === list.id}
                                        title="Open in Infinity Army"
                                        style={{ ...actionBtn('#F29107', openingInArmyId === list.id), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                                    >
                                        <ArmyLogo size={12} backdrop />
                                        {openingInArmyId === list.id ? '…' : 'Army'}
                                    </button>
                                    <button
                                        onClick={() => forkMutation.mutate(list.id)}
                                        disabled={forkMutation.status === 'pending'}
                                        style={actionBtn('#6366f1', forkMutation.status === 'pending')}
                                    >
                                        Fork
                                    </button>
                                    <button
                                        onClick={() => { if (confirm('Delete this list?')) deleteMutation.mutate(list.id); }}
                                        disabled={deleteMutation.status === 'pending'}
                                        style={actionBtn('#ef4444', deleteMutation.status === 'pending')}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function NewListModal({ db, globalFactionId, setGlobalFactionId, onConfirm, onCancel }: {
    db: ReturnType<typeof import('../hooks/useDatabase').useDatabase>;
    globalFactionId: number | null;
    setGlobalFactionId: (id: number | null) => void;
    onConfirm: (name: string, factionId: number, points: number) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState('');
    const [points, setPoints] = useState(300);
    const groupedFactions = db.getGroupedFactions();
    const factionName = globalFactionId ? db.getFactionName(globalFactionId) : '';
    const defaultName = globalFactionId ? `New ${factionName} List` : '';

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
            onClick={onCancel}
        >
            <div
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.75rem', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
                onClick={e => e.stopPropagation()}
            >
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>Create New Army List</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Faction</label>
                    <CompactFactionSelector groupedFactions={groupedFactions} value={globalFactionId} onChange={setGlobalFactionId} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>List Name</label>
                    <input
                        autoFocus
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={defaultName || 'My Army List'}
                        onKeyDown={e => { if (e.key === 'Enter' && globalFactionId) onConfirm(name.trim() || defaultName, globalFactionId, points); }}
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', padding: '0.6rem 0.75rem', fontSize: '0.9rem' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Points Limit</label>
                    <select
                        value={points}
                        onChange={e => setPoints(Number(e.target.value))}
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', padding: '0.6rem 0.75rem', fontSize: '0.9rem' }}
                    >
                        {[150, 200, 250, 300, 400].map(p => <option key={p} value={p}>{p} pts</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button onClick={onCancel} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>
                        Cancel
                    </button>
                    <button
                        disabled={!globalFactionId}
                        onClick={() => { if (globalFactionId) onConfirm(name.trim() || defaultName, globalFactionId, points); }}
                        style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', background: globalFactionId ? 'var(--accent, #6366f1)' : 'var(--bg-tertiary)', color: '#fff', cursor: globalFactionId ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.875rem', opacity: globalFactionId ? 1 : 0.5 }}
                    >
                        Create List
                    </button>
                </div>
            </div>
        </div>
    );
}

function actionBtn(accentColor: string, disabled: boolean): React.CSSProperties {
    return {
        padding: '0.35rem 0.9rem',
        borderRadius: '6px',
        fontSize: '0.78rem',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        border: `1px solid ${accentColor}40`,
        background: `${accentColor}15`,
        color: accentColor,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap' as const,
        width: '64px',
        textAlign: 'center' as const,
    };
}
