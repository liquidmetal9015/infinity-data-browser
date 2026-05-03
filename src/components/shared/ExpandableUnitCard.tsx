import { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Link } from 'lucide-react';
import { formatMove } from '../../utils/conversions';
import { getProfileOrders } from '../../utils/orderUtils';
import { OrderIcon } from './OrderIcon';
import type { Unit } from '@shared/types';
import { getRawForFaction } from '@shared/types';
import type { Loadout as Option, ProfileGroup, Profile } from '@shared/game-model';
import type { QueryFilter, ItemFilter } from './UnifiedSearchBar';
import { getSafeLogo } from '../../utils/assets';
import { CLASSIFICATION_LABELS, CLASSIFICATION_COLORS, isPeripheralGroup } from '../../utils/classifications';
import { WeaponTooltip } from './WeaponTooltip';

interface ExpandableUnitCardProps {
    unit: Unit;
    isExpanded: boolean;
    onToggle: () => void;
    onAddUnit?: (unit: Unit, profileGroupId: number, profileId: number, optionId: number) => void;
    onViewUnit?: (unit: Unit) => void;
    /** When true, clicking the card header selects the unit for detail view instead of expanding inline */
    detailMode?: boolean;
    searchQuery?: string;
    activeFilters?: QueryFilter[];
    isHighlighted?: boolean;
    /** Option to flash-highlight when navigated from the army list. tick changes on each request to force animation restart.
     *  profileGroupId scopes the highlight to a specific profile group so peripherals don't double-flash. */
    highlightOption?: { id: number; tick: number; profileGroupId?: number };
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    /** When provided, selects faction-specific profile data (e.g. correct AVA). */
    factionId?: number;
}

const ATTRIBUTES = [
    { key: 'move', label: 'MOV' },
    { key: 'cc', label: 'CC' },
    { key: 'bs', label: 'BS' },
    { key: 'ph', label: 'PH' },
    { key: 'wip', label: 'WIP' },
    { key: 'arm', label: 'ARM' },
    { key: 'bts', label: 'BTS' },
    { key: 'w', label: 'W' },
    { key: 's', label: 'S' },
    { key: 'ava', label: 'AVA' },
];

// ─── Shared profile section ───────────────────────────────────────────────────
// Renders stats, skills & eq summary, and option rows for one profile group.
// Used identically for the main unit and inline attached peripherals.

interface ProfileSectionProps {
    group: ProfileGroup;
    profile: Profile;
    allGroups: ProfileGroup[];
    unit: Unit;
    /** When provided, option rows are clickable and call this on select */
    onAddUnit?: (unit: Unit, profileGroupId: number, profileId: number, optionId: number) => void;
    onViewUnit?: (unit: Unit) => void;
    searchQuery?: string;
    activeFilters?: QueryFilter[];
    highlightOption?: { id: number; tick: number };
}

function ProfileSection({ group, profile, allGroups, unit, onAddUnit, onViewUnit, searchQuery, activeFilters = [], highlightOption }: ProfileSectionProps) {
    const interactive = !!(onAddUnit || onViewUnit);

    return (
        <div className="space-y-2">
            {/* Stats Row */}
            <div className="flex gap-1 p-1.5 bg-black/20 rounded-lg justify-between overflow-x-auto">
                {ATTRIBUTES.map((attr) => {
                    const rec = profile as unknown as Record<string, unknown>;
                    let val: string | number | undefined = rec[attr.key] as string | number | undefined;
                    if (attr.key === 'move' && Array.isArray(rec[attr.key])) val = formatMove(rec[attr.key] as number[]);
                    if (typeof val === 'number' && val === -1) val = '-';
                    if (attr.key === 'ava') val = val === 255 ? '∞' : val;
                    const label = attr.key === 'w' && profile.isStructure ? 'STR' : attr.label;
                    return (
                        <div key={attr.key} className="flex flex-col items-center min-w-[32px]">
                            <div className="text-[10px] font-bold text-gray-500">{label}</div>
                            <div className="font-mono text-gray-200 font-bold">{val ?? '-'}</div>
                        </div>
                    );
                })}
            </div>

            {/* Combined Skills & Equipment */}
            <div className="text-xs text-gray-400 leading-relaxed px-1">
                <span className="font-bold text-gray-500 uppercase tracking-widest mr-2 text-[10px]">Skills & Eq:</span>
                {[
                    ...(profile.skills || []).map(s => s.displayName || s.name),
                    ...(profile.equipment || []).map(e => e.name)
                ].join(' • ') || 'None'}
            </div>

            {/* Options List */}
            <div className="flex flex-col gap-1.5">
                {group.options.map((opt: Option) => {
                    const orders = getProfileOrders(profile, opt);
                    const weapons = opt.weapons || [];
                    const equipNames = (opt.equipment || []).map(e => e.name);
                    const optionModsAndSkills = (opt.skills || []).map(s => s.displayName || s.name);
                    let optName = opt.name || group.isc || unit.isc;
                    if (optionModsAndSkills.length > 0) optName = `${optName} (${optionModsAndSkills.join(', ')})`;

                    const includedPeripheralNames = (opt.includes || []).map(inc => {
                        const pg = allGroups[inc.group - 1];
                        return pg?.options[inc.option - 1]?.name ?? null;
                    }).filter((n): n is string => n !== null);

                    // Search / filter highlight
                    let matchesSearch = false;
                    if (searchQuery && searchQuery.length > 2) {
                        const q = searchQuery.toLowerCase();
                        if (
                            optName.toLowerCase().includes(q) ||
                            [...weapons.map(w => w.displayName || w.name), ...equipNames].join(' ').toLowerCase().includes(q) ||
                            optionModsAndSkills.join(' ').toLowerCase().includes(q)
                        ) matchesSearch = true;
                    }
                    if (!matchesSearch && activeFilters.length > 0) {
                        const itemFilters = activeFilters.filter(f => f.type !== 'stat') as ItemFilter[];
                        if (itemFilters.some(filter => {
                            if (filter.type === 'weapon') return opt.weapons?.some(w => w.id === filter.baseId);
                            if (filter.type === 'skill') return opt.skills?.some(s => s.id === filter.baseId) || profile.skills?.some(s => s.id === filter.baseId);
                            if (filter.type === 'equipment') return opt.equipment?.some(e => e.id === filter.baseId) || profile.equipment?.some(e => e.id === filter.baseId);
                            return false;
                        })) matchesSearch = true;
                    }

                    const isThisOptionHighlighted = highlightOption?.id === opt.id;
                    return (
                        <div
                            key={isThisOptionHighlighted ? `h-${opt.id}-t${highlightOption!.tick}` : `opt-${opt.id}`}
                            onClick={(e) => {
                                if (onAddUnit) { e.stopPropagation(); onAddUnit(unit, group.id, profile.id, opt.id); }
                                else if (onViewUnit) { e.stopPropagation(); onViewUnit(unit); }
                            }}
                            className={`group relative flex items-stretch border rounded-md overflow-hidden transition-colors ${interactive ? 'cursor-pointer ' : ''}${matchesSearch ? 'bg-blue-500/10 border-blue-500/50 hover:bg-blue-500/20' : 'bg-black/10 border-white/5 hover:bg-black/30 hover:border-white/10'} ${isThisOptionHighlighted ? 'option-row-highlighted' : ''}`}
                        >
                            <div className="flex items-center justify-center px-3 bg-black/20 border-r border-white/5">
                                {orders.map((o, i) => (
                                    <OrderIcon key={i} type={o} size={16} className={i > 0 ? '-ml-1' : ''} />
                                ))}
                            </div>
                            <div className="flex-1 px-2.5 py-2.5 flex items-center gap-1.5 min-w-0 flex-wrap">
                                <span className="font-bold text-gray-100 text-xs whitespace-nowrap">{optName}</span>
                                <span className="text-gray-200 text-xs">
                                    {weapons.length > 0
                                        ? weapons.map((w, i) => (
                                            <span key={w.id}>
                                                {i > 0 && ', '}
                                                <WeaponTooltip weaponId={w.id}>{w.displayName || w.name}</WeaponTooltip>
                                            </span>
                                        ))
                                        : '—'}
                                </span>
                                {equipNames.length > 0 && (
                                    <>
                                        <span className="text-gray-500 flex-shrink-0 text-xs">|</span>
                                        <span className="text-gray-300 text-xs truncate">{equipNames.join(', ')}</span>
                                    </>
                                )}
                                {includedPeripheralNames.length > 0 && (
                                    <>
                                        <span className="text-gray-500 flex-shrink-0 text-xs">||</span>
                                        <span className="text-xs flex-shrink-0 font-medium" style={{ color: CLASSIFICATION_COLORS[5] }}>
                                            {includedPeripheralNames.join(', ')}
                                        </span>
                                    </>
                                )}
                            </div>
                            <div className="flex flex-col items-center justify-center p-2 border-l border-white/5 bg-black/10 min-w-[50px]">
                                <div className="text-[10px] text-gray-500 font-bold">SWC</div>
                                <div className="font-mono text-yellow-500/90 text-sm">{opt.swc}</div>
                            </div>
                            <div className="flex flex-col items-center justify-center p-2 border-l border-white/5 bg-black/10 min-w-[50px]">
                                <div className="text-[10px] text-gray-500 font-bold">PTS</div>
                                <div className="font-mono text-blue-400 text-sm font-bold">{opt.points}</div>
                            </div>
                            {onViewUnit && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onViewUnit(unit); }}
                                    className="flex items-center justify-center px-3 bg-black/20 hover:bg-white/10 border-l border-white/5 text-gray-500 hover:text-white transition-colors"
                                >
                                    <Eye size={16} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function ExpandableUnitCard({ unit, isExpanded, onToggle, onAddUnit, onViewUnit, detailMode, searchQuery, activeFilters = [], isHighlighted, highlightOption, onMouseEnter, onMouseLeave, factionId }: ExpandableUnitCardProps) {
    const [activeGroupIndex, setActiveGroupIndex] = useState(0);

    const profileGroups = getRawForFaction(unit, factionId).profileGroups || [];
    const activeGroup = profileGroups[activeGroupIndex];
    const activeProfile = activeGroup?.profiles[0];

    const logoUrl = unit.raw.logo;
    const logoPath = getSafeLogo(logoUrl) ?? `${import.meta.env.BASE_URL}logos/units/${unit.raw.slug}-1-1.svg`;

    const peripheralGroups = profileGroups.filter((_, idx) => isPeripheralGroup(unit, idx));

    return (
        <div
            className={`overflow-hidden rounded-lg border text-sm transition-all duration-200 ${isExpanded ? 'border-blue-500/50 bg-[#0f172a]' : 'border-white/5 bg-[#162032] hover:border-white/20'} ${isHighlighted ? 'ring-2 ring-yellow-400/80 shadow-[0_0_15px_rgba(250,204,21,0.2)]' : ''}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Card Header (Always Visible) */}
            <div
                className={`flex items-center justify-between px-3 py-2 cursor-pointer ${detailMode && onViewUnit ? 'hover:bg-white/5' : ''} ${isExpanded ? 'bg-blue-500/10 border-b border-blue-500/20' : ''}`}
                onClick={detailMode && onViewUnit ? () => onViewUnit(unit) : onToggle}
            >
                <div className="flex items-center gap-3">
                    {logoPath ? (
                        <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                            <img src={logoPath} alt={unit.isc} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        </div>
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-gray-500 text-xs font-bold">{unit.isc[0]}</span>
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-gray-100 tracking-wide leading-tight">{unit.isc}</span>
                            {activeProfile?.unitType != null && CLASSIFICATION_LABELS[activeProfile.unitType] && (
                                <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                                    style={{
                                        color: CLASSIFICATION_COLORS[activeProfile.unitType],
                                        background: `${CLASSIFICATION_COLORS[activeProfile.unitType]}15`,
                                        border: `1px solid ${CLASSIFICATION_COLORS[activeProfile.unitType]}30`
                                    }}
                                >
                                    {CLASSIFICATION_LABELS[activeProfile.unitType]}
                                </span>
                            )}
                        </div>
                        <div className="font-mono text-sm text-blue-400 mt-0.5">
                            {unit.pointsRange[0] === unit.pointsRange[1] ? `${unit.pointsRange[0]} pts` : `${unit.pointsRange[0]} - ${unit.pointsRange[1]} pts`}
                        </div>
                    </div>
                </div>
                <div className="text-gray-500">
                    {detailMode ? <Eye size={16} /> : (isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />)}
                </div>
            </div>

            {/* Expanded Body */}
            {isExpanded && activeGroup && activeProfile && (
                <div className="flex flex-col">
                    {/* Profile group tabs — peripheral groups are shown inline below, not as tabs */}
                    {profileGroups.filter((_, idx) => !isPeripheralGroup(unit, idx)).length > 1 && (
                        <div className="flex gap-2 px-3 pt-2 bg-[#0a0f18]">
                            {profileGroups.map((group, idx) => {
                                if (isPeripheralGroup(unit, idx)) return null;
                                return (
                                    <button
                                        key={group.id}
                                        onClick={(e) => { e.stopPropagation(); setActiveGroupIndex(idx); }}
                                        className={`px-3 py-1 text-xs font-bold rounded-t-lg transition-all ${activeGroupIndex === idx
                                            ? 'bg-[#0f172a] text-blue-400 border-t border-x border-blue-500/20 shadow-[0_-4px_10px_-5px_rgba(59,130,246,0.2)]'
                                            : 'bg-[#162032] text-gray-500 border-t border-x border-transparent hover:text-gray-300'
                                            }`}
                                    >
                                        {group.isc || `PROFILE ${idx + 1}`}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="p-2 space-y-2">
                        {/* Main unit profile */}
                        <ProfileSection
                            group={activeGroup}
                            profile={activeProfile}
                            allGroups={profileGroups}
                            unit={unit}
                            onAddUnit={onAddUnit}
                            onViewUnit={onViewUnit}
                            searchQuery={searchQuery}
                            activeFilters={activeFilters}
                            highlightOption={highlightOption && (highlightOption.profileGroupId == null || highlightOption.profileGroupId === activeGroup.id) ? highlightOption : undefined}
                        />

                        {/* Attached peripherals — same layout as main unit */}
                        {peripheralGroups.map(pg => {
                            const pProfile = pg.profiles[0];
                            if (!pProfile) return null;
                            const typeLabel = CLASSIFICATION_LABELS[pProfile.unitType];
                            const typeColor = CLASSIFICATION_COLORS[pProfile.unitType];
                            return (
                                <div key={pg.id} className="border-t border-white/10 pt-4 space-y-3">
                                    {/* Peripheral sub-header — mirrors card header name style */}
                                    <div className="flex items-center gap-2 px-1">
                                        <span className="font-bold text-base text-gray-100 tracking-wide leading-tight">
                                            {pg.isc || pProfile.name}
                                        </span>
                                        {typeLabel && (
                                            <span
                                                className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                                                style={{ color: typeColor, background: `${typeColor}15`, border: `1px solid ${typeColor}30` }}
                                            >
                                                {typeLabel}
                                            </span>
                                        )}
                                        <span className="text-[10px] font-medium text-blue-400/70 flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                                            <Link size={9} /> Attached
                                        </span>
                                    </div>

                                    <ProfileSection
                                        group={pg}
                                        profile={pProfile}
                                        allGroups={profileGroups}
                                        unit={unit}
                                        highlightOption={highlightOption && highlightOption.profileGroupId === pg.id ? highlightOption : undefined}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
