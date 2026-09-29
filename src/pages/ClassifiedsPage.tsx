import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { CompactFactionSelector } from '../components/shared/CompactFactionSelector';
import { useListStore } from '../stores/useListStore';
import { CoverageDashboard } from '../components/Classifieds/CoverageDashboard';
import { ClassifiedsExplorer } from '../components/Classifieds/ClassifiedsExplorer';
import { ClipboardCheck, Compass, Target } from 'lucide-react';

export function ClassifiedsPage() {
    const db = useDatabase();
    const [searchParams, setSearchParams] = useSearchParams();
    const { currentList } = useListStore();

    const urlFactionParam = searchParams.get('faction');
    const defaultFactionId = currentList?.factionId || 101;
    const effectiveFactionId = urlFactionParam ? Number(urlFactionParam) : defaultFactionId;

    // Default to 'coverage' if an active list exists, otherwise 'explorer'
    const [activeTab, setActiveTab] = useState<'coverage' | 'explorer'>(currentList ? 'coverage' : 'explorer');

    // Faction units — needed for both modes (explorer display + dashboard candidates)
    const factionUnits = useMemo(() => {
        if (!effectiveFactionId) return [];
        return db.units
            .filter(u => u.factions.includes(effectiveFactionId))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [db.units, effectiveFactionId]);

    const handleSelectFaction = (factionId: number | null) => {
        if (factionId) {
            setSearchParams({ faction: String(factionId) });
        } else {
            setSearchParams({});
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-7xl mx-auto w-full">
            {/* Header section with title, mode switcher, and faction selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                        <Target className="text-blue-400" size={24} />
                        <span>Classified Objectives</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">
                        Deck objectives scoring and unit specialist qualifications
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Header / Mode Switcher when an active list exists */}
                    {currentList && (
                        <div className="flex items-center gap-1.5 p-1 bg-black/30 rounded-lg border border-white/5 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={() => setActiveTab('coverage')}
                                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                                    activeTab === 'coverage'
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold'
                                        : 'text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                <ClipboardCheck size={16} className="shrink-0" />
                                <span className="truncate max-w-[130px] sm:max-w-none">
                                    List Coverage ({currentList.name})
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('explorer')}
                                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                                    activeTab === 'explorer'
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold'
                                        : 'text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                <Compass size={16} className="shrink-0" />
                                <span>Faction Explorer</span>
                            </button>
                        </div>
                    )}

                    {(!currentList || activeTab === 'explorer') && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">Faction:</span>
                            <div className="flex-1 sm:w-72">
                                <CompactFactionSelector
                                    groupedFactions={db.getGroupedFactions()}
                                    value={effectiveFactionId}
                                    onChange={handleSelectFaction}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* List Coverage Mode */}
            {currentList && activeTab === 'coverage' && (
                <CoverageDashboard list={currentList} db={db} factionUnits={factionUnits} />
            )}

            {/* Faction Objective Explorer Mode */}
            {(!currentList || activeTab === 'explorer') && (
                <ClassifiedsExplorer factionUnits={factionUnits} db={db} />
            )}
        </div>
    );
}
