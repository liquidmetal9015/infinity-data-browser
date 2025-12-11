import React from 'react';
import type { Unit } from '../types';
import { Database } from '../services/Database';

interface ResultGridProps {
    units: Unit[];
    byFaction: boolean;
}

export const ResultGrid: React.FC<ResultGridProps> = ({ units, byFaction }) => {

    if (units.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 border-2 border-dashed border-gray-800 rounded-lg">
                <div className="text-4xl mb-4 opacity-50">∅</div>
                <div className="text-sm uppercase tracking-widest">No matching units found</div>
            </div>
        );
    }

    if (byFaction) {
        const db = Database.getInstance();
        const factionMap: Record<number, Unit[]> = {};

        // Grouping
        units.forEach(u => {
            u.factions.forEach(fid => {
                if (!factionMap[fid]) factionMap[fid] = [];
                factionMap[fid].push(u);
            });
        });

        // "No Access" List
        // Identify all active factions
        // We can get list of all factions from DB metadata
        const allFactionIds = Array.from(db.factionMap.keys());
        const accessFactionIds = new Set(Object.keys(factionMap).map(Number));
        const missingFactionIds = allFactionIds.filter(id => !accessFactionIds.has(id));

        const sortedFactionIds = Object.keys(factionMap).map(Number).sort((a, b) =>
            db.getFactionName(a).localeCompare(db.getFactionName(b))
        );

        return (
            <div className="space-y-12">
                <section>
                    <h2 className="text-xl font-bold text-infinity-cyan mb-6 border-l-4 border-infinity-cyan pl-4 flex items-center">
                        <span className="flex-1">DEPLOYMENT AUTHORIZED</span>
                        <span className="text-xs bg-infinity-cyan/10 text-infinity-cyan px-2 py-1 rounded ml-2">{sortedFactionIds.length} Factions</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sortedFactionIds.map(fid => {
                            // Unique units in this faction
                            const factionUnits = Array.from(new Set(factionMap[fid].map(u => u.name))).sort();
                            return (
                                <div key={fid} className="bg-infinity-panel border border-white/5 rounded-lg p-5 hover:border-infinity-cyan/50 transition-colors shadow-lg">
                                    <h3 className="font-bold text-lg text-white mb-4 pb-2 border-b border-white/10 truncate" title={db.getFactionName(fid)}>
                                        {db.getFactionName(fid)}
                                    </h3>
                                    <ul className="space-y-1 text-sm text-gray-400">
                                        {factionUnits.map(name => (
                                            <li key={name} className="flex items-center">
                                                <span className="w-1.5 h-1.5 rounded-full bg-infinity-cyan mr-2 opacity-50"></span>
                                                {name}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {missingFactionIds.length > 0 && (
                    <section>
                        <h2 className="text-xl font-bold text-red-500 mb-6 border-l-4 border-red-500 pl-4 flex items-center">
                            <span className="flex-1">ACCESS DENIED</span>
                            <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded ml-2">{missingFactionIds.length} Factions</span>
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {missingFactionIds.sort((a, b) => db.getFactionName(a).localeCompare(db.getFactionName(b))).map(fid => (
                                <div key={fid} className="bg-infinity-panel/50 border border-white/5 rounded p-3 text-sm text-gray-500">
                                    {db.getFactionName(fid)}
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        );
    }

    // Flat List
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {units.map((unit, idx) => (
                // Use idx as fallback key if units appear multiple times? Database.search returns unique units though.
                <div key={`${unit.id}-${idx}`} className="group bg-infinity-panel border border-white/10 rounded-lg p-5 hover:shadow-[0_0_20px_rgba(0,240,255,0.15)] hover:border-infinity-cyan transition-all duration-300 relative overflow-hidden">
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-infinity-cyan/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold text-white group-hover:text-infinity-cyan transition-colors">{unit.name}</h3>
                        <span className="text-[10px] font-mono text-gray-600 border border-gray-800 px-1 rounded">ISC: {unit.isc}</span>
                    </div>

                    {/* Faction Pills (Just show first few) */}
                    <div className="flex flex-wrap gap-2 mt-4">
                        {unit.factions.slice(0, 3).map(fid => (
                            <span key={fid} className="text-[10px] uppercase font-bold bg-white/5 px-2 py-1 rounded text-gray-400">
                                {Database.getInstance().getFactionName(fid)}
                            </span>
                        ))}
                        {unit.factions.length > 3 && (
                            <span className="text-[10px] uppercase font-bold bg-white/5 px-2 py-1 rounded text-gray-500">
                                +{unit.factions.length - 3}
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
