import React, { useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Users, Trash2, Check, ShieldCheck, Shield } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext';
import { useListStore } from '../../stores/useListStore';
import { getPossibleFireteams, getFireteamBonuses, calculateFireteamLevel, assignMembersToSlots, getMemberWithChartData, type SlotAssignment } from '../../utils/fireteams';
import type { ListUnit } from '../../types/list';
import type { Fireteam } from '../../types';

export interface SortableFireteamContainerProps {
    groupIndex: number;
    fireteamId: string;
    color: string;
    notes?: string;
    selectedTeamName?: string;
    selectedTeamType?: string;
    isHighlighted?: boolean;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    listUnits: ListUnit[];
    factionId: number;
    children: React.ReactNode;
    onRemove: () => void;
}

export function SortableFireteamContainer({
    groupIndex,
    fireteamId,
    color,
    notes,
    selectedTeamName,
    selectedTeamType,
    isHighlighted,
    onMouseEnter,
    onMouseLeave,
    listUnits,
    factionId,
    children,
    onRemove
}: SortableFireteamContainerProps) {
    const db = useDatabase();
    const { updateFireteamDef } = useListStore();

    const { setNodeRef, isOver, attributes, listeners, transform, transition, isDragging } = useSortable({
        id: `fireteam-${fireteamId}`,
        data: { type: 'fireteam-container', groupIndex, fireteamId, color, notes },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        borderLeftColor: color,
        backgroundColor: 'var(--bg-tertiary)',
        borderTop: `1px solid var(--border)`,
        borderRight: `1px solid var(--border)`,
        borderBottom: `1px solid var(--border)`,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    };

    // Evaluate possible fireteams
    const chart = db.getFireteamChart(factionId);

    // Convert ListUnits to the format expected by getPossibleFireteams
    const members = useMemo(() => {
        if (!chart) {
            return listUnits.map(lu => ({ name: lu.unit.isc, comment: '', slug: lu.unit.raw?.slug }));
        }
        return listUnits.map(lu => getMemberWithChartData(chart, lu.unit.isc, lu.unit.raw?.slug));
    }, [listUnits, chart]);

    const possibleTeams = useMemo(() => {
        if (!chart) return [];
        return getPossibleFireteams(chart, members);
    }, [chart, members]);

    const handleTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (!val) {
            updateFireteamDef(groupIndex, fireteamId, { selectedTeamName: undefined, selectedTeamType: undefined });
            return;
        }

        const [tName, tType] = val.split('|');
        updateFireteamDef(groupIndex, fireteamId, { selectedTeamName: tName, selectedTeamType: tType });
    };

    // Determine current display
    let displayType = selectedTeamType || 'Fireteam';
    let displayTitle = selectedTeamName || notes || 'Fireteam';

    // Auto-deduce if unambiguous and nothing selected
    if (!selectedTeamName && possibleTeams.length === 1 && members.length > 0) {
        displayTitle = possibleTeams[0].name;
        if (possibleTeams[0].type.length === 1) {
            displayType = possibleTeams[0].type[0];
        }
    }

    const activeTeamDef = selectedTeamName
        ? chart?.teams.find(t => t.name === selectedTeamName && (!selectedTeamType || t.type.includes(selectedTeamType)))
        : (possibleTeams.length === 1 && members.length > 0 ? possibleTeams[0] : null);

    const bonuses = useMemo(() => {
        if (!activeTeamDef || members.length === 0) return [];
        return getFireteamBonuses(activeTeamDef, members);
    }, [activeTeamDef, members]);

    const activeLevel = activeTeamDef ? calculateFireteamLevel(activeTeamDef, members) : 0;
    const isPure = activeTeamDef && isActiveLevelPure(activeLevel, members.length);
    const activeBonuses = bonuses.filter(b => b.isActive);

    const assignments = useMemo(() => activeTeamDef ? assignMembersToSlots(activeTeamDef, members) : null, [activeTeamDef, members]);

    const contributingMemberIndices = useMemo(() => {
        if (!activeTeamDef || !assignments) return new Set<number>();
        const normalizedTeamName = activeTeamDef.name.toLowerCase().replace(/ fireteam| core| haris| duo/g, '').trim();
        const indices = new Set<number>();
        assignments.forEach((a: SlotAssignment) => {
            const isMatch = a.providedTags.some((t: string) => {
                if (t === 'wildcard') return true;
                return normalizedTeamName.includes(t) || t.includes(normalizedTeamName);
            });
            if (isMatch) indices.add(a.memberIndex);
        });
        return indices;
    }, [activeTeamDef, assignments]);

    const contributorNames = Array.from(contributingMemberIndices).map(idx => listUnits[idx].unit.name).join(', ');

    const isInvalid = activeTeamDef ? (assignments === null) : (members.length > 0 && possibleTeams.length === 0);
    const isFormed = bonuses.some(b => b.isActive);
    const isIncomplete = activeTeamDef && !isInvalid && !isFormed;

    function isActiveLevelPure(level: number, size: number) {
        return level >= size; // All members count as the team primary type
    }

    return (
        <div
            ref={setNodeRef}
            className={`fireteam-container mt-3 mb-3 mx-2 rounded-lg overflow-hidden transition-colors border-l-4 ${isOver ? 'ring-2 ring-blue-400 bg-white/10' : ''} ${isHighlighted ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.2)]' : ''}`}
            style={style}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div
                className="flex items-center justify-between px-4 py-3 text-sm font-bold tracking-wider border-b cursor-grab active:cursor-grabbing shadow-sm"
                style={{ backgroundColor: `${color}15`, color, borderColor: `${color}30` }}
                {...attributes}
                {...listeners}
            >
                <div className="flex flex-col gap-1 w-full max-w-[60%]">
                    <div className="flex items-center gap-2 uppercase">
                        <GripVertical size={16} className="text-white/50" />
                        <Users size={16} />
                        {displayType && <span className="opacity-70 text-xs">{displayType}</span>}
                        <span className={isInvalid ? "text-red-400" : isIncomplete ? "text-yellow-400" : ""}>{displayTitle}</span>
                        {isInvalid && <span className="text-red-400 text-xs ml-1 font-normal opacity-80" title="Selected units cannot legally form this team">(Invalid)</span>}
                        {isIncomplete && <span className="text-yellow-400 text-xs ml-1 font-normal opacity-80" title="Needs missing required troops or minimum formation size">(Incomplete)</span>}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {members.length > 0 && chart && (
                        <select
                            className="text-xs bg-black/30 border border-white/10 rounded px-2 py-1 text-white/80 pointer-events-auto max-w-[200px]"
                            value={selectedTeamName && selectedTeamType ? `${selectedTeamName}|${selectedTeamType}` : ''}
                            onChange={handleTeamChange}
                        >
                            <option value="">Auto-deduce team...</option>
                            {possibleTeams.map((pt: Fireteam) => (
                                pt.type.map((type: string) => (
                                    <option key={`${pt.name}|${type}`} value={`${pt.name}|${type}`}>
                                        {pt.name} ({type})
                                    </option>
                                ))
                            ))}
                        </select>
                    )}

                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="hover:text-red-400 p-1 pointer-events-auto"
                        title="Delete Fireteam"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Fireteam Bonuses Ribbon */}
            {(activeTeamDef && (activeBonuses.length > 0 || isInvalid || isIncomplete)) && (
                <div className="flex flex-col border-b border-black/20" style={{ backgroundColor: `${color}10` }}>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs overflow-x-auto whitespace-nowrap scrollbar-hide">
                        {isInvalid ? (
                            <span className="flex items-center gap-1 mr-2 px-1.5 py-0.5 rounded shadow-sm bg-red-500/20 text-red-300 border border-red-500/30">
                                Invalid Composition
                            </span>
                        ) : isIncomplete ? (
                            <span className="flex items-center gap-1 mr-2 px-1.5 py-0.5 rounded shadow-sm bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                                Incomplete ({members.length} units)
                            </span>
                        ) : (
                            <span className={`flex items-center gap-1 mr-2 px-1.5 py-0.5 rounded shadow-sm ${isPure ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'}`} title={isPure ? `Pure Fireteam\nContributors:\n${contributorNames}` : `Standard Fireteam (Level ${activeLevel})\nContributors:\n${contributorNames}`}>
                                {isPure ? <ShieldCheck size={12} /> : <Shield size={12} />}
                                {isPure ? 'Pure' : `Lvl ${activeLevel}`}
                            </span>
                        )}
                        {activeBonuses.map((b, i) => (
                            <span key={i} className="flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded border border-white/5 shadow-sm text-white/70" title={`Level ${b.level} Bonus`}>
                                <Check size={10} className="text-green-400" />
                                {b.description}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="min-h-[40px] w-full p-1 bg-black/20">
                {children}
                {React.Children.count(children) === 0 && (
                    <div className="flex items-center justify-center py-4 text-xs text-white/30 italic dashed border border-dashed border-white/10 m-2 rounded bg-black/40">
                        Drag units here to form a team
                    </div>
                )}
            </div>
        </div>
    );
}
