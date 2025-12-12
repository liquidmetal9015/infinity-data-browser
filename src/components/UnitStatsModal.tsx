import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Crosshair, Zap, Activity } from 'lucide-react';
import { useModal } from '../context/ModalContext';
import { useDatabase } from '../context/DatabaseContext';

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

export function UnitStatsModal() {
    const { isOpen, closeModal, selectedUnit } = useModal();
    const db = useDatabase();
    const [activeGroupIndex, setActiveGroupIndex] = useState(0);

    // Reset group index when unit changes
    useEffect(() => {
        setActiveGroupIndex(0);
    }, [selectedUnit]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!selectedUnit) return null;

    const profileGroups = selectedUnit.raw.profileGroups || [];
    const activeGroup = profileGroups[activeGroupIndex];
    const activeProfile = activeGroup?.profiles[0];

    if (!activeProfile) return null;

    // Helper to get name from ID
    const getName = (type: 'weapon' | 'skill' | 'equipment', id: number) => {
        if (type === 'weapon') return db.weaponMap.get(id) || `Weapon ${id}`;
        if (type === 'skill') return db.skillMap.get(id) || `Skill ${id}`;
        if (type === 'equipment') return db.equipmentMap.get(id) || `Equipment ${id}`;
        return '?';
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                    {/* Overlay - Slightly decreased opacity for focus */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={closeModal}
                        className="fixed inset-0 bg-black/40 cursor-pointer"
                    />

                    {/* Modal Content - Main container styling */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 15 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        className="relative z-10 w-full max-w-6xl bg-[#0b1221] border border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh] overflow-hidden rounded-2xl"
                    >
                        {/* Header - Increased padding and separation */}
                        <div className="p-10 border-b border-white/5 bg-[#162032] flex items-start justify-between shrink-0">
                            <div className="space-y-3">
                                <div className="flex items-center gap-6">
                                    <h2 className="text-4xl font-bold text-white tracking-tight leading-none bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                                        {selectedUnit.name.toUpperCase()}
                                    </h2>
                                    <span className="px-3 py-1.5 rounded-md text-sm font-mono font-medium bg-white/5 border border-white/5 text-gray-400 tracking-wide">
                                        {selectedUnit.isc}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {selectedUnit.factions.map(fid => (
                                        <span key={fid} className="text-xs font-bold text-gray-500 uppercase tracking-widest px-3 py-1.5 rounded-full bg-black/20 border border-white/5">
                                            {db.getFactionName(fid)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={closeModal}
                                className="p-3 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200 border border-transparent hover:border-white/5"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content Scrollable Area */}
                        <div className="overflow-y-auto flex-1 bg-[#0b1221]">
                            <div className="p-10 space-y-12">

                                {/* Profile Group Tabs - Increased size and click area */}
                                {profileGroups.length > 1 && (
                                    <div className="flex gap-4 border-b border-white/5 pb-4">
                                        {profileGroups.map((group, idx) => (
                                            <button
                                                key={group.id}
                                                onClick={() => setActiveGroupIndex(idx)}
                                                className={`px-6 py-3 text-sm font-bold tracking-wide rounded-lg transition-all duration-200
                                                    ${activeGroupIndex === idx
                                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_-5px_rgba(59,130,246,0.3)]'
                                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                                                    }`}
                                            >
                                                {group.isco || group.isc || `PROFILE ${idx + 1}`}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Stats Grid - Improved readability and spacing */}
                                <div className="grid grid-cols-9 gap-6 p-8 rounded-2xl bg-[#0f172a] border border-white/5 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />
                                    {ATTRIBUTES.map((attr) => {
                                        let val = (activeProfile as any)[attr.key];
                                        if (attr.key === 'move' && Array.isArray(val)) {
                                            val = val.join('-');
                                        }
                                        let label = attr.label;
                                        if (attr.key === 'w' && activeProfile.str) label = 'STR';

                                        return (
                                            <div key={attr.key} className="flex flex-col items-center gap-3 relative z-10">
                                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.15em]">
                                                    {label}
                                                </span>
                                                <span className="text-2xl font-bold text-gray-100 font-mono tracking-tight">
                                                    {val ?? '-'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Main Skills & Equip - Increased gap and visual separation */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                                    <div className="space-y-6">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-3 pb-4 border-b border-white/5">
                                            <Zap size={14} className="text-yellow-500/80" />
                                            Special Skills
                                        </h3>
                                        <div className="flex flex-wrap gap-3">
                                            {activeProfile.skills?.map((s, i) => {
                                                const wikiLink = db.getWikiLink('skill', s.id);
                                                const content = (
                                                    <>
                                                        {getName('skill', s.id)}
                                                        {s.extra && s.extra.length > 0 &&
                                                            <span className="ml-1">
                                                                ({s.extra.map((eid: any) => db.extrasMap.get(eid) || eid).join(', ')})
                                                            </span>
                                                        }
                                                    </>
                                                );

                                                return (
                                                    <span key={i} className="inline-flex items-center px-3 py-1.5 bg-[#162032] border border-white/5 rounded-md text-sm text-gray-300 shadow-sm transition-colors hover:border-white/10 hover:bg-[#1e293b]">
                                                        {wikiLink ? (
                                                            <a href={wikiLink} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline decoration-white/30 underline-offset-2">
                                                                {content}
                                                            </a>
                                                        ) : content}
                                                    </span>
                                                );
                                            })}
                                            {(!activeProfile.skills || activeProfile.skills.length === 0) &&
                                                <span className="text-gray-600 text-sm italic pl-2">None</span>
                                            }
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-3 pb-4 border-b border-white/5">
                                            <Shield size={14} className="text-blue-500/80" />
                                            Equipment
                                        </h3>
                                        <div className="flex flex-wrap gap-3">
                                            {activeProfile.equip?.map((e, i) => {
                                                const wikiLink = db.getWikiLink('equipment', e.id);
                                                return (
                                                    <span key={i} className="inline-flex items-center px-3 py-1.5 bg-[#162032] border border-white/5 rounded-md text-sm text-gray-300 shadow-sm transition-colors hover:border-white/10 hover:bg-[#1e293b]">
                                                        {wikiLink ? (
                                                            <a href={wikiLink} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline decoration-white/30 underline-offset-2">
                                                                {getName('equipment', e.id)}
                                                            </a>
                                                        ) : getName('equipment', e.id)}
                                                    </span>
                                                );
                                            })}
                                            {(!activeProfile.equip || activeProfile.equip.length === 0) &&
                                                <span className="text-gray-600 text-sm italic pl-2">None</span>
                                            }
                                        </div>
                                    </div>
                                </div>

                                {/* Loadouts Table - Refined table layout */}
                                <div className="space-y-6">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-3 pb-4 border-b border-white/5">
                                        <Crosshair size={14} className="text-red-500/80" />
                                        Loadout Options
                                    </h3>
                                    <div className="border border-white/5 rounded-xl overflow-hidden bg-[#0f172a] shadow-inner">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-[#162032] border-b border-white/5">
                                                <tr>
                                                    <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-wider w-1/3">Weapons</th>
                                                    <th className="px-6 py-5 text-xs font-bold text-gray-500 uppercase tracking-wider w-1/4">Equipment</th>
                                                    <th className="px-6 py-5 text-xs font-bold text-gray-500 uppercase tracking-wider w-1/4">Skills</th>
                                                    <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right w-28">SWC</th>
                                                    <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right w-28">Points</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {activeGroup.options.map((opt, idx) => (
                                                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                                                        <td className="px-8 py-6 align-top">
                                                            <div className="flex flex-col gap-2">
                                                                {opt.weapons?.map((w, i) => {
                                                                    const wikiLink = db.getWikiLink('weapon', w.id);
                                                                    const content = (
                                                                        <>
                                                                            {getName('weapon', w.id)}
                                                                            {w.extra && w.extra.length > 0 && <span className="ml-1">({w.extra.map((eid: any) => db.extrasMap.get(eid) || eid).join(', ')})</span>}
                                                                        </>
                                                                    );
                                                                    return (
                                                                        <span key={i} className={`text-sm ${i === 0 ? "text-gray-200 font-medium" : "text-gray-400"}`}>
                                                                            {wikiLink ? (
                                                                                <a href={wikiLink} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline decoration-white/30 underline-offset-2">
                                                                                    {content}
                                                                                </a>
                                                                            ) : content}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-6 align-top text-sm text-gray-400">
                                                            <div className="flex flex-col gap-1.5">
                                                                {opt.equip?.map((e, i) => {
                                                                    const wikiLink = db.getWikiLink('equipment', e.id);
                                                                    return (
                                                                        <span key={i}>
                                                                            {wikiLink ? (
                                                                                <a href={wikiLink} target="_blank" rel="noopener noreferrer" className="hover:text-gray-200 hover:underline decoration-white/30 underline-offset-2">
                                                                                    {getName('equipment', e.id)}
                                                                                </a>
                                                                            ) : getName('equipment', e.id)}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-6 align-top text-sm text-gray-400">
                                                            <div className="flex flex-col gap-1.5">
                                                                {opt.skills?.map((s, i) => {
                                                                    const wikiLink = db.getWikiLink('skill', s.id);
                                                                    return (
                                                                        <span key={i}>
                                                                            {wikiLink ? (
                                                                                <a href={wikiLink} target="_blank" rel="noopener noreferrer" className="hover:text-gray-200 hover:underline decoration-white/30 underline-offset-2">
                                                                                    {getName('skill', s.id)}
                                                                                </a>
                                                                            ) : getName('skill', s.id)}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6 align-top text-right font-mono text-gray-400 text-lg">
                                                            {opt.swc}
                                                        </td>
                                                        <td className="px-8 py-6 align-top text-right font-mono font-bold text-blue-400 text-lg">
                                                            {opt.points}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
