import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { listService, type ListSummary } from '../services/listService';
import {
    listSimilarity,
    SAME_FACTION_WEIGHTS,
    CROSS_FACTION_WEIGHTS,
    type SimilarityResult,
} from '@shared/list-similarity';
import type { ArmyList } from '@shared/listTypes';
import { getSafeLogo } from '../utils/assets';
import { ForceClusterGraph } from '../components/ListsOverview/ForceClusterGraph';

type Mode = 'matrix' | 'cluster' | 'similar';
type ScopeKey = number | 'all';

export function ListsOverviewPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const db = useDatabase();

    const focusId = searchParams.get('focus');
    const [overviewMode, setOverviewMode] = useState<'matrix' | 'cluster'>('matrix');
    const mode: Mode = focusId ? 'similar' : overviewMode;

    const [scope, setScope] = useState<ScopeKey>('all');
    const [clusterThreshold, setClusterThreshold] = useState(0.5);

    // Step 1: fetch summaries (cheap)
    const { data: summaries, isLoading: summariesLoading } = useQuery<ListSummary[]>({
        queryKey: ['my-lists'],
        queryFn: () => listService.getLists(),
    });

    // Step 2: filter to scope
    const groupedFactions = db.getGroupedFactions();
    const factionToSuperFaction = useMemo(() => {
        const map = new Map<number, number>();
        for (const sf of groupedFactions) {
            if (sf.vanilla) map.set(sf.vanilla.id, sf.id);
            for (const s of sf.sectorials) map.set(s.id, sf.id);
        }
        return map;
    }, [groupedFactions]);

    const activeSuperFactions = useMemo(() => {
        if (!summaries) return [];
        const sfIds = new Set(summaries.map(l => factionToSuperFaction.get(l.faction_id)).filter(Boolean));
        return groupedFactions.filter(sf => sfIds.has(sf.id));
    }, [summaries, groupedFactions, factionToSuperFaction]);

    const filteredSummaries = useMemo<ListSummary[]>(() => {
        if (!summaries) return [];
        if (scope === 'all') return summaries;
        const sf = groupedFactions.find(s => s.id === scope);
        if (!sf) return summaries;
        const ids = new Set([sf.vanilla?.id, ...sf.sectorials.map(s => s.id)].filter(Boolean) as number[]);
        return summaries.filter(l => ids.has(l.faction_id));
    }, [summaries, scope, groupedFactions]);

    const filteredIds = filteredSummaries.map(s => s.id);

    // Step 3: fetch full lists for the filtered set (parallel)
    const { data: fullLists, isFetching: listsFetching } = useQuery<ArmyList[]>({
        queryKey: ['lists-overview', filteredIds.join(',')],
        queryFn: () => Promise.all(filteredIds.map(id => listService.getList(id))),
        enabled: filteredSummaries.length > 0,
    });

    // Step 4: compute pairwise similarity matrix
    const matrix = useMemo(() => {
        if (!fullLists) return null;
        const n = fullLists.length;
        const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(1));
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const a = fullLists[i];
                const b = fullLists[j];
                const w = a.factionId === b.factionId ? SAME_FACTION_WEIGHTS : CROSS_FACTION_WEIGHTS;
                const r = listSimilarity(a, b, { classifieds: db.classifieds }, w).composite;
                m[i][j] = r;
                m[j][i] = r;
            }
        }
        return m;
    }, [fullLists, db.classifieds]);

    // Similar-to-focus ranked rows
    const focusIndex = focusId ? filteredIds.indexOf(focusId) : -1;
    const ranked = useMemo(() => {
        if (mode !== 'similar' || !fullLists || focusIndex < 0) return null;
        const focus = fullLists[focusIndex];
        const rows: Array<{ list: ArmyList; sim: SimilarityResult }> = [];
        for (let i = 0; i < fullLists.length; i++) {
            if (i === focusIndex) continue;
            const other = fullLists[i];
            const w = focus.factionId === other.factionId ? SAME_FACTION_WEIGHTS : CROSS_FACTION_WEIGHTS;
            const sim = listSimilarity(focus, other, { classifieds: db.classifieds }, w);
            rows.push({ list: other, sim });
        }
        rows.sort((x, y) => y.sim.composite - x.sim.composite);
        return { focus, rows };
    }, [mode, fullLists, focusIndex, db.classifieds]);

    if (summariesLoading) return <div style={msgStyle}>Loading lists…</div>;
    if (!summaries || summaries.length < 2) {
        return (
            <div style={msgStyle}>
                Save at least 2 lists to use the overview.
            </div>
        );
    }

    return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 1rem', minHeight: 0 }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                            {mode === 'similar' && ranked
                                ? `Lists similar to ${ranked.focus.name}`
                                : 'Lists Overview'}
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
                            {mode === 'matrix' && 'All-pairs similarity matrix. Click any cell to drill into the comparison.'}
                            {mode === 'cluster' && 'Force-directed clusters. Tightly-bound nodes share more in common; drag to rearrange.'}
                            {mode === 'similar' && 'Ranked by composite similarity. Cross-faction pairs use capability-weighted scoring.'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {mode === 'similar' && (
                            <button onClick={() => setSearchParams({})} style={chipBtnStyle}>
                                ← Matrix view
                            </button>
                        )}
                        <button onClick={() => navigate('/lists')} style={chipBtnStyle}>← Back to lists</button>
                    </div>
                </div>

                {/* View toggle (matrix vs cluster) — hidden in similar mode */}
                {mode !== 'similar' && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{
                            display: 'inline-flex', gap: '0.25rem', padding: '0.25rem',
                            background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                            borderRadius: '8px',
                        }}>
                            {(['matrix', 'cluster'] as const).map(m => {
                                const active = overviewMode === m;
                                return (
                                    <button
                                        key={m}
                                        onClick={() => setOverviewMode(m)}
                                        style={{
                                            padding: '0.35rem 0.85rem',
                                            border: 'none',
                                            background: active ? 'var(--accent, #6366f1)' : 'transparent',
                                            color: active ? '#fff' : 'var(--text-secondary)',
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            borderRadius: '6px',
                                            textTransform: 'capitalize',
                                        }}
                                    >
                                        {m}
                                    </button>
                                );
                            })}
                        </div>

                        {mode === 'cluster' && (
                            <label style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.25rem 0.75rem', background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border)', borderRadius: '8px',
                                fontSize: '0.78rem', color: 'var(--text-secondary)',
                            }}>
                                Edge threshold
                                <input
                                    type="range"
                                    min={0.3}
                                    max={0.9}
                                    step={0.05}
                                    value={clusterThreshold}
                                    onChange={e => setClusterThreshold(Number(e.target.value))}
                                    style={{ width: 120 }}
                                />
                                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', minWidth: '2.4em' }}>
                                    {Math.round(clusterThreshold * 100)}%
                                </span>
                            </label>
                        )}
                    </div>
                )}

                {/* Faction-scope filter */}
                {activeSuperFactions.length > 1 && mode !== 'similar' && (
                    <div style={filterBarStyle}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary, #64748b)', marginRight: '0.25rem' }}>Scope:</span>
                        <ScopePill active={scope === 'all'} label="All factions" onClick={() => setScope('all')} />
                        {activeSuperFactions.map(sf => (
                            <ScopePill
                                key={sf.id}
                                active={scope === sf.id}
                                label={sf.shortName || sf.name}
                                logo={sf.vanilla?.logo}
                                onClick={() => setScope(sf.id)}
                            />
                        ))}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #64748b)', marginLeft: 'auto' }}>
                            {filteredSummaries.length} list{filteredSummaries.length === 1 ? '' : 's'}
                        </span>
                    </div>
                )}

                {/* Body */}
                {listsFetching && (!fullLists || fullLists.length === 0) ? (
                    <div style={msgStyle}>Loading list contents…</div>
                ) : filteredSummaries.length < 2 ? (
                    <div style={cardStyle}>
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                            This scope has fewer than 2 lists — switch to "All factions" or save more lists.
                        </p>
                    </div>
                ) : mode === 'similar' && ranked ? (
                    <RankedTable rows={ranked.rows} db={db} onPick={(id) => navigate(`/lists/compare?ids=${ranked.focus.id},${id}`)} />
                ) : mode === 'cluster' && matrix && fullLists ? (
                    <div style={cardStyle}>
                        <ForceClusterGraph
                            lists={fullLists}
                            matrix={matrix}
                            threshold={clusterThreshold}
                            factionShortName={(id) => db.getFactionShortName(id)}
                            superFactionIdOf={(id) => factionToSuperFaction.get(id) ?? id}
                            onPick={(id) => setSearchParams({ focus: id })}
                        />
                    </div>
                ) : matrix && fullLists ? (
                    <MatrixHeatmap
                        lists={fullLists}
                        matrix={matrix}
                        onPick={(i, j) => navigate(`/lists/compare?ids=${fullLists[i].id},${fullLists[j].id}`)}
                        onFocus={(i) => setSearchParams({ focus: fullLists[i].id })}
                    />
                ) : null}
            </div>
        </div>
    );
}

// ─── Subcomponents ───────────────────────────────────────────────────────

function ScopePill({ active, label, logo, onClick }: {
    active: boolean;
    label: string;
    logo?: string;
    onClick: () => void;
}) {
    const logoSrc = logo ? getSafeLogo(logo) : undefined;
    return (
        <button
            onClick={onClick}
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
            }}
        >
            {logoSrc && <img src={logoSrc} alt="" style={{ width: 16, height: 16, objectFit: 'contain', opacity: 0.85 }} onError={e => { e.currentTarget.style.display = 'none'; }} />}
            {label}
        </button>
    );
}

function MatrixHeatmap({ lists, matrix, onPick, onFocus }: {
    lists: ArmyList[];
    matrix: number[][];
    onPick: (i: number, j: number) => void;
    onFocus: (i: number) => void;
}) {
    const n = lists.length;
    const cellSize = n > 30 ? 18 : n > 15 ? 26 : 36;
    const labelW = 160;
    const labelH = 130;
    const width = labelW + n * cellSize + 8;
    const height = labelH + n * cellSize + 8;

    return (
        <div style={{ ...cardStyle, overflowX: 'auto' }}>
            <svg
                width={width}
                height={height}
                style={{ display: 'block', minWidth: width }}
                role="img"
                aria-label="List similarity matrix"
            >
                {/* Diagonal axis labels */}
                {lists.map((l, i) => {
                    const x = labelW - 6;
                    const y = labelH + i * cellSize + cellSize / 2 + 4;
                    return (
                        <g key={`row-${i}`}>
                            <text
                                x={x}
                                y={y}
                                textAnchor="end"
                                fontSize={11}
                                fill="var(--text-secondary)"
                                style={{ cursor: 'pointer' }}
                                onClick={() => onFocus(i)}
                            >
                                {truncate(l.name, 22)}
                            </text>
                        </g>
                    );
                })}
                {lists.map((l, j) => {
                    const cx = labelW + j * cellSize + cellSize / 2;
                    const cy = labelH - 6;
                    return (
                        <text
                            key={`col-${j}`}
                            x={cx}
                            y={cy}
                            textAnchor="start"
                            fontSize={11}
                            fill="var(--text-secondary)"
                            transform={`rotate(-45 ${cx} ${cy})`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => onFocus(j)}
                        >
                            {truncate(l.name, 22)}
                        </text>
                    );
                })}

                {/* Cells */}
                {matrix.map((row, i) => row.map((sim, j) => {
                    const x = labelW + j * cellSize;
                    const y = labelH + i * cellSize;
                    const isDiag = i === j;
                    return (
                        <g key={`c-${i}-${j}`}>
                            <rect
                                x={x}
                                y={y}
                                width={cellSize - 1}
                                height={cellSize - 1}
                                fill={cellColor(sim, isDiag)}
                                stroke="var(--bg-secondary)"
                                strokeWidth={1}
                                style={{ cursor: isDiag ? 'default' : 'pointer' }}
                                onClick={isDiag ? undefined : () => onPick(i, j)}
                            >
                                <title>
                                    {isDiag
                                        ? `${lists[i].name} (self)`
                                        : `${lists[i].name} ↔ ${lists[j].name}: ${(sim * 100).toFixed(0)}%`}
                                </title>
                            </rect>
                            {!isDiag && cellSize >= 26 && (
                                <text
                                    x={x + cellSize / 2}
                                    y={y + cellSize / 2 + 3}
                                    textAnchor="middle"
                                    fontSize={9}
                                    fill={sim > 0.55 ? '#fff' : 'var(--text-secondary)'}
                                    style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}
                                >
                                    {Math.round(sim * 100)}
                                </text>
                            )}
                        </g>
                    );
                }))}
            </svg>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-tertiary, #64748b)' }}>
                <span>Less similar</span>
                <div style={{
                    flex: '0 0 200px',
                    height: 8,
                    borderRadius: 4,
                    background: 'linear-gradient(to right, rgba(99,102,241,0.05), rgba(99,102,241,1))',
                }} />
                <span>More similar</span>
                <span style={{ marginLeft: '1rem' }}>· Click row/column label to see "lists similar to it"</span>
            </div>
        </div>
    );
}

function RankedTable({ rows, db, onPick }: {
    rows: Array<{ list: ArmyList; sim: SimilarityResult }>;
    db: ReturnType<typeof useDatabase>;
    onPick: (id: string) => void;
}) {
    if (rows.length === 0) {
        return <div style={cardStyle}><p style={{ margin: 0, color: 'var(--text-secondary)' }}>No other lists in scope.</p></div>;
    }
    return (
        <div style={cardStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary, #64748b)' }}>
                        <th style={thStyle}>List</th>
                        <th style={thStyle}>Faction</th>
                        <th style={thNumStyle}>Composite</th>
                        <th style={thNumStyle}>Identity</th>
                        <th style={thNumStyle}>Composition</th>
                        <th style={thNumStyle}>Strategic</th>
                        <th style={thNumStyle}>Capability</th>
                        <th style={thStyle}></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ list, sim }) => {
                        const f = db.getFactionInfo(list.factionId);
                        return (
                            <tr key={list.id} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={tdStyle}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{list.name}</span>
                                </td>
                                <td style={{ ...tdStyle, color: 'var(--accent)', fontWeight: 600 }}>
                                    {f?.shortName || f?.name || `#${list.factionId}`}
                                </td>
                                <td style={tdNumStrong}>{Math.round(sim.composite * 100)}%</td>
                                <td style={tdNum(sim.weights.identity)}>{Math.round(sim.components.identity * 100)}</td>
                                <td style={tdNum(sim.weights.composition)}>{Math.round(sim.components.composition * 100)}</td>
                                <td style={tdNum(sim.weights.strategic)}>{Math.round(sim.components.strategic * 100)}</td>
                                <td style={tdNum(sim.weights.capability)}>{Math.round(sim.components.capability * 100)}</td>
                                <td style={tdStyle}>
                                    <button onClick={() => onPick(list.id)} style={chipBtnStyle}>Compare</button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function truncate(s: string, n: number) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function cellColor(sim: number, isDiag: boolean): string {
    if (isDiag) return 'var(--bg-tertiary)';
    // Indigo (#6366f1) at alpha = sim, on a near-zero floor
    const alpha = 0.05 + 0.95 * Math.max(0, Math.min(1, sim));
    return `rgba(99, 102, 241, ${alpha.toFixed(3)})`;
}

// ─── Styles ──────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.25rem',
};

const msgStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    padding: '3rem',
};

const chipBtnStyle: React.CSSProperties = {
    padding: '0.4rem 0.85rem',
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    borderRadius: '8px',
    fontSize: '0.8rem',
    cursor: 'pointer',
};

const filterBarStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.65rem 1rem',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
};

const thStyle: React.CSSProperties = { padding: '0.5rem 0.6rem', fontWeight: 600 };
const thNumStyle: React.CSSProperties = { ...thStyle, textAlign: 'right' };

const tdStyle: React.CSSProperties = {
    padding: '0.55rem 0.6rem',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    verticalAlign: 'middle',
};

const tdNumStrong: React.CSSProperties = {
    ...tdStyle,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 700,
    color: 'var(--text-primary)',
};

function tdNum(weight: number): React.CSSProperties {
    return {
        ...tdStyle,
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        opacity: weight === 0 ? 0.4 : 1,
    };
}

export default ListsOverviewPage;
