import React from 'react';

interface SidebarProps {
    search: { weapon: string; skill: string; equip: string };
    setSearch: React.Dispatch<React.SetStateAction<{ weapon: string; skill: string; equip: string }>>;
    byFaction: boolean;
    setByFaction: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ search, setSearch, byFaction, setByFaction }) => {

    const handleChange = (field: keyof typeof search, value: string) => {
        setSearch(prev => ({ ...prev, [field]: value }));
    };

    return (
        <aside className="w-80 bg-infinity-panel border-r border-white/10 p-6 flex flex-col h-full shadow-2xl z-10">
            <div className="mb-8">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Search Matrix</div>
            </div>

            <div className="space-y-6">
                <div className="group">
                    <label className="block text-xs font-bold text-infinity-cyan uppercase mb-2 group-focus-within:text-white transition-colors">Weapon</label>
                    <input
                        type="text"
                        value={search.weapon}
                        onChange={(e) => handleChange('weapon', e.target.value)}
                        placeholder="e.g. Pitcher"
                        className="w-full bg-black/40 border border-white/10 rounded p-3 text-sm focus:border-infinity-cyan focus:outline-none focus:ring-1 focus:ring-infinity-cyan transition-all text-white placeholder-gray-600"
                    />
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-infinity-magenta uppercase mb-2 group-focus-within:text-white transition-colors">Equipment</label>
                    <input
                        type="text"
                        value={search.equip}
                        onChange={(e) => handleChange('equip', e.target.value)}
                        placeholder="e.g. MSV L3"
                        className="w-full bg-black/40 border border-white/10 rounded p-3 text-sm focus:border-infinity-magenta focus:outline-none focus:ring-1 focus:ring-infinity-magenta transition-all text-white placeholder-gray-600"
                    />
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-yellow-400 uppercase mb-2 group-focus-within:text-white transition-colors">Skill</label>
                    <input
                        type="text"
                        value={search.skill}
                        onChange={(e) => handleChange('skill', e.target.value)}
                        placeholder="e.g. Infiltration"
                        className="w-full bg-black/40 border border-white/10 rounded p-3 text-sm focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all text-white placeholder-gray-600"
                    />
                </div>
            </div>

            <div className="mt-8 pt-8 border-t border-white/5">
                <label className="flex items-center space-x-3 cursor-pointer group">
                    <div className="relative">
                        <input
                            type="checkbox"
                            className="sr-only"
                            checked={byFaction}
                            onChange={(e) => setByFaction(e.target.checked)}
                        />
                        <div className={`w-10 h-6 rounded-full transition-colors ${byFaction ? 'bg-infinity-cyan' : 'bg-gray-700'}`}></div>
                        <div className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform ${byFaction ? 'translate-x-4' : ''}`}></div>
                    </div>
                    <span className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors">Group by Faction</span>
                </label>
            </div>

            <div className="mt-auto text-[10px] text-gray-700 font-mono">
                DATASETS: N4
            </div>
        </aside>
    );
};
