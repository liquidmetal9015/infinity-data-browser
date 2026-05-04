import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
    Legend,
} from 'recharts';
import { useDatabase } from '../hooks/useDatabase';
import { listService } from '../services/listService';
import {
    listSimilarity, scoreFromList, breakdownVector, unitDiff, capabilityDiff,
    pointsByUnitType, roleDistribution, UNIT_TYPE_LABELS, ROLE_LABELS,
    SAME_FACTION_WEIGHTS, CROSS_FACTION_WEIGHTS,
} from '@shared/list-similarity';
import type { CapabilityDiffEntry } from '@shared/list-similarity';
import type { ArmyList } from '@shared/listTypes';
import { getSafeLogo } from '../utils/assets';
import type { UnitRole } from '@shared/unit-roles';

const RADAR_AXES = ['Offense', 'Defense', 'Orders', 'Specialists', 'Mobility', 'Classifieds'] as const;
const COLOR_A = '#6366f1'; // indigo
const COLOR_B = '#F29107'; // orange (matches Army accent)

interface Props {
    ids?: [string, string];
}

export function ListsComparePage({ ids: idsProp }: Props = {}) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const db = useDatabase();

    const ids = useMemo<[string, string] | null>(() => {
        if (idsProp) return idsProp;
        const raw = searchParams.get('ids');
        if (!raw) return null;
        const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
        return parts.length === 2 ? [parts[0], parts[1]] : null;
    }, [idsProp, searchParams]);

    const a = useQuery<ArmyList>({
        queryKey: ['compare-list', ids?.[0]],
        queryFn: () => listService.getList(ids![0]),
        enabled: !!ids,
    });
    const b = useQuery<ArmyList>({
        queryKey: ['compare-list', ids?.[1]],
        queryFn: () => listService.getList(ids![1]),
        enabled: !!ids,
    });

    const ready = a.data && b.data && db.classifieds !== undefined;

    type Mode = 'same-faction' | 'cross-faction';
    const [userMode, setUserMode] = useState<Mode | null>(null);
    // Default mode follows the data unless the user has explicitly picked one.
    const autoMode: Mode = a.data && b.data && a.data.factionId !== b.data.factionId
        ? 'cross-faction'
        : 'same-faction';
    const mode = userMode ?? autoMode;

    const weights = mode === 'cross-faction' ? CROSS_FACTION_WEIGHTS : SAME_FACTION_WEIGHTS;

    const sim = useMemo(() => {
        if (!ready) return null;
        return listSimilarity(a.data!, b.data!, { classifieds: db.classifieds }, weights);
    }, [ready, a.data, b.data, db.classifieds, weights]);

    const capDiff = useMemo(() => {
        if (!ready) return null;
        return capabilityDiff(a.data!, b.data!);
    }, [ready, a.data, b.data]);

    const radarData = useMemo(() => {
        if (!ready) return [];
        const sa = scoreFromList(a.data!, db.classifieds);
        const sb = scoreFromList(b.data!, db.classifieds);
        const va = sa ? breakdownVector(sa) : [0, 0, 0, 0, 0, 0];
        const vb = sb ? breakdownVector(sb) : [0, 0, 0, 0, 0, 0];
        return RADAR_AXES.map((axis, i) => ({
            axis,
            A: va[i],
            B: vb[i],
            delta: va[i] - vb[i],
        }));
    }, [ready, a.data, b.data, db.classifieds]);

    const diff = useMemo(() => {
        if (!ready) return null;
        return unitDiff(a.data!, b.data!);
    }, [ready, a.data, b.data]);

    if (!ids) {
        return (
            <div style={msgStyle}>
                Pass two list IDs via <code>?ids=a,b</code>.
            </div>
        );
    }

    if (a.isLoading || b.isLoading || !ready) {
        return <div style={msgStyle}>Loading lists…</div>;
    }

    if (a.error || b.error) {
        return <div style={msgStyle}>Failed to load one or both lists.</div>;
    }

    const listA = a.data!;
    const listB = b.data!;
    const fA = db.getFactionInfo(listA.factionId);
    const fB = db.getFactionInfo(listB.factionId);
    const crossFaction = listA.factionId !== listB.factionId;

    return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 1rem', minHeight: 0 }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                            Compare Lists
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '0.2rem 0 0' }}>
                            Composite similarity score combines unit overlap, composition, and strategic profile.
                        </p>
                    </div>
                    <button onClick={() => navigate('/lists')} style={backBtnStyle}>← Back to lists</button>
                </div>

                {/* List headers + composite score */}
                <div style={cardStyle}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '1rem' }}>
                        <ListBadge list={listA} factionName={fA?.name} factionLogo={fA?.logo} color={COLOR_A} align="right" />
                        <CompositeScore sim={sim!.composite} />
                        <ListBadge list={listB} factionName={fB?.name} factionLogo={fB?.logo} color={COLOR_B} align="left" />
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
                        <SubScore label="Identity" value={sim!.components.identity} weight={sim!.weights.identity} />
                        <SubScore label="Composition" value={sim!.components.composition} weight={sim!.weights.composition} />
                        <SubScore label="Strategic" value={sim!.components.strategic} weight={sim!.weights.strategic} />
                        <SubScore label="Capability" value={sim!.components.capability} weight={sim!.weights.capability} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                        <ModeToggle mode={mode} onChange={setUserMode} crossFactionDetected={crossFaction} />
                    </div>
                </div>

                {/* Radar overlay */}
                <Section title="Strategic Profile">
                    <div style={{ width: '100%', height: 360 }}>
                        <ResponsiveContainer>
                            <RadarChart data={radarData} margin={{ top: 16, right: 32, left: 32, bottom: 16 }}>
                                <PolarGrid stroke="var(--border)" />
                                <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'var(--text-tertiary, #64748b)', fontSize: 10 }} />
                                <Radar name={listA.name} dataKey="A" stroke={COLOR_A} fill={COLOR_A} fillOpacity={0.3} />
                                <Radar name={listB.name} dataKey="B" stroke={COLOR_B} fill={COLOR_B} fillOpacity={0.3} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Tooltip contentStyle={tooltipStyle} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </Section>

                {/* Delta bars */}
                <Section title="Per-Axis Delta">
                    <p style={hintStyle}>
                        Bars to the right favor <span style={{ color: COLOR_A, fontWeight: 'var(--font-semibold)' }}>{listA.name}</span>;
                        to the left favor <span style={{ color: COLOR_B, fontWeight: 'var(--font-semibold)' }}>{listB.name}</span>.
                    </p>
                    <div style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer>
                            <BarChart data={radarData} layout="vertical" margin={{ top: 8, right: 24, left: 60, bottom: 8 }}>
                                <XAxis
                                    type="number"
                                    domain={[-100, 100]}
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="axis"
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                    width={80}
                                />
                                <Tooltip contentStyle={tooltipStyle} />
                                <ReferenceLine x={0} stroke="var(--border)" />
                                <Bar dataKey="delta">
                                    {radarData.map((d, i) => (
                                        <Cell key={i} fill={d.delta >= 0 ? COLOR_A : COLOR_B} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Section>

                {/* Unit diff columns */}
                <Section title="Units">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <DiffColumn
                            heading={`Only in ${listA.name}`}
                            entries={diff!.onlyInA}
                            color={COLOR_A}
                            showCount="A"
                        />
                        <DiffColumn
                            heading="Shared"
                            entries={diff!.shared}
                            color="var(--text-secondary)"
                            showCount="both"
                        />
                        <DiffColumn
                            heading={`Only in ${listB.name}`}
                            entries={diff!.onlyInB}
                            color={COLOR_B}
                            showCount="B"
                        />
                    </div>
                </Section>

                {/* Capability tag-cloud diff */}
                <Section title="Capabilities">
                    <p style={hintStyle}>
                        Weapons, skills, and equipment carried by each list. Chip size reflects
                        points-weighted contribution. Cross-faction comparison hinges on this view —
                        Smoke Grenades and Hackers mean the same thing in any faction.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <CapabilityTagCloud
                            heading={`Only in ${listA.name}`}
                            entries={capDiff!.onlyInA}
                            color={COLOR_A}
                            db={db}
                            side="A"
                        />
                        <CapabilityTagCloud
                            heading="Shared"
                            entries={capDiff!.shared}
                            color="var(--text-secondary)"
                            db={db}
                            side="both"
                        />
                        <CapabilityTagCloud
                            heading={`Only in ${listB.name}`}
                            entries={capDiff!.onlyInB}
                            color={COLOR_B}
                            db={db}
                            side="B"
                        />
                    </div>
                </Section>

                {/* Composition bars */}
                <Section title="Composition">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <CompositionPanel title="Points by Unit Type" listA={listA} listB={listB} />
                        <RolePanel title="Primary Role Distribution" listA={listA} listB={listB} />
                    </div>
                </Section>

            </div>
        </div>
    );
}

// ─── Subcomponents ───────────────────────────────────────────────────────

function ListBadge({ list, factionName, factionLogo, color, align }: {
    list: ArmyList;
    factionName?: string;
    factionLogo?: string;
    color: string;
    align: 'left' | 'right';
}) {
    const logoSrc = factionLogo ? getSafeLogo(factionLogo) : undefined;
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        }}>
            {align === 'left' && logoSrc && <FactionLogo src={logoSrc} />}
            <div style={{ textAlign: align }}>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
                    {list.name}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: color, fontWeight: 'var(--font-semibold)' }}>
                    {factionName ?? `Faction ${list.factionId}`}
                </div>
            </div>
            {align === 'right' && logoSrc && <FactionLogo src={logoSrc} />}
        </div>
    );
}

function FactionLogo({ src }: { src: string }) {
    return (
        <img
            src={src}
            alt=""
            style={{ width: 44, height: 44, objectFit: 'contain', opacity: 0.9 }}
            onError={e => { e.currentTarget.style.display = 'none'; }}
        />
    );
}

function CompositeScore({ sim }: { sim: number }) {
    const pct = Math.round(sim * 100);
    return (
        <div style={{ textAlign: 'center', padding: '0 1rem' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                {pct}<span style={{ fontSize: 'var(--text-xl)', color: 'var(--text-secondary)' }}>%</span>
            </div>
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-tertiary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>
                Similarity
            </div>
        </div>
    );
}

function SubScore({ label, value, weight }: { label: string; value: number; weight: number }) {
    const pct = Math.round(value * 100);
    const dim = weight === 0;
    return (
        <div
            title={dim ? `${label} — disabled (weight 0)` : `${label} — weight ${(weight * 100).toFixed(0)}%`}
            style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '20px',
                fontSize: 'var(--text-sm)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: dim ? 'var(--text-tertiary, #64748b)' : 'var(--text-secondary)',
                opacity: dim ? 0.5 : 1,
            }}
        >
            <span style={{ fontWeight: 'var(--font-semibold)' }}>{label}</span>
            <span style={{ marginLeft: '0.5rem', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{pct}%</span>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={cardStyle}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', margin: '0 0 0.75rem' }}>
                {title}
            </h2>
            {children}
        </div>
    );
}

function DiffColumn({ heading, entries, color, showCount }: {
    heading: string;
    entries: import('@shared/list-similarity').DiffEntry[];
    color: string;
    showCount: 'A' | 'B' | 'both';
}) {
    return (
        <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                {heading} <span style={{ color: 'var(--text-tertiary, #64748b)', fontWeight: 'var(--font-medium)' }}>({entries.length})</span>
            </div>
            {entries.length === 0 ? (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary, #64748b)', fontStyle: 'italic' }}>
                    None
                </div>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {entries.map(e => (
                        <li key={e.key} style={{
                            padding: '0.4rem 0.6rem',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-secondary)',
                        }}>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 'var(--font-semibold)' }}>
                                {showCount === 'both' ? <CountChip a={e.countA} b={e.countB} /> : (e.countA + e.countB > 1 ? `${e.countA + e.countB}× ` : '')}
                                {e.unitName}
                            </div>
                            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-tertiary, #64748b)' }}>
                                {e.optionName} · {e.points}pts
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function ModeToggle({ mode, onChange, crossFactionDetected }: {
    mode: 'same-faction' | 'cross-faction';
    onChange: (m: 'same-faction' | 'cross-faction') => void;
    crossFactionDetected: boolean;
}) {
    const opt = (key: 'same-faction' | 'cross-faction', label: string) => {
        const active = mode === key;
        return (
            <button
                key={key}
                onClick={() => onChange(key)}
                style={{
                    padding: '0.35rem 0.85rem',
                    border: 'none',
                    background: active ? 'var(--accent, #6366f1)' : 'transparent',
                    color: active ? '#fff' : 'var(--text-secondary)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-semibold)',
                    cursor: 'pointer',
                    borderRadius: '6px',
                }}
            >
                {label}
            </button>
        );
    };
    return (
        <div
            title={crossFactionDetected
                ? 'Lists are from different factions — cross-faction mode auto-selected'
                : 'Lists share a faction — same-faction mode auto-selected'}
            style={{
                display: 'inline-flex',
                gap: '0.25rem',
                padding: '0.25rem',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
            }}
        >
            {opt('same-faction', 'Same-faction weighting')}
            {opt('cross-faction', 'Cross-faction weighting')}
        </div>
    );
}

function CapabilityTagCloud({ heading, entries, color, db, side }: {
    heading: string;
    entries: CapabilityDiffEntry[];
    color: string;
    db: ReturnType<typeof useDatabase>;
    side: 'A' | 'B' | 'both';
}) {
    const maxWeight = useMemo(() => {
        let m = 0;
        for (const e of entries) m = Math.max(m, e.weightA, e.weightB);
        return m || 1;
    }, [entries]);

    const resolveName = (e: CapabilityDiffEntry): string => {
        const map = e.kind === 'weapon' ? db.weaponMap
            : e.kind === 'skill' ? db.skillMap
                : db.equipmentMap;
        return map.get(e.id) ?? `${e.kind} #${e.id}`;
    };

    const kindGlyph: Record<CapabilityDiffEntry['kind'], string> = {
        weapon: '⚔', skill: '★', equipment: '◆',
    };

    return (
        <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                {heading} <span style={{ color: 'var(--text-tertiary, #64748b)', fontWeight: 'var(--font-medium)' }}>({entries.length})</span>
            </div>
            {entries.length === 0 ? (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary, #64748b)', fontStyle: 'italic' }}>
                    None
                </div>
            ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {entries.map(e => {
                        const weight = side === 'A' ? e.weightA : side === 'B' ? e.weightB : (e.weightA + e.weightB);
                        // Font scales between 0.7rem (min) and 0.95rem (max) by relative weight.
                        const scale = 0.7 + 0.25 * Math.min(1, weight / maxWeight);
                        return (
                            <span
                                key={e.key}
                                title={`${kindGlyph[e.kind]} ${resolveName(e)} · weight ${weight}`}
                                style={{
                                    padding: '0.2rem 0.55rem',
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '14px',
                                    fontSize: `${scale}rem`,
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <span style={{ color, marginRight: '0.3rem', fontSize: '0.7em' }}>{kindGlyph[e.kind]}</span>
                                {resolveName(e)}
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function CountChip({ a, b }: { a: number; b: number }) {
    if (a === 1 && b === 1) return null;
    return (
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-tertiary, #64748b)', marginRight: '0.35rem', fontVariantNumeric: 'tabular-nums' }}>
            {a}vs{b}
        </span>
    );
}

function CompositionPanel({ title, listA, listB }: { title: string; listA: ArmyList; listB: ArmyList }) {
    const data = useMemo(() => {
        const pa = pointsByUnitType(listA);
        const pb = pointsByUnitType(listB);
        const allTypes = new Set([...Object.keys(pa), ...Object.keys(pb)].map(Number));
        return Array.from(allTypes).sort((x, y) => x - y).map(t => ({
            type: UNIT_TYPE_LABELS[t] ?? `T${t}`,
            A: pa[t] ?? 0,
            B: pb[t] ?? 0,
        }));
    }, [listA, listB]);
    return (
        <div>
            <div style={panelTitleStyle}>{title}</div>
            <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                    <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                        <XAxis dataKey="type" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="A" name={listA.name} fill={COLOR_A} />
                        <Bar dataKey="B" name={listB.name} fill={COLOR_B} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function RolePanel({ title, listA, listB }: { title: string; listA: ArmyList; listB: ArmyList }) {
    const data = useMemo(() => {
        const ra = roleDistribution(listA);
        const rb = roleDistribution(listB);
        const roles = (Object.keys(ROLE_LABELS) as UnitRole[]).filter(r => (ra[r] ?? 0) + (rb[r] ?? 0) > 0);
        return roles.map(r => ({
            role: ROLE_LABELS[r],
            A: ra[r] ?? 0,
            B: rb[r] ?? 0,
        }));
    }, [listA, listB]);
    return (
        <div>
            <div style={panelTitleStyle}>{title}</div>
            <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                    <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                        <XAxis dataKey="role" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                        <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="A" name={listA.name} fill={COLOR_A} />
                        <Bar dataKey="B" name={listB.name} fill={COLOR_B} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
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
};

const panelTitleStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--font-semibold)',
    color: 'var(--text-secondary)',
    marginBottom: '0.5rem',
};

const hintStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-tertiary, #64748b)',
    margin: '0 0 0.5rem',
};

const tooltipStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: 'var(--text-sm)',
};

const backBtnStyle: React.CSSProperties = {
    padding: '0.4rem 0.85rem',
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    borderRadius: '8px',
    fontSize: 'var(--text-sm)',
    cursor: 'pointer',
};

export default ListsComparePage;
