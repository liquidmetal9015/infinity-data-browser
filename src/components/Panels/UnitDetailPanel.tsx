import { useState } from 'react';
import { Shield, Crosshair, Zap, Activity, CheckCircle, Info } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';
import { useListStore } from '../../stores/useListStore';
import { useListBuilderUIStore } from '../../stores/useListBuilderUIStore';
import { formatMove } from '../../utils/conversions';

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
];

export function UnitDetailPanel() {
    const db = useDatabase();
    const unit = useListBuilderUIStore(s => s.selectedUnitForDetail);
    const targetGroupIndex = useListBuilderUIStore(s => s.targetGroupIndex);
    const addUnit = useListStore(s => s.addUnit);

    const [activeGroupIndex, setActiveGroupIndex] = useState(0);

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

    const profileGroups = unit.raw.profileGroups || [];
    const activeGroup = profileGroups[activeGroupIndex] || profileGroups[0];
    const activeProfile = activeGroup?.profiles[0];

    if (!activeProfile) return null;

    const handleAddLoadout = (optionId: number) => {
        addUnit(unit, targetGroupIndex, activeGroup.id, activeProfile.id, optionId);
    };

    return (
        <div className="overflow-y-auto h-full bg-[#0b1221]">
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-2xl font-bold text-white tracking-tight leading-none bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                            {unit.name.toUpperCase()}
                        </h2>
                        <span className="px-2 py-1 rounded-md text-xs font-mono font-medium bg-white/5 border border-white/5 text-gray-400 tracking-wide">
                            {unit.isc}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {unit.factions.map(fid => (
                            <span key={fid} className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 py-1 rounded-full bg-black/20 border border-white/5">
                                {db.getFactionName(fid)}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Profile Group Tabs */}
                {profileGroups.length > 1 && (
                    <div className="flex gap-2 border-b border-white/5 pb-3">
                        {profileGroups.map((group, idx) => (
                            <button
                                key={group.id}
                                onClick={() => setActiveGroupIndex(idx)}
                                className={`px-4 py-2 text-xs font-bold tracking-wide rounded-lg transition-all duration-200
                                    ${activeGroupIndex === idx
                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                                    }`}
                            >
                                {group.isc || `PROFILE ${idx + 1}`}
                            </button>
                        ))}
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-9 gap-3 p-4 rounded-xl bg-[#0f172a] border border-white/5">
                    {ATTRIBUTES.map((attr) => {
                        const profileRecord = activeProfile as unknown as Record<string, unknown>;
                        let val: string | number | undefined = profileRecord[attr.key] as string | number | undefined;
                        if (attr.key === 'move' && Array.isArray(profileRecord[attr.key])) {
                            val = formatMove(profileRecord[attr.key] as number[]);
                        }
                        let label = attr.label;
                        if (attr.key === 'w' && activeProfile.isStructure) label = 'STR';

                        return (
                            <div key={attr.key} className="flex flex-col items-center gap-1.5">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">
                                    {label}
                                </span>
                                <span className="text-lg font-bold text-gray-100 font-mono tracking-tight">
                                    {val ?? '-'}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Skills & Equipment */}
                <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-white/5">
                            <Zap size={12} className="text-yellow-500/80" />
                            Special Skills
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {activeProfile.skills?.map((s, i) => {
                                const wikiLink = db.getWikiLink('skill', s.id);
                                const content = (
                                    <>
                                        {s.displayName || s.name}
                                        {s.modifiers && s.modifiers.length > 0 &&
                                            <span className="ml-1">({s.modifiers.join(', ')})</span>
                                        }
                                    </>
                                );
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
                            {(!activeProfile.skills || activeProfile.skills.length === 0) &&
                                <span className="text-gray-600 text-xs italic">None</span>
                            }
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-white/5">
                            <Shield size={12} className="text-blue-500/80" />
                            Equipment
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {activeProfile.equipment?.map((e, i) => {
                                const wikiLink = db.getWikiLink('equipment', e.id);
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
                            {(!activeProfile.equipment || activeProfile.equipment.length === 0) &&
                                <span className="text-gray-600 text-xs italic">None</span>
                            }
                        </div>
                    </div>
                </div>

                {/* Loadouts Table */}
                <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-white/5">
                        <Crosshair size={12} className="text-red-500/80" />
                        Loadout Options
                    </h3>
                    <div className="border border-white/5 rounded-lg overflow-hidden bg-[#0f172a]">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#162032] border-b border-white/5">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Weapons</th>
                                    <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Equip</th>
                                    <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">SWC</th>
                                    <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Pts</th>
                                    <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {activeGroup.options.map((opt, idx) => (
                                    <tr
                                        key={idx}
                                        className="transition-colors hover:bg-blue-500/10 cursor-pointer"
                                        onClick={() => handleAddLoadout(opt.id)}
                                    >
                                        <td className="px-4 py-3 align-top">
                                            <div className="flex flex-col gap-1">
                                                {opt.weapons?.map((w, i) => (
                                                    <span key={i} className={`text-xs ${i === 0 ? "text-gray-200 font-medium" : "text-gray-400"}`}>
                                                        {w.name}
                                                        {w.modifiers && w.modifiers.length > 0 && <span className="ml-1">({w.modifiers.join(', ')})</span>}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 align-top text-xs text-gray-400">
                                            <div className="flex flex-col gap-0.5">
                                                {opt.equipment?.map((e, i) => (
                                                    <span key={i}>{e.name}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 align-top text-right font-mono text-gray-400 text-sm">
                                            {opt.swc}
                                        </td>
                                        <td className="px-3 py-3 align-top text-right font-mono font-bold text-blue-400 text-sm">
                                            {opt.points}
                                        </td>
                                        <td className="px-3 py-3 align-top text-center">
                                            <button
                                                className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded text-[10px] font-medium transition-colors flex items-center gap-1 mx-auto"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAddLoadout(opt.id);
                                                }}
                                            >
                                                <CheckCircle size={12} />
                                                Add
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
