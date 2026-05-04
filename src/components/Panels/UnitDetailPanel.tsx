import { useState, useEffect, useRef } from 'react';
import { Shield, Crosshair, Zap, Activity, Info, Link } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';
import { useListStore } from '../../stores/useListStore';
import { useListBuilderUIStore } from '../../stores/useListBuilderUIStore';
import { formatMove } from '../../utils/conversions';
import { CLASSIFICATION_LABELS, CLASSIFICATION_COLORS } from '../../utils/classifications';
import type { ProfileGroup, Profile, Loadout } from '@shared/game-model';
import { getRawForFaction } from '@shared/types';
import { WeaponTooltip } from '../shared/WeaponTooltip';

const ATTRIBUTES = [
    { key: 'move', label: 'MOV', icon: <Activity size={14} /> },
    { key: 'cc', label: 'CC', icon: <Crosshair size={14} /> },
    { key: 'bs', label: 'BS', icon: <Crosshair size={14} /> },
    { key: 'ph', label: 'PH', icon: <Activity size={14} /> },
    { key: 'wip', label: 'WIP', icon: <Zap size={14} /> },
    { key: 'arm', label: 'ARM', icon: <Shield size={14} /> },
    { key: 'bts', label: 'BTS', icon: <Shield size={14} /> },
    { key: 'w', label: 'W', icon: <Activity size={14} /> },
    { key: 's', label: 'S', icon: <Activity size={14} /> },
    { key: 'ava', label: 'AVA', icon: <Info size={14} /> },
];

const FACTION_BADGE_COLLAPSE_THRESHOLD = 3;

// True when the human-readable name and the canonical ISC are meaningfully
// different. Most units have name === isc up to whitespace/case/punctuation,
// in which case showing both is just visual noise.
function namesDiffer(name: string, isc: string): boolean {
    const norm = (s: string) => s.toLowerCase().replace(/[\s.,()]/g, '');
    return norm(name) !== norm(isc);
}

interface FactionBadgesProps {
    factionIds: number[];
    getFactionName: (id: number) => string;
}

function FactionBadges({ factionIds, getFactionName }: FactionBadgesProps) {
    const [expanded, setExpanded] = useState(false);
    const collapsed = factionIds.length > FACTION_BADGE_COLLAPSE_THRESHOLD && !expanded;
    const visible = collapsed ? factionIds.slice(0, FACTION_BADGE_COLLAPSE_THRESHOLD) : factionIds;
    const hidden = factionIds.length - visible.length;

    return (
        <div className="flex flex-wrap gap-2">
            {visible.map(fid => (
                <span key={fid} className="text-[length:var(--text-2xs)] font-bold text-gray-500 uppercase tracking-widest px-2 py-0.5 rounded-full bg-black/20 border border-white/5">
                    {getFactionName(fid)}
                </span>
            ))}
            {collapsed && (
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="text-[length:var(--text-2xs)] font-bold text-gray-400 uppercase tracking-widest px-2 py-0.5 rounded-full bg-black/20 border border-white/10 hover:bg-white/10 hover:text-gray-200 transition-colors"
                >
                    +{hidden} more
                </button>
            )}
            {!collapsed && factionIds.length > FACTION_BADGE_COLLAPSE_THRESHOLD && (
                <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="text-[length:var(--text-2xs)] font-bold text-gray-400 uppercase tracking-widest px-2 py-0.5 rounded-full bg-black/20 border border-white/10 hover:bg-white/10 hover:text-gray-200 transition-colors"
                >
                    show less
                </button>
            )}
        </div>
    );
}

// ─── Shared profile body ──────────────────────────────────────────────────────
// Renders stats, skills, equipment, and loadout table for one profile group.
// Used for both the main unit and inline attached peripherals.

interface ProfileBodyProps {
    group: ProfileGroup;
    profile: Profile;
    allGroups: ProfileGroup[];       // needed to resolve includes references
    onAddLoadout?: (optionId: number) => void; // omit to make loadout rows non-interactive
    highlightedOptionId?: number | null;
    highlightTick?: number;
    getWikiLink: (type: 'skill' | 'equipment', id: number) => string | undefined;
    compact?: boolean;
}

function ProfileBody({ group, profile, allGroups, onAddLoadout, highlightedOptionId, highlightTick, getWikiLink, compact = false }: ProfileBodyProps) {
    const interactive = !!onAddLoadout;
    const rowPadY = compact ? '0.75rem' : '2.5rem';

    return (
        <>
            {/* Stats Grid */}
            <div className={`grid grid-cols-10 ${compact ? 'gap-1 p-1.5' : 'gap-1.5 p-2.5'} rounded-xl bg-[#0f172a] border border-white/5`}>
                {ATTRIBUTES.map((attr) => {
                    const rec = profile as unknown as Record<string, unknown>;
                    let val: string | number | undefined = rec[attr.key] as string | number | undefined;
                    if (attr.key === 'move' && Array.isArray(rec[attr.key])) val = formatMove(rec[attr.key] as number[]);
                    if (typeof val === 'number' && val === -1) val = '-';
                    if (attr.key === 'ava') val = val === 255 ? '∞' : val;
                    const label = attr.key === 'w' && profile.isStructure ? 'STR' : attr.label;
                    return (
                        <div key={attr.key} className={`flex flex-col items-center ${compact ? 'gap-0' : 'gap-1'}`}>
                            <span className="text-[length:var(--text-2xs)] font-bold text-gray-500 uppercase tracking-[0.15em]">{label}</span>
                            <span className={`${compact ? 'text-base' : 'text-lg'} font-bold text-gray-100 font-mono tracking-tight`}>{val ?? '-'}</span>
                        </div>
                    );
                })}
            </div>

            {/* Special Skills & Equipment */}
            <div className={`grid grid-cols-1 ${compact ? 'gap-1.5' : 'gap-3'}`}>
                <div className={compact ? 'space-y-1' : 'space-y-2'}>
                    <h3 className={`text-[length:var(--text-2xs)] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 ${compact ? 'pb-1' : 'pb-2'} border-b border-white/5`}>
                        <Zap size={12} className="text-yellow-500/80" />
                        Special Skills
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {profile.skills?.map((s, i) => {
                            const wikiLink = getWikiLink('skill', s.id);
                            const content = s.displayName || s.name;
                            return (
                                <span key={i} className="inline-flex items-center px-2 py-1 bg-[#162032] border border-white/5 rounded-md text-xs text-gray-300 transition-colors hover:border-white/10 hover:bg-[#1e293b]">
                                    {wikiLink ? (
                                        <a href={wikiLink} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline decoration-white/30 underline-offset-2">
                                            {content}
                                        </a>
                                    ) : content}
                                </span>
                            );
                        })}
                        {(!profile.skills || profile.skills.length === 0) &&
                            <span className="text-gray-600 text-xs italic">None</span>
                        }
                    </div>
                </div>
                <div className={compact ? 'space-y-1' : 'space-y-2'}>
                    <h3 className={`text-[length:var(--text-2xs)] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 ${compact ? 'pb-1' : 'pb-2'} border-b border-white/5`}>
                        <Shield size={12} className="text-blue-500/80" />
                        Equipment
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {profile.equipment?.map((e, i) => {
                            const wikiLink = getWikiLink('equipment', e.id);
                            return (
                                <span key={i} className="inline-flex items-center px-2 py-1 bg-[#162032] border border-white/5 rounded-md text-xs text-gray-300 transition-colors hover:border-white/10 hover:bg-[#1e293b]">
                                    {wikiLink ? (
                                        <a href={wikiLink} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline decoration-white/30 underline-offset-2">
                                            {e.name}
                                        </a>
                                    ) : e.name}
                                </span>
                            );
                        })}
                        {(!profile.equipment || profile.equipment.length === 0) &&
                            <span className="text-gray-600 text-xs italic">None</span>
                        }
                    </div>
                </div>
            </div>

            {/* Profile Options */}
            <div className={compact ? 'space-y-1' : 'space-y-2'}>
                <h3 className={`text-[length:var(--text-2xs)] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 ${compact ? 'pb-1' : 'pb-2'} border-b border-white/5`}>
                    <Crosshair size={12} className="text-red-500/80" />
                    Profile Options
                </h3>
                <div className="border border-white/5 rounded-lg overflow-hidden bg-[#0f172a]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#162032] border-b border-white/5">
                            <tr>
                                <th className="text-[length:var(--text-2xs)] font-bold text-gray-500 uppercase tracking-wider" style={{ padding: '0.5rem 0.5rem 0.5rem 0.75rem' }}>Profile</th>
                                <th className="text-[length:var(--text-2xs)] font-bold text-gray-500 uppercase tracking-wider" style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>SWC</th>
                                <th className="text-[length:var(--text-2xs)] font-bold text-gray-500 uppercase tracking-wider" style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Pts</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {group.options.map((opt: Loadout, idx: number) => {
                                const optMods = (opt.skills || []).map((s) => s.displayName || s.name);
                                let optName = opt.name || group.isc;
                                if (optMods.length > 0) optName = `${optName} (${optMods.join(', ')})`;
                                const includedPeripheralNames = (opt.includes || []).map(inc => {
                                    const pg = allGroups[inc.group - 1];
                                    return pg?.options[inc.option - 1]?.name ?? null;
                                }).filter((n): n is string => n !== null);
                                const isHighlighted = highlightedOptionId === opt.id;
                                return (
                                    <tr
                                        key={isHighlighted ? `h-${opt.id}-t${highlightTick}` : `opt-${idx}`}
                                        className={`${interactive ? 'transition-colors hover:bg-blue-500/10 cursor-pointer' : ''} ${isHighlighted ? 'option-row-highlighted' : ''}`}
                                        onClick={interactive ? () => onAddLoadout!(opt.id) : undefined}
                                    >
                                        <td style={{ padding: `${rowPadY} 1rem ${rowPadY} 0.75rem`, verticalAlign: 'middle' }}>
                                            <div className={`text-base font-bold text-gray-100 ${compact ? 'mb-1' : 'mb-2'} tracking-wide`}>{optName}</div>
                                            <div className="flex items-center flex-wrap gap-x-2 text-sm">
                                                <span className="text-gray-200">
                                                    {(opt.weapons || []).length ? (opt.weapons || []).map((w, i) => (
                                                        <span key={w.id}>
                                                            {i > 0 && ', '}
                                                            <WeaponTooltip weaponId={w.id}>{w.displayName || w.name}</WeaponTooltip>
                                                        </span>
                                                    )) : '—'}
                                                </span>
                                                {(opt.equipment?.length ?? 0) > 0 && (
                                                    <>
                                                        <span className="text-gray-500">|</span>
                                                        <span className="text-gray-300">{opt.equipment!.map(e => e.name).join(', ')}</span>
                                                    </>
                                                )}
                                                {includedPeripheralNames.length > 0 && (
                                                    <>
                                                        <span className="text-gray-500">||</span>
                                                        <span className="font-medium" style={{ color: '#22c55ecc' }}>{includedPeripheralNames.join(', ')}</span>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: `${rowPadY} 1rem`, verticalAlign: 'middle', textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-md)', color: '#9ca3af' }}>{opt.swc}</td>
                                        <td style={{ padding: `${rowPadY} 1rem`, verticalAlign: 'middle', textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-md)', fontWeight: 'var(--font-bold)', color: '#60a5fa' }}>{opt.points}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function UnitDetailPanel() {
    const db = useDatabase();
    const unit = useListBuilderUIStore(s => s.selectedUnitForDetail);
    const selectedProfileGroupId = useListBuilderUIStore(s => s.selectedProfileGroupId);
    const selectedOptionId = useListBuilderUIStore(s => s.selectedOptionId);
    const detailFactionId = useListBuilderUIStore(s => s.detailFactionId);
    const highlightTick = useListBuilderUIStore(s => s.highlightTick);
    const targetGroupIndex = useListBuilderUIStore(s => s.targetGroupIndex);
    const selectUnitForDetail = useListBuilderUIStore(s => s.selectUnitForDetail);
    const addUnit = useListStore(s => s.addUnit);
    const currentFactionId = useListStore(s => s.currentList?.factionId ?? null);

    // Clear the detail panel when the active list's faction no longer includes
    // the displayed unit — e.g. after switching lists or starting a new one.
    useEffect(() => {
        if (!unit) return;
        if (currentFactionId == null || !unit.factions.includes(currentFactionId)) {
            selectUnitForDetail(null);
        }
    }, [currentFactionId, unit, selectUnitForDetail]);

    const [activeGroupIndex, setActiveGroupIndex] = useState(0);
    const [highlightedGroupIndex, setHighlightedGroupIndex] = useState<number | null>(null);
    const [highlightedOptionId, setHighlightedOptionId] = useState<number | null>(null);
    const [compact, setCompact] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const peripheralSectionRefs = useRef<Map<number, HTMLElement | null>>(new Map());
    const optionHighlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Cached non-compact scrollHeight; used to decide when it's safe to exit
    // compact without oscillating.
    const intrinsicHeightRef = useRef<number>(0);

    useEffect(() => {
        if (!unit) return;
        const profileGroups = getRawForFaction(unit, detailFactionId).profileGroups || [];

        // Always reset to first non-peripheral group when the unit changes
        setActiveGroupIndex(0);

        let scrollToPeripheralId: number | null = null;

        if (selectedProfileGroupId != null) {
            const idx = profileGroups.findIndex(g => g.id === selectedProfileGroupId);
            if (idx !== -1) {
                const targetGroup = profileGroups[idx];
                // Auto-attached peripherals are shown inline — never switch the tab to them.
                // Instead, scroll down to the inline peripheral section.
                if (targetGroup.isAutoAttached) {
                    scrollToPeripheralId = selectedProfileGroupId;
                } else if (idx !== activeGroupIndex) {
                    setActiveGroupIndex(idx);
                    setHighlightedGroupIndex(idx);
                    setTimeout(() => setHighlightedGroupIndex(null), 800);
                }
            }
        }
        if (selectedOptionId != null) {
            if (optionHighlightTimeoutRef.current) clearTimeout(optionHighlightTimeoutRef.current);
            setHighlightedOptionId(selectedOptionId);
            optionHighlightTimeoutRef.current = setTimeout(() => {
                setHighlightedOptionId(null);
                optionHighlightTimeoutRef.current = null;
            }, 900);
        }

        if (scrollToPeripheralId != null) {
            const id = scrollToPeripheralId;
            requestAnimationFrame(() => {
                const el = peripheralSectionRefs.current.get(id);
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        } else {
            scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unit, selectedProfileGroupId, selectedOptionId, highlightTick]);

    // Reset compact state and intrinsic measurement when the unit or active
    // tab changes — the content shape is different so the cached intrinsic
    // height no longer applies.
    useEffect(() => {
        intrinsicHeightRef.current = 0;
        setCompact(false);
    }, [unit, activeGroupIndex, detailFactionId]);

    useEffect(() => {
        const scrollEl = scrollRef.current;
        const contentEl = contentRef.current;
        if (!scrollEl || !contentEl) return;

        const check = () => {
            setCompact(prev => {
                if (!prev) {
                    // Currently rendering full size — record intrinsic height.
                    intrinsicHeightRef.current = contentEl.scrollHeight;
                    return contentEl.scrollHeight > scrollEl.clientHeight;
                }
                // In compact mode: only exit if container is tall enough for
                // the full intrinsic height with a small safety margin.
                if (intrinsicHeightRef.current > 0 && scrollEl.clientHeight >= intrinsicHeightRef.current + 8) {
                    return false;
                }
                return true;
            });
        };

        const ro = new ResizeObserver(check);
        ro.observe(scrollEl);
        ro.observe(contentEl);
        check();
        return () => ro.disconnect();
    }, [unit, activeGroupIndex, detailFactionId]);

    if (!unit) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', padding: '2rem' }}>
                <Info size={48} style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                    Select a unit from the roster to view its details.
                </p>
            </div>
        );
    }

    const profileGroups = getRawForFaction(unit, detailFactionId).profileGroups || [];
    const activeGroup = profileGroups[activeGroupIndex] || profileGroups[0];
    const activeProfile = activeGroup?.profiles[0];

    if (!activeProfile) return null;

    // Standalone peripheral units (e.g. Palbots viewed directly) have only peripheral groups.
    // Embedded peripherals (Drumbots) are always shown inline; the active group is never one.
    const isAutoAttachedPeripheral = activeGroup.isAutoAttached;

    const handleAddLoadout = (optionId: number) => {
        addUnit(unit, targetGroupIndex, activeGroup.id, activeProfile.id, optionId);
    };

    // Peripheral profile groups to display inline below the main unit
    const inlinePeripherals = !isAutoAttachedPeripheral
        ? profileGroups.filter(pg => pg.isAutoAttached)
        : [];

    // Which profile group the current option highlight belongs to.
    // Used to route the flash animation to the right ProfileBody.
    const highlightGroupId = selectedProfileGroupId ?? activeGroup?.id;

    return (
        <div className="h-full flex flex-col overflow-hidden bg-[#0b1221]">
        <div ref={scrollRef} className="overflow-y-auto flex-1 min-h-0">
            <div ref={contentRef} className="px-3 pt-2 pb-3 space-y-2.5">
                {/* Header */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold text-white tracking-tight leading-none bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                            {unit.name.toUpperCase()}
                        </h2>
                        {namesDiffer(unit.name, unit.isc) && (
                            <span className="px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-white/5 border border-white/5 text-gray-400 tracking-wide">
                                {unit.isc}
                            </span>
                        )}
                        {isAutoAttachedPeripheral && (
                            <span className="px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400/80 tracking-wide flex items-center gap-1">
                                <Link size={10} /> Attached
                            </span>
                        )}
                    </div>
                    <FactionBadges
                        factionIds={unit.factions}
                        getFactionName={fid => db.getFactionName(fid)}
                    />
                </div>

                {/* Profile Group Tabs — auto-attached peripherals are shown inline, not as tabs */}
                {profileGroups.filter(g => !g.isAutoAttached).length > 1 && (
                    <div className="flex gap-2 border-b border-white/5 pb-2">
                        {profileGroups.map((group, idx) => {
                            if (group.isAutoAttached) return null;
                            return (
                                <button
                                    key={group.id}
                                    onClick={() => setActiveGroupIndex(idx)}
                                    className={`px-3 py-1.5 text-xs font-bold tracking-wide rounded-lg transition-all duration-200
                                        ${highlightedGroupIndex === idx
                                            ? 'bg-blue-500/20 text-blue-300 border border-blue-400/40 scale-105'
                                            : activeGroupIndex === idx
                                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                                        }`}
                                >
                                    {group.isc || `PROFILE ${idx + 1}`}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Main unit profile body */}
                <ProfileBody
                    group={activeGroup}
                    profile={activeProfile}
                    allGroups={profileGroups}
                    onAddLoadout={isAutoAttachedPeripheral ? undefined : handleAddLoadout}
                    highlightedOptionId={highlightGroupId === activeGroup.id ? highlightedOptionId : null}
                    highlightTick={highlightTick}
                    getWikiLink={(type, id) => db.getWikiLink(type, id)}
                    compact={compact}
                />

                {/* Inline attached peripherals — same layout as main unit */}
                {inlinePeripherals.map(pg => {
                    const pProfile = pg.profiles[0];
                    if (!pProfile) return null;
                    const typeLabel = CLASSIFICATION_LABELS[pProfile.unitType];
                    const typeColor = CLASSIFICATION_COLORS[pProfile.unitType];
                    return (
                        <div key={pg.id} ref={(el) => { peripheralSectionRefs.current.set(pg.id, el); }} className={`${compact ? 'space-y-2 pt-2' : 'space-y-4 pt-4'} border-t border-white/10`}>
                            {/* Peripheral header — mirrors main unit header style */}
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-xl font-bold text-white tracking-tight leading-none bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                                        {(pg.isc || pProfile.name).toUpperCase()}
                                    </h2>
                                    {typeLabel && (
                                        <span
                                            className="px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider"
                                            style={{ color: typeColor, background: `${typeColor}15`, border: `1px solid ${typeColor}30` }}
                                        >
                                            {typeLabel}
                                        </span>
                                    )}
                                    <span className="px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400/80 tracking-wide flex items-center gap-1">
                                        <Link size={10} /> Attached
                                    </span>
                                </div>
                            </div>

                            <ProfileBody
                                group={pg}
                                profile={pProfile}
                                allGroups={profileGroups}
                                highlightedOptionId={highlightGroupId === pg.id ? highlightedOptionId : null}
                                highlightTick={highlightTick}
                                getWikiLink={(type, id) => db.getWikiLink(type, id)}
                                compact={compact}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
        </div>
    );
}
