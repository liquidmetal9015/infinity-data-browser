import { useState, useMemo } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { Layers, Shield, Users, Info, Calculator } from 'lucide-react';
import { useGlobalFactionStore } from '../../stores/useGlobalFactionStore';
import { CompactFactionSelector } from '../../components/shared/CompactFactionSelector';
import { FireteamListView } from './FireteamListView';
import { UnitPerspectiveView } from './UnitPerspectiveView';
import { FireteamBuilder } from './FireteamBuilder';
import './FireteamsPage.css';

export function FireteamsPage() {
    const db = useDatabase();
    const { globalFactionId, setGlobalFactionId } = useGlobalFactionStore();
    const [viewMode, setViewMode] = useState<'teams' | 'units' | 'builder'>('builder');

    // Get all factions with fireteam data, grouped by super-faction
    const groupedOptions = useMemo(() => {
        return db.getGroupedFactions()
            .map(group => ({
                ...group,
                // Only include if they have a fireteam chart
                vanilla: (group.vanilla && db.getFireteamChart(group.vanilla.id)) ? group.vanilla : null,
                sectorials: group.sectorials.filter(s => db.getFireteamChart(s.id))
            }))
            .filter(group => group.vanilla || group.sectorials.length > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [db]);

    const fireteamChart = useMemo(() => {
        if (!globalFactionId) return null;
        return db.getFireteamChart(globalFactionId);
    }, [globalFactionId, db]);

    const activeFaction = useMemo(() => {
        if (!globalFactionId) return null;
        return db.getFactionInfo(globalFactionId);
    }, [globalFactionId, db]);

    const handleSelectFaction = (factionId: number) => {
        if (factionId) {
            setGlobalFactionId(factionId);
            // Reset view mode to builder when changing faction
            setViewMode('builder');
        }
    };

    return (
        <div className="page-container fireteams-page">
            <div className="controls-section">
                <div className="selector-container">
                    <CompactFactionSelector
                        groupedFactions={groupedOptions}
                        value={globalFactionId}
                        onChange={handleSelectFaction}
                    />
                </div>

                {fireteamChart && (
                    <div className="view-toggles">
                        <button
                            className={`toggle-btn ${viewMode === 'builder' ? 'active' : ''} `}
                            onClick={() => setViewMode('builder')}
                        >
                            <Calculator size={18} />
                            Team Builder
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === 'units' ? 'active' : ''} `}
                            onClick={() => setViewMode('units')}
                        >
                            <Users size={18} />
                            Unit Analysis
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === 'teams' ? 'active' : ''} `}
                            onClick={() => setViewMode('teams')}
                        >
                            <Layers size={18} />
                            Reference Lists
                        </button>
                    </div>
                )}
            </div>

            {!globalFactionId ? (
                <div className="empty-state">
                    <Shield size={48} className="text-secondary" />
                    <p>Select a Sectorial Army to view its Fireteams.</p>
                </div>
            ) : !fireteamChart ? (
                <div className="empty-state">
                    <Info size={48} className="text-secondary" />
                    <p>No Fireteam data available for this faction.</p>
                </div>
            ) : (
                <div className="content-area">
                    {/* Header for Faction */}
                    <div className="faction-header">
                        <h3>{activeFaction?.name} Fireteams</h3>
                        {/* Legend */}
                        <div className="legend">
                            <span className="badge duo">DUO (2)</span>
                            <span className="badge haris">HARIS (3)</span>
                            <span className="badge core">CORE (3-5)</span>
                        </div>
                    </div>

                    {viewMode === 'teams' && <FireteamListView chart={fireteamChart} />}
                    {viewMode === 'units' && <UnitPerspectiveView chart={fireteamChart} db={db} factionId={globalFactionId} />}
                    {viewMode === 'builder' && <FireteamBuilder key={globalFactionId} chart={fireteamChart} />}
                </div>
            )}
        </div>
    );
}
