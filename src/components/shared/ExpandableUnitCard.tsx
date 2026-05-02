import { useState } from 'react';
import { ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { formatMove } from '../../utils/conversions';
import { getProfileOrders } from '../../utils/orderUtils';
import { OrderIcon } from './OrderIcon';
import type { Unit } from '@shared/types';
import type { Loadout as Option } from '@shared/game-model';
import type { QueryFilter, ItemFilter } from './UnifiedSearchBar';
import { getSafeLogo } from '../../utils/assets';
import { CLASSIFICATION_LABELS, CLASSIFICATION_COLORS, isPeripheralGroup } from '../../utils/classifications';

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
    /** Option to flash-highlight when navigated from the army list. tick changes on each request to force animation restart. */
    highlightOption?: { id: number; tick: number };
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
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
];



export function ExpandableUnitCard({ unit, isExpanded, onToggle, onAddUnit, onViewUnit, detailMode, searchQuery, activeFilters = [], isHighlighted, highlightOption, onMouseEnter, onMouseLeave }: ExpandableUnitCardProps) {
    const [activeGroupIndex, setActiveGroupIndex] = useState(0);

    const profileGroups = unit.raw.profileGroups || [];
    const activeGroup = profileGroups[activeGroupIndex];
    const activeProfile = activeGroup?.profiles[0];

    const logoUrl = unit.raw.logo;
    const logoPath = getSafeLogo(logoUrl) ?? `${import.meta.env.BASE_URL}logos/units/${unit.raw.slug}-1-1.svg`;

    return (
        <div
            className={`overflow-hidden rounded-lg border text-sm transition-all duration-200 ${isExpanded ? 'border-blue-500/50 bg-[#0f172a]' : 'border-white/5 bg-[#162032] hover:border-white/20'} ${isHighlighted ? 'ring-2 ring-yellow-400/80 shadow-[0_0_15px_rgba(250,204,21,0.2)]' : ''}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Header (Always Visible) */}
            <div
                className={`flex items-center justify-between px-4 py-3.5 cursor-pointer ${detailMode && onViewUnit ? 'hover:bg-white/5' : ''} ${isExpanded ? 'bg-blue-500/10 border-b border-blue-500/20' : ''}`}
                onClick={detailMode && onViewUnit ? () => onViewUnit(unit) : onToggle}
            >
                <div className="flex items-center gap-4">
                    {logoPath ? (
                        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center p-1 overflow-hidden flex-shrink-0">
                            <img src={logoPath} alt={unit.isc} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
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
                    {profileGroups.length > 1 && (
                        <div className="flex gap-2 px-3 pt-3 bg-[#0a0f18]">
                            {profileGroups.map((group, idx) => (
                                <button
                                    key={group.id}
                                    onClick={(e) => { e.stopPropagation(); setActiveGroupIndex(idx); }}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-t-lg transition-all ${activeGroupIndex === idx
                                        ? 'bg-[#0f172a] text-blue-400 border-t border-x border-blue-500/20 shadow-[0_-4px_10px_-5px_rgba(59,130,246,0.2)]'
                                        : 'bg-[#162032] text-gray-500 border-t border-x border-transparent hover:text-gray-300'
                                        }`}
                                >
                                    {group.isc || `PROFILE ${idx + 1}`}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="p-4 space-y-4">
                        {/* Stats Row */}
                        <div className="flex gap-4 p-3 bg-black/20 rounded-lg justify-between overflow-x-auto">
                            {ATTRIBUTES.map((attr) => {
                                const profileRecord = activeProfile as unknown as Record<string, unknown>;
                                let val: string | number | undefined = profileRecord[attr.key] as string | number | undefined;
                                if (attr.key === 'move' && Array.isArray(profileRecord[attr.key])) {
                                    val = formatMove(profileRecord[attr.key] as number[]);
                                }
                                let label = attr.label;
                                if (attr.key === 'w' && activeProfile.isStructure) label = 'STR';

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
                                ...(activeProfile.skills || []).map(s => s.displayName || s.name),
                                ...(activeProfile.equipment || []).map(e => e.name)
                            ].join(' • ') || 'None'}
                        </div>

                        {/* Profiles / Options List */}
                        <div className="flex flex-col gap-1.5">
                            {activeGroup.options.map((opt: Option) => {
                                const orders = getProfileOrders(activeProfile, opt);

                                const weapsAndEq = [
                                    ...(opt.weapons || []).map(w => w.displayName || w.name),
                                    ...(opt.equipment || []).map(e => e.name)
                                ];

                                const optionModsAndSkills = (opt.skills || []).map(s => s.displayName || s.name);

                                let optName = opt.name || activeGroup.isc || unit.isc;
                                if (optionModsAndSkills.length > 0) {
                                    optName = `${optName} (${optionModsAndSkills.join(', ')})`;
                                }

                                // Peripheral names included with this loadout (e.g. "DRUMBOT_3")
                                const includedPeripheralNames = (opt.includes || []).map(inc => {
                                    const pg = profileGroups[inc.group - 1];
                                    return pg?.options[inc.option - 1]?.name ?? null;
                                }).filter((n): n is string => n !== null);

                                const weapsAndEqStr = weapsAndEq.join(' ').toLowerCase();
                                const optionModsAndSkillsStr = optionModsAndSkills.join(' ').toLowerCase();

                                let matchesSearch = false;

                                // Text Search Match
                                if (searchQuery && searchQuery.length > 2) {
                                    if (
                                        optName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        weapsAndEqStr.includes(searchQuery.toLowerCase()) ||
                                        optionModsAndSkillsStr.includes(searchQuery.toLowerCase())
                                    ) {
                                        matchesSearch = true;
                                    }
                                }

                                // Active Filters Match
                                if (!matchesSearch && activeFilters.length > 0) {
                                    // Item Filters (Skills, Equipment, Weapons)
                                    const itemFilters = activeFilters.filter(f => f.type !== 'stat') as ItemFilter[];
                                    if (itemFilters.length > 0) {
                                        const matchesAnyFilter = itemFilters.some(filter => {
                                            // Check if the option has this item
                                            if (filter.type === 'weapon') {
                                                return opt.weapons?.some(w => w.id === filter.baseId);
                                            } else if (filter.type === 'skill') {
                                                return opt.skills?.some(s => s.id === filter.baseId) || activeProfile.skills?.some(s => s.id === filter.baseId);
                                            } else if (filter.type === 'equipment') {
                                                return opt.equipment?.some(e => e.id === filter.baseId) || activeProfile.equipment?.some(e => e.id === filter.baseId);
                                            }
                                            return false;
                                        });
                                        if (matchesAnyFilter) matchesSearch = true;
                                    }
                                }

                                const isThisOptionHighlighted = highlightOption?.id === opt.id;
                                return (
                                    <div
                                        key={isThisOptionHighlighted ? `h-${opt.id}-t${highlightOption!.tick}` : `opt-${opt.id}`}
                                        onClick={(e) => {
                                            if (onAddUnit) {
                                                e.stopPropagation();
                                                onAddUnit(unit, activeGroup.id, activeProfile.id, opt.id);
                                            } else if (onViewUnit) {
                                                e.stopPropagation();
                                                onViewUnit(unit);
                                            }
                                        }}
                                        className={`group relative flex items-stretch border rounded-md overflow-hidden transition-colors ${(onAddUnit || onViewUnit) ? 'cursor-pointer ' : ''}${matchesSearch ? 'bg-blue-500/10 border-blue-500/50 hover:bg-blue-500/20' : 'bg-black/10 border-white/5 hover:bg-black/30 hover:border-white/10'} ${isThisOptionHighlighted ? 'option-row-highlighted' : ''}`}
                                    >
                                        <div className="flex items-center justify-center px-3 bg-black/20 border-r border-white/5">
                                            {orders.map((o, i) => (
                                                <OrderIcon key={i} type={o} size={16} className={i > 0 ? "-ml-1" : ""} />
                                            ))}
                                        </div>
                                        <div className="flex-1 px-2.5 py-2 flex items-center gap-2 min-w-0">
                                            <span className="font-bold text-gray-300 text-xs whitespace-nowrap">{optName.toUpperCase()}</span>
                                            <span className="text-gray-400 text-[11px] truncate">
                                                {weapsAndEq.join(', ') || '—'}
                                            </span>
                                            {includedPeripheralNames.length > 0 && (
                                                <>
                                                    <span className="text-gray-600 flex-shrink-0 text-[11px]">||</span>
                                                    <span className="text-[11px] flex-shrink-0 font-medium" style={{ color: CLASSIFICATION_COLORS[5] }}>
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
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onViewUnit(unit);
                                                }}
                                                className="flex items-center justify-center px-3 bg-black/20 hover:bg-white/10 border-l border-white/5 text-gray-500 hover:text-white transition-colors"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Peripheral Units — full option listing */}
                        {profileGroups.map((pg, idx) => {
                            if (!isPeripheralGroup(unit, idx)) return null;
                            const pProfile = pg.profiles[0];
                            if (!pProfile) return null;
                            return (
                                <div key={pg.id} className="mt-2 border border-white/10 rounded-md overflow-hidden">
                                    {/* Header: badge, name, stats, shared skills */}
                                    <div className="px-2.5 py-2 bg-black/20 space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                                                style={{ color: CLASSIFICATION_COLORS[5], background: `${CLASSIFICATION_COLORS[5]}15`, border: `1px solid ${CLASSIFICATION_COLORS[5]}30` }}>
                                                REM
                                            </span>
                                            <span className="text-xs font-bold text-gray-300">{pg.isc || pProfile.name}</span>
                                        </div>
                                        <div className="flex gap-3 text-[10px]">
                                            {ATTRIBUTES.map((attr) => {
                                                const rec = pProfile as unknown as Record<string, unknown>;
                                                let val: string | number | undefined = rec[attr.key] as string | number | undefined;
                                                if (attr.key === 'move' && Array.isArray(rec[attr.key])) val = formatMove(rec[attr.key] as number[]);
                                                return (
                                                    <div key={attr.key} className="flex flex-col items-center">
                                                        <div className="font-bold text-gray-600">{attr.label}</div>
                                                        <div className="font-mono text-gray-400">{val ?? '-'}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {((pProfile.skills && pProfile.skills.length > 0) || (pProfile.equipment && pProfile.equipment.length > 0)) && (
                                            <div className="text-[10px] text-gray-500 leading-relaxed">
                                                <span className="font-bold uppercase tracking-widest mr-1">Skills & Eq:</span>
                                                {[
                                                    ...(pProfile.skills || []).map(s => s.displayName || s.name),
                                                    ...(pProfile.equipment || []).map(e => e.name)
                                                ].join(' • ')}
                                            </div>
                                        )}
                                    </div>
                                    {/* One row per option */}
                                    <div className="divide-y divide-white/[0.04]">
                                        {pg.options.map((pOpt) => {
                                            const pItems = [
                                                ...(pOpt.weapons || []).map(w => w.displayName || w.name),
                                                ...(pOpt.skills || []).map(s => s.displayName || s.name),
                                                ...(pOpt.equipment || []).map(e => e.name),
                                            ];
                                            return (
                                                <div key={pOpt.id} className="flex items-center px-2.5 py-1.5 gap-2 bg-black/10 text-[11px]">
                                                    <span className="font-bold text-gray-400 flex-shrink-0 w-24">{pOpt.name}</span>
                                                    <span className="flex-1 text-gray-500 truncate">{pItems.join(', ') || '—'}</span>
                                                    <span className="font-mono text-blue-400/70 flex-shrink-0">{pOpt.points}pts</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
