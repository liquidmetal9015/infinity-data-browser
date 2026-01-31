import { useState, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { FactionSelector } from '../components/ListBuilder/FactionSelector';
import { ClassifiedItem } from '../components/Classifieds/ClassifiedItem';
import { getClassifiedsForOption, type ClassifiedMatch } from '../../shared/classifieds';
import type { Unit, Profile, Option } from '../../shared/types'; // Import shared types
import { ChevronLeft } from 'lucide-react';

export function ClassifiedsPage() {
    const db = useDatabase();
    const [selectedFactionId, setSelectedFactionId] = useState<number | null>(null);
    const [hoveredClassified, setHoveredClassified] = useState<number | null>(null);
    const [hoveredUnitISC, setHoveredUnitISC] = useState<string | null>(null);

    // Filter units for the selected faction
    const factionUnits = useMemo(() => {
        if (!selectedFactionId) return [];
        return db.units
            .filter(u => u.factions.includes(selectedFactionId))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [db.units, selectedFactionId]);

    // Pre-calculate matches for all units and profiles
    // Map<UnitISC, Map<ProfileOptionKey, Match[]>> 
    // Simplified: Map<UnitISC, Set<ClassifiedID>> to know which units match a classified quickly
    const unitMatches = useMemo(() => {
        if (!selectedFactionId || !db.classifieds.length) return null;

        const metadata = {
            skills: db.skillMap,
            equips: db.equipmentMap
        };

        const matches = new Map<string, {
            unit: Unit,
            completableClassifieds: Set<number>,
            profileMatches: {
                profile: Profile,
                option: Option,
                matches: ClassifiedMatch[]
            }[]
        }>();

        factionUnits.forEach(unit => {
            const unitEntry = {
                unit,
                completableClassifieds: new Set<number>(),
                profileMatches: [] as any[]
            };

            unit.raw.profileGroups.forEach(pg => {
                pg.profiles.forEach(profile => {
                    pg.options.forEach(option => {
                        const optionMatches = getClassifiedsForOption(
                            unit,
                            profile,
                            option,
                            db.classifieds,
                            metadata
                        );

                        // If this option can complete any classifieds, record it
                        const validMatches = optionMatches.filter(m => m.canComplete);
                        if (validMatches.length > 0) {
                            validMatches.forEach(m => unitEntry.completableClassifieds.add(m.objectiveId));
                            unitEntry.profileMatches.push({
                                profile,
                                option,
                                matches: validMatches
                            });
                        }
                    });
                });
            });

            if (unitEntry.completableClassifieds.size > 0) {
                matches.set(unit.isc, unitEntry);
            }
        });

        return matches;
    }, [db.classifieds, factionUnits, db.skillMap, db.equipmentMap]);


    if (!selectedFactionId) {
        return (
            <div className="p-8">
                <FactionSelector
                    groupedFactions={db.getGroupedFactions()}
                    onFactionClick={setSelectedFactionId} // Uses direct ID
                    onImportClick={() => { }} // No import needed here yet
                />
            </div>
        );
    }

    const factionName = db.getFactionName(selectedFactionId);

    // Derived state for display
    const visibleUnits = factionUnits.filter(u => {
        // If hovering a classified, only show units that can do it
        if (hoveredClassified) {
            const matchEntry = unitMatches?.get(u.isc);
            return matchEntry?.completableClassifieds.has(hoveredClassified);
        }
        return true;
    });

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b px-6 py-4 flex items-center shadow-sm z-10">
                <button
                    onClick={() => setSelectedFactionId(null)}
                    className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                    title="Change Faction"
                >
                    <ChevronLeft size={24} />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Classifieds Analysis</h1>
                    <p className="text-sm text-gray-500">{factionName}</p>
                </div>
            </header>

            {/* Main Content - Two Columns */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left: Classifieds */}
                <div className="w-1/3 overflow-y-auto p-4 border-r border-gray-200 bg-white">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 sticky top-0 bg-white py-2">
                        Objectives ({db.classifieds.length})
                    </h2>
                    <div className="space-y-3">
                        {db.classifieds.map(cls => {
                            const isRelevantToUnit = hoveredUnitISC && unitMatches?.get(hoveredUnitISC)?.completableClassifieds.has(cls.id);
                            const isActive = hoveredClassified === cls.id || !!isRelevantToUnit;
                            const isSubdued = !!hoveredUnitISC && !isRelevantToUnit;

                            return (
                                <ClassifiedItem
                                    key={cls.id}
                                    objective={cls}
                                    isActive={isActive}
                                    isSubdued={isSubdued}
                                    match={hoveredUnitISC && isRelevantToUnit ? {
                                        objectiveId: cls.id,
                                        canComplete: true,
                                        reason: "Selected Unit" // We could detail which profile
                                    } : undefined}
                                    onHover={setHoveredClassified}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Right: Units */}
                <div className="w-2/3 overflow-y-auto p-4 bg-gray-50">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 sticky top-0 bg-gray-50 py-2 z-10 flex justify-between">
                        <span>Available Units ({visibleUnits.length})</span>
                        {hoveredClassified && (
                            <span className="text-blue-600">
                                Matching "{db.classifieds.find(c => c.id === hoveredClassified)?.name}"
                            </span>
                        )}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {visibleUnits.map(unit => {
                            const matchData = unitMatches?.get(unit.isc);
                            const canCompleteFocused = hoveredClassified && matchData?.completableClassifieds.has(hoveredClassified);
                            const isHovered = hoveredUnitISC === unit.isc;

                            // If we are hovering a classified, show HOW this unit completes it
                            let highlightReason = "";
                            if (canCompleteFocused && hoveredClassified) {
                                // Find first profile that does it to show reason
                                const pm = matchData?.profileMatches.find(p => p.matches.some(m => m.objectiveId === hoveredClassified));
                                if (pm) {
                                    const specificMatch = pm.matches.find(m => m.objectiveId === hoveredClassified);
                                    highlightReason = specificMatch?.reason || "";
                                }
                            }

                            return (
                                <div
                                    key={unit.isc}
                                    className={`
                                        p-3 rounded border transition-all cursor-pointer bg-white
                                        ${isHovered ? 'ring-2 ring-blue-400 border-blue-400 shadow-md' : 'border-gray-200 hover:border-blue-300'}
                                        ${hoveredClassified && !canCompleteFocused ? 'opacity-40 grayscale' : ''}
                                        ${canCompleteFocused ? 'bg-green-50 border-green-300 ring-2 ring-green-100' : ''}
                                    `}
                                    onMouseEnter={() => setHoveredUnitISC(unit.isc)}
                                    onMouseLeave={() => setHoveredUnitISC(null)}
                                >
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-gray-900">{unit.name}</h3>
                                        {/* <span className="text-xs text-gray-500 bg-gray-100 px-1 rounded">{unit.pointsRange[0]}-{unit.pointsRange[1]} pts</span> */}
                                    </div>

                                    {highlightReason && (
                                        <div className="mt-2 text-xs text-green-700 font-bold bg-green-100 px-2 py-1 rounded inline-block">
                                            Via: {highlightReason}
                                        </div>
                                    )}

                                    {/* Detailed breakdown if hovered */}
                                    {isHovered && matchData && (
                                        <div className="mt-3 space-y-1">
                                            <p className="text-xs text-gray-500 font-semibold border-b pb-1 mb-1">Capabilities ({matchData.completableClassifieds.size})</p>
                                            {/* Show top 3 reasons or matched objectives? */}
                                            {/* Maybe just show profiles that are useful */}
                                            {matchData.profileMatches.slice(0, 3).map((pm, idx) => (
                                                <div key={idx} className="text-xs text-gray-600">
                                                    <span className="font-mono bg-gray-100 px-1">{pm.option.name || "Standard"}</span>
                                                    <span className="ml-1 text-gray-400">
                                                        ({pm.matches.map(m => m.reason).filter((v, i, a) => a.indexOf(v) === i).join(', ')})
                                                    </span>
                                                </div>
                                            ))}
                                            {matchData.profileMatches.length > 3 && (
                                                <div className="text-xs text-gray-400 italic">+ {matchData.profileMatches.length - 3} more profiles</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
