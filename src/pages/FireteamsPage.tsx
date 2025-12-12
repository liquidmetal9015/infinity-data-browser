import { useState, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Layers, Shield, Users, Info } from 'lucide-react';
import type { Fireteam, FireteamUnit } from '../types';

export function FireteamsPage() {
    const db = useDatabase();
    const [selectedFactionId, setSelectedFactionId] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'teams' | 'units'>('teams');

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
        if (!selectedFactionId) return null;
        return db.getFireteamChart(selectedFactionId);
    }, [selectedFactionId, db]);

    const activeFaction = useMemo(() => {
        if (!selectedFactionId) return null;
        return db.getFactionInfo(selectedFactionId);
    }, [selectedFactionId, db]);

    const handleSelectFaction = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = Number(e.target.value);
        if (id) setSelectedFactionId(id);
    };

    return (
        <div className="page-container fireteams-page">
            <div className="header-section">
                <h2>Fireteam Reference</h2>
                <p>Browse Fireteam composition rules and unit availability.</p>
            </div>

            <div className="controls-section">
                <div className="selector-container">
                    <label>Select Sectorial:</label>
                    <select
                        value={selectedFactionId || ''}
                        onChange={handleSelectFaction}
                        className="faction-select"
                    >
                        <option value="">-- Choose Sectorial --</option>
                        {groupedOptions.map(group => (
                            <optgroup key={group.id} label={group.name}>
                                {group.vanilla && (
                                    <option value={group.vanilla.id}>{group.vanilla.name}</option>
                                )}
                                {group.sectorials.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>

                {fireteamChart && (
                    <div className="view-toggles">
                        <button
                            className={`toggle-btn ${viewMode === 'teams' ? 'active' : ''}`}
                            onClick={() => setViewMode('teams')}
                        >
                            <Layers size={18} />
                            By Fireteam
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === 'units' ? 'active' : ''}`}
                            onClick={() => setViewMode('units')}
                        >
                            <Users size={18} />
                            By Unit
                        </button>
                    </div>
                )}
            </div>

            {!selectedFactionId ? (
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
                            <span className="badge core">CORE (2-5)</span>
                            <span className="badge haris">HARIS (2-3)</span>
                            <span className="badge duo">DUO (2)</span>
                        </div>
                    </div>

                    {viewMode === 'teams' ? (
                        <FireteamListView chart={fireteamChart} />
                    ) : (
                        <UnitPerspectiveView chart={fireteamChart} db={db} factionId={selectedFactionId} />
                    )}
                </div>
            )}

            <style>{`
                .fireteams-page {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 2rem;
                }
                .header-section {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                .controls-section {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: var(--bg-secondary);
                    padding: 1rem 2rem;
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    margin-bottom: 2rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                }
                .selector-container {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                .faction-select {
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    font-size: 1rem;
                    min-width: 250px;
                }
                .view-toggles {
                    display: flex;
                    gap: 0.5rem;
                    background: var(--bg-primary);
                    padding: 4px;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                }
                .toggle-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    border: none;
                    background: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    border-radius: 6px;
                    font-size: 0.9rem;
                    font-weight: 500;
                }
                .toggle-btn.active {
                    background: var(--bg-active); /* fallback */
                    background: var(--color-primary);
                    color: white;
                }
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 4rem;
                    border: 2px dashed var(--border-color);
                    border-radius: 12px;
                    color: var(--text-secondary);
                    gap: 1rem;
                }
                .faction-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    border-bottom: 1px solid var(--border-color);
                    padding-bottom: 1rem;
                }
                .faction-header h3 {
                    margin: 0;
                }
                .legend {
                    display: flex;
                    gap: 0.5rem;
                }
                .badge {
                    font-size: 0.75rem;
                    font-weight: 700;
                    padding: 0.2rem 0.5rem;
                    border-radius: 4px;
                    color: white;
                }
                .badge.core { background-color: #ef4444; }
                .badge.haris { background-color: #f97316; }
                .badge.duo { background-color: #3b82f6; }

                /* List View Styles */
                .fireteam-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 1.5rem;
                }
                .fireteam-card {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                .card-header {
                    padding: 1rem;
                    background: rgba(0,0,0,0.03);
                    border-bottom: 1px solid var(--border-color);
                }
                .card-header h4 {
                    margin: 0 0 0.5rem 0;
                    font-size: 1.1rem;
                }
                .types-row {
                    display: flex;
                    gap: 0.5rem;
                }
                .card-content {
                    padding: 1rem;
                    flex: 1;
                }
                .unit-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.4rem 0;
                    border-bottom: 1px solid var(--border-color);
                    font-size: 0.95rem;
                }
                .unit-row:last-child {
                    border-bottom: none;
                }
                .unit-row.required {
                    font-weight: 600;
                }
                .unit-note {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    margin-left: 0.5rem;
                }
                .min-max {
                    font-family: monospace;
                    color: var(--text-secondary);
                }

                /* Unit Perspective Styles */
                .unit-perspective-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .unit-perspective-card {
                    display: flex;
                    align-items:  center;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 1rem;
                    gap: 2rem;
                }
                .unit-info {
                    min-width: 200px;
                    font-weight: 600;
                    font-size: 1.1rem;
                }
                .teams-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }
                .team-tag {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: var(--bg-primary);
                    border: 1px solid var(--border-color);
                    padding: 0.3rem 0.6rem;
                    border-radius: 4px;
                    font-size: 0.85rem;
                }
                .team-types {
                    display: flex;
                    gap: 2px;
                }
                .mini-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                }
                .mini-dot.core { background-color: #ef4444; }
                .mini-dot.haris { background-color: #f97316; }
                .mini-dot.duo { background-color: #3b82f6; }
            `}</style>
        </div>
    );
}

function FireteamListView({ chart }: { chart: any }) {
    // Identify generic wildcards
    const wildcards = chart.teams.find((t: Fireteam) => t.name.toLowerCase().includes('wildcard'));
    const regularTeams = chart.teams.filter((t: Fireteam) => !t.name.toLowerCase().includes('wildcard'));

    return (
        <div className="fireteam-grid">
            {regularTeams.map((team: Fireteam, idx: number) => (
                <div key={idx} className="fireteam-card">
                    <div className="card-header">
                        <h4>{team.name}</h4>
                        <div className="types-row">
                            {team.type.includes('CORE') && <span className="badge core">CORE</span>}
                            {team.type.includes('HARIS') && <span className="badge haris">HARIS</span>}
                            {team.type.includes('DUO') && <span className="badge duo">DUO</span>}
                        </div>
                    </div>
                    <div className="card-content">
                        {team.units.map((u: FireteamUnit, uIdx: number) => (
                            <div key={uIdx} className={`unit-row ${u.required ? 'required' : ''}`}>
                                <span>
                                    {u.name}
                                    {u.comment && <span className="unit-note">{u.comment}</span>}
                                </span>
                                <span className="min-max">{u.min}-{u.max}</span>
                            </div>
                        ))}
                        {/* Always append wildcards if they apply universally (simplified logic) */}
                        {wildcards && (
                            <div className="wildcard-section" style={{ marginTop: '1rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.25rem', color: 'var(--color-primary)' }}>
                                    + Any Wildcard (up to limit):
                                </div>
                                {wildcards.units.map((u: FireteamUnit, wIdx: number) => (
                                    <div key={`w-${wIdx}`} className="unit-row">
                                        <span>{u.name}</span>
                                        <span className="min-max">{u.min}-{u.max}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function UnitPerspectiveView({ chart, db, factionId }: { chart: any, db: any, factionId: number }) {
    // Get all units in this faction
    const units = useMemo(() => {
        return db.units.filter((u: any) => u.factions.includes(factionId))
            .sort((a: any, b: any) => a.name.localeCompare(b.name));
    }, [db, factionId]);

    // Map Unit Slug -> Fireteams
    const unitFireteamMap = useMemo(() => {
        const map = new Map<string, Fireteam[]>(); // Key is SLUG

        // Helper to normalize slug
        const normalize = (s: string) => s.toLowerCase();

        chart.teams.forEach((team: Fireteam) => {
            team.units.forEach((u: FireteamUnit) => {
                // We map the unit slug from fireteam chart to the team
                const s = normalize(u.slug);
                if (!map.has(s)) map.set(s, []);
                map.get(s)?.push(team);
            });
        });
        return map;
    }, [chart]);

    // Render list
    return (
        <div className="unit-perspective-list">
            {units.map((unit: any) => {
                // Try to find matching fireteams by slug or isc
                const slug = unit.raw.slug || unit.isc.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                const exactTeams = unitFireteamMap.get(slug) || [];

                // Also check if they are a wildcard (if map has generic wildcard entries? complex. 
                // For now, relies on explicit slug match in the chart)

                if (exactTeams.length === 0) return null; // Skip units with no fireteams? Or show them?

                return (
                    <div key={unit.id} className="unit-perspective-card">
                        <div className="unit-info">
                            {unit.name}
                        </div>
                        <div className="teams-list">
                            {exactTeams.map((team: Fireteam, idx) => (
                                <div key={idx} className="team-tag">
                                    {team.name}
                                    <div className="team-types">
                                        {team.type.includes('CORE') && <span className="mini-dot core" title="Core" />}
                                        {team.type.includes('HARIS') && <span className="mini-dot haris" title="Haris" />}
                                        {team.type.includes('DUO') && <span className="mini-dot duo" title="Duo" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
