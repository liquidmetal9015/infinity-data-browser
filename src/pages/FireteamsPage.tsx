
import { useState, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useModal } from '../context/ModalContext';
import { Layers, Shield, Users, Info, Plus, X, Check, Calculator } from 'lucide-react';
import type { Fireteam, FireteamUnit } from '../types';
import { getFireteamBonuses, getUnitTags, calculateFireteamLevel } from '../utils/fireteams';

export function FireteamsPage() {
    const db = useDatabase();
    const [selectedFactionId, setSelectedFactionId] = useState<number | null>(null);
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
        if (!selectedFactionId) return null;
        return db.getFireteamChart(selectedFactionId);
    }, [selectedFactionId, db]);

    const activeFaction = useMemo(() => {
        if (!selectedFactionId) return null;
        return db.getFactionInfo(selectedFactionId);
    }, [selectedFactionId, db]);

    const handleSelectFaction = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = Number(e.target.value);
        if (id) {
            setSelectedFactionId(id);
            // Reset view mode to builder when changing faction
            setViewMode('builder');
        }
    };

    return (
        <div className="page-container fireteams-page">
            <div className="header-section">
                <h2>Fireteam Reference</h2>
                <p>Browse Fireteam composition rules, unit availability, and build your teams.</p>
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
                            <span className="badge duo">DUO (2)</span>
                            <span className="badge haris">HARIS (3)</span>
                            <span className="badge core">CORE (2-5)</span>
                        </div>
                    </div>

                    {viewMode === 'teams' && <FireteamListView chart={fireteamChart} />}
                    {viewMode === 'units' && <UnitPerspectiveView chart={fireteamChart} db={db} factionId={selectedFactionId} />}
                    {viewMode === 'builder' && <FireteamBuilder key={selectedFactionId} chart={fireteamChart} />}
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
    transition: all 0.2s ease;
}
                .toggle-btn:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.05);
}
                .toggle-btn.active {
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
                .badge.neutral { background-color: #64748b; }

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
    background: rgba(0, 0, 0, 0.03);
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
                .unit-row: last-child {
    border-bottom: none;
}
                .unit-row.required {
    font-weight: 600;
}
                .unit-note {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-left: 0.5rem;
    font-style: italic;
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
    align-items: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    gap: 2rem;
    justify-content: space-between;
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
    flex: 1;
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
    border-radius: 50 %;
}
                .mini-dot.core { background-color: #ef4444; }
                .mini-dot.haris { background-color: #f97316; }
                .mini-dot.duo { background-color: #3b82f6; }

                /* Builder Styles */
                .builder-container {
    display: grid;
    grid-template-columns: 350px 1fr;
    gap: 2rem;
    min-height: 600px;
}

                /* Selection Column */
                .builder-selection {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: var(--bg-secondary);
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    height: fit-content;
}
                .team-selector {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
                .team-select-btn {
    text-align: left;
    padding: 0.8rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
}
                .team-select-btn:hover {
    border-color: var(--color-primary);
}
                .team-select-btn.selected {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
}
                
                .unit-pool {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
    max-height: 500px;
    overflow-y: auto;
}
                .pool-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.8rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
}
                .pool-item:hover {
    border-color: var(--color-primary);
}
                .pool-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

                /* Workspace Column */
                .builder-workspace {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}
                .active-team-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 2rem;
}
                .team-slots {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    justify-content: center;
    flex-wrap: wrap;
}
                .member-slot {
    width: 120px;
    height: 140px;
    border: 2px dashed var(--border-color);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
    position: relative;
    text-align: center;
    padding: 0.5rem;
    transition: all 0.2s;
}
                .member-slot.filled {
    border-style: solid;
    border-color: var(--color-success);
    background: rgba(var(--color-success-rgb), 0.1);
}
                .member-slot.empty:hover {
    border-color: var(--color-primary);
    background: rgba(var(--color-primary-rgb), 0.05);
}
                .member-slot.locked {
    background: #111;
    border-style: dotted;
    opacity: 0.3;
    cursor: not-allowed;
}
                .slot-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 500;
}
                .remove-btn {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
                
                .bonus-panel {
    background: var(--bg-primary);
    border-radius: 8px;
    padding: 1.5rem;
}
                .bonus-list {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
}
                .bonus-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.8rem;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.2);
    opacity: 0.4;
    filter: grayscale(1);
    transition: all 0.3s;
}
                .bonus-item.active {
    opacity: 1;
    filter: none;
    background: rgba(var(--color-success-rgb), 0.1);
    border: 1px solid var(--color-success);
}
                .bonus-check {
    width: 24px;
    height: 24px;
    border-radius: 50 %;
    background: #333;
    display: flex;
    align-items: center;
    justify-content: center;
}
                .bonus-item.active.bonus-check {
    background: var(--color-success);
    color: white;
}
                .counts-as-tag {
    font-size: 0.7rem;
    padding: 2px 6px;
    background: var(--bg-secondary);
    border-radius: 4px;
    margin-top: 4px;
    color: var(--text-secondary);
}

                /* New Builder Vis */
                .counts-as-tiny {
    font-size: 0.9em; /* Match unit name size roughly */
    color: inherit; /* Match unit name color */
    font-weight: normal;
    opacity: 0.9;
}
                .pool-item.level-up {
    border: 2px solid white;
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.05);
}
                .pool-item.required-glow {
    border: 1px solid #f59e0b;
    box-shadow: 0 0 5px rgba(245, 158, 11, 0.4);
    background: rgba(245, 158, 11, 0.1);
}
                .level-up-tag {
    display: none; /* Hide text as requested */
}
                .required-tag {
    display: none; /* Hide text as requested */
}

                /* Unit Analysis Updates */
                .team-tag.nominal-member {
    border: 2px solid white;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.05);
}
                .type-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    font-size: 10px;
    font-weight: bold;
    border-radius: 4px;
    color: white;
}
                .type-badge.core { background-color: #ef4444; }
                .type-badge.haris { background-color: #f59e0b; }
                .type-badge.duo { background-color: #3b82f6; }
                
                .team-tag.team-name {
    flex: 1;
    font-size: 0.85rem;
}

                .info-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    margin-left: 4px;
                }
                .info-btn:hover {
                    color: var(--color-primary);
                    background: rgba(255, 255, 255, 0.1);
                }
`}</style>
        </div>
    );
}

function FireteamListView({ chart }: { chart: any }) {
    const db = useDatabase();
    const { openUnitModal } = useModal();
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
                        {team.units.map((u: FireteamUnit, uIdx: number) => {

                            return (
                                <div key={uIdx} className={`unit-row ${u.required ? 'required' : ''} `}>
                                    <span>
                                        {u.name}
                                        {u.comment && <span className="unit-note" style={{ fontSize: '0.9em', color: 'inherit', marginLeft: '6px', opacity: 0.8 }}>{u.comment}</span>}
                                        <button
                                            className="info-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const fullUnit = db.getUnitBySlug(u.slug);
                                                if (fullUnit) openUnitModal(fullUnit);
                                            }}
                                            title="View Unit Stats"
                                            style={{ display: 'inline-flex', verticalAlign: 'middle' }}
                                        >
                                            <Info size={14} />
                                        </button>
                                    </span>
                                    <span className="min-max">{u.required ? '*' : u.min}-{u.max}</span>
                                </div>
                            );
                        })}

                        {wildcards && (
                            <div className="wildcard-section" style={{ marginTop: '1rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.25rem', color: 'var(--color-primary)' }}>
                                    + Wildcards (up to limit):
                                </div>
                                {wildcards.units.map((u: FireteamUnit, wIdx: number) => (
                                    <div key={`w-${wIdx} `} className="unit-row">
                                        <span>{u.name}</span>
                                        <span className="min-max">{u.min}-{u.max}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div >
    );
}

function UnitPerspectiveView({ chart, db, factionId }: { chart: any, db: any, factionId: number }) {
    const { openUnitModal } = useModal();
    // Get all units in this faction
    const units = useMemo(() => {
        return db.units.filter((u: any) => u.factions.includes(factionId))
            .sort((a: any, b: any) => a.name.localeCompare(b.name));
    }, [db, factionId]);

    // Map Unit Slug -> Fireteams
    const unitFireteamMap = useMemo(() => {
        const map = new Map<string, Fireteam[]>(); // Key is SLUG
        const normalize = (s: string) => s.toLowerCase();

        const wildcards = chart.teams.find((t: Fireteam) => t.name.toLowerCase().includes('wildcard'));
        const regularTeams = chart.teams.filter((t: Fireteam) => !t.name.toLowerCase().includes('wildcard'));

        // Helper to add team to map
        const add = (slug: string, team: Fireteam) => {
            if (!map.has(slug)) map.set(slug, []);
            const existing = map.get(slug)!;
            if (!existing.some(t => t.name === team.name)) {
                existing.push(team);
            }
        };

        // 1. Process Regular Teams (Explicit Membership)
        regularTeams.forEach((team: Fireteam) => {
            team.units.forEach((u: FireteamUnit) => {
                add(normalize(u.slug), team);
            });
        });

        // 2. Process Wildcards (Can join ANY regular team)
        if (wildcards) {
            wildcards.units.forEach((u: FireteamUnit) => {
                const s = normalize(u.slug);
                // For every regular team, add this wildcard
                regularTeams.forEach((targetTeam: Fireteam) => {
                    add(s, targetTeam);
                });
            });
        }

        return map;
    }, [chart]);

    return (
        <div className="unit-perspective-list">
            {units.map((unit: any) => {
                const slug = unit.raw.slug || unit.isc.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                let exactTeams = unitFireteamMap.get(slug) || [];

                if (exactTeams.length === 0) return null;

                // Sort teams by name
                exactTeams.sort((a, b) => a.name.localeCompare(b.name));

                return (
                    <div key={unit.id} className="unit-perspective-card">
                        <div className="unit-info" style={{ display: 'flex', alignItems: 'center' }}>
                            {unit.name}
                            <button
                                className="info-btn"
                                onClick={() => openUnitModal(unit)}
                                title="View Unit Stats"
                            >
                                <Info size={16} />
                            </button>
                        </div>
                        <div className="teams-list">
                            {exactTeams.map((team: Fireteam, idx) => {
                                // Logic: Does match?
                                // Check if unit name or counts-as matches team name (roughly)
                                // Simplified approach: 
                                // 1. Unit Name is part of Team Name (e.g. Fusilier in Fusilier Fireteam)
                                // 2. Unit "Counts As" contains key part of Team Name (e.g. "Fennec" in Fennecs Team)
                                // We can use helper from fireteams.ts if needed, but simple string match is decent here.

                                const teamSimple = team.name.toLowerCase();

                                // Get explicit counts-as from the fireteam definition if available
                                // (This is tricky because we are iterating generic 'exactTeams', 
                                // we need to find the definition of THIS unit in THIS team or WILDCARD team)

                                let definition = team.units.find(u => u.slug === slug);
                                if (!definition) {
                                    // Must be wildcard
                                    const wildTeam = chart.teams.find((t: Fireteam) => t.name.toLowerCase().includes('wildcard'));
                                    definition = wildTeam?.units.find((u: FireteamUnit) => u.slug === slug);
                                }

                                const tags = getUnitTags(unit.name, definition?.comment);

                                // Match Logic:
                                // Does it "Count As" the team?
                                // Check tags AND unit name against team name words
                                const teamWords = teamSimple.split(' ').filter(w => w.length > 3 && w !== 'fireteam');

                                // Add unit name to check list
                                const checkList = [unit.name, ...tags];

                                const countsAsMatch = checkList.some(tag => {
                                    const tagLower = tag.toLowerCase();
                                    return teamWords.some(w => tagLower.includes(w) || w.includes(tagLower));
                                });

                                const isNominalMember = countsAsMatch;

                                // Highlighting:
                                // Green glow if it's a "Nominal Member" (likely raises level)

                                return (
                                    <div key={idx} className={`team-tag ${isNominalMember ? 'nominal-member' : ''} `}>
                                        <div className="team-name">{team.name}</div>
                                        <div className="team-types">
                                            {team.type.includes('CORE') && <span className="type-badge core" title="Core">C</span>}
                                            {team.type.includes('HARIS') && <span className="type-badge haris" title="Haris">H</span>}
                                            {team.type.includes('DUO') && <span className="type-badge duo" title="Duo">D</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function FireteamBuilder({ chart }: { chart: any }) {
    const db = useDatabase();
    const { openUnitModal } = useModal();
    const [selectedTeam, setSelectedTeam] = useState<Fireteam | null>(null);
    const [teamMembers, setTeamMembers] = useState<FireteamUnit[]>([]);

    // Determine max team size based on team type
    const maxTeamSize = useMemo(() => {
        if (!selectedTeam) return 0;
        if (selectedTeam.type.includes('CORE')) return 5;
        if (selectedTeam.type.includes('HARIS')) return 3;
        if (selectedTeam.type.includes('DUO')) return 2;
        return 5;
    }, [selectedTeam]);

    // Get wildcards
    const wildcards = useMemo(() => {
        const wTeam = chart.teams.find((t: Fireteam) => t.name.toLowerCase().includes('wildcard'));
        return wTeam ? wTeam.units : [];
    }, [chart]);

    const regularTeams = useMemo(() => {
        return chart.teams.filter((t: Fireteam) => !t.name.toLowerCase().includes('wildcard'));
    }, [chart]);

    const handleSelectTeam = (team: Fireteam) => {
        setSelectedTeam(team);
        setTeamMembers([]); // Reset members
    };

    const handleAddMember = (unit: FireteamUnit) => {
        if (teamMembers.length >= maxTeamSize) return;
        setTeamMembers([...teamMembers, unit]);
    };

    const handleRemoveMember = (idx: number) => {
        const newMembers = [...teamMembers];
        newMembers.splice(idx, 1);
        setTeamMembers(newMembers);
    };

    // Calculate Bonuses
    const bonuses = useMemo(() => {
        if (!selectedTeam) return [];
        return getFireteamBonuses(selectedTeam, teamMembers);
    }, [selectedTeam, teamMembers]);

    return (
        <div className="builder-container">
            {/* Left Column: Selection */}
            <div className="builder-selection">
                <h3>1. Select Team Type</h3>
                <div className="team-selector">
                    {regularTeams.map((team: Fireteam, idx: number) => (
                        <button
                            key={idx}
                            className={`team-select-btn ${selectedTeam?.name === team.name ? 'selected' : ''} `}
                            onClick={() => handleSelectTeam(team)}
                        >
                            {team.name}
                        </button>
                    ))}
                </div>

                {selectedTeam && (
                    <>
                        <h3 style={{ marginTop: '1.5rem' }}>2. Add Units</h3>
                        {(() => {
                            // --- DYNAMIC VALIDATION LOGIC ---
                            const members = teamMembers;

                            // 1. Calculate Missing Requirements
                            const memberCounts = new Map<string, number>();
                            members.forEach(m => {
                                const name = m.name.toLowerCase();
                                memberCounts.set(name, (memberCounts.get(name) || 0) + 1);
                            });

                            let missingRequirements = false;

                            // Check A: Individual Minimums
                            selectedTeam.units.forEach(u => {
                                if (u.min > 0) {
                                    const current = memberCounts.get(u.name.toLowerCase()) || 0;
                                    if (current < u.min) missingRequirements = true;
                                }
                            });

                            // Check B: Group Requirement (*)
                            const requiredGroup = selectedTeam.units.filter(u => u.required);
                            let groupRequirementMet = false;
                            if (requiredGroup.length > 0) {
                                for (const reqUnit of requiredGroup) {
                                    if ((memberCounts.get(reqUnit.name.toLowerCase()) || 0) > 0) {
                                        groupRequirementMet = true;
                                        break;
                                    }
                                }
                                if (!groupRequirementMet) missingRequirements = true;
                            } else {
                                // No group requirement exists, so it's "met" by default
                                groupRequirementMet = true;
                            }

                            // HELPER: Does this unit help satisfy a CURRENTLY MISSING requirement?
                            const helpsRequirement = (u: FireteamUnit) => {
                                const name = u.name.toLowerCase();

                                // 1. Helps Individual Min?
                                const def = selectedTeam.units.find(d => d.name.toLowerCase() === name);
                                if (def && def.min > 0) {
                                    const current = memberCounts.get(name) || 0;
                                    if (current < def.min) return true;
                                }

                                // 2. Helps Group Requirement?
                                // Only relevant if the group requirement is NOT yet met.
                                if (!groupRequirementMet && u.required) {
                                    return true;
                                }

                                return false;
                            };

                            // LOGIC:
                            // If there are missing requirements, ONLY allow units that help satisfy them.
                            // If all requirements are met, allow anything (up to max size).
                            const strictMode = missingRequirements;

                            // Helper to check if unit raises level
                            const currentLevel = calculateFireteamLevel(selectedTeam.name, teamMembers);
                            const simulatesLevelUp = (u: FireteamUnit) => {
                                const newLevel = calculateFireteamLevel(selectedTeam.name, [...teamMembers, u]);
                                return newLevel > currentLevel;
                            };

                            const renderPoolItem = (u: FireteamUnit, idx: number, type: 'member' | 'wildcard') => {
                                const isRequiredHelper = helpsRequirement(u);
                                const isLevelUp = simulatesLevelUp(u);

                                let isDisabled = false;
                                if (teamMembers.length >= maxTeamSize) {
                                    isDisabled = true;
                                } else if (strictMode) {
                                    // In strict mode, MUST help with a requirement
                                    if (!isRequiredHelper) isDisabled = true;
                                }

                                const countsAs = getUnitTags(u.name, u.comment);
                                const countsAsStr = countsAs.filter(c => c !== u.name.toLowerCase()).join(', ');

                                return (
                                    <button
                                        key={`${type} -${idx} `}
                                        className={`pool-item ${isLevelUp ? 'level-up' : ''} ${isRequiredHelper ? 'required-glow' : ''} `}
                                        onClick={() => handleAddMember(u)}
                                        disabled={isDisabled}
                                        style={isDisabled ? { opacity: 0.3, filter: 'grayscale(100%)' } : {}}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {u.name}
                                                {countsAsStr && <span className="counts-as-tiny">({countsAsStr})</span>}
                                            </span>
                                            {/* Clean visuals: removed text tags */}
                                        </div>
                                        <Plus size={16} />
                                    </button>
                                );
                            };

                            return (
                                <div className="unit-pool">
                                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Team Members</div>
                                    {selectedTeam.units.map((u: FireteamUnit, i: number) => renderPoolItem(u, i, 'member'))}

                                    {wildcards.length > 0 && (
                                        <>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Wildcards</div>
                                            {wildcards.map((u: FireteamUnit, i: number) => renderPoolItem(u, i, 'wildcard'))}
                                        </>
                                    )}
                                </div>
                            );
                        })()}
                    </>
                )}
            </div>

            {/* Right Column: Workspace */}
            <div className="builder-workspace">
                {!selectedTeam ? (
                    <div className="empty-state" style={{ height: '100%' }}>
                        <Calculator size={48} className="text-secondary" />
                        <p>Select a Fireteam from the left to start building.</p>
                    </div>
                ) : (
                    <>
                        <div className="active-team-card">
                            <div className="card-header" style={{ marginBottom: '1.5rem', background: 'transparent', borderBottom: 'none', padding: 0 }}>
                                <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{selectedTeam.name} Composition</h3>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    {selectedTeam.type.map(t => (
                                        <span key={t} className={`badge ${t.toLowerCase()} `}>{t}</span>
                                    ))}
                                    <span style={{ marginLeft: 'auto', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Max Size: {maxTeamSize}
                                    </span>
                                </div>
                            </div>

                            <div className="team-slots">
                                {Array.from({ length: 5 }).map((_, idx) => {
                                    const member = teamMembers[idx];
                                    const isLocked = idx >= maxTeamSize;

                                    if (isLocked) {
                                        return (
                                            <div key={idx} className="member-slot locked">
                                                {/* Locked Slot */}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={idx} className={`member-slot ${member ? 'filled' : 'empty'} `}>
                                            {member ? (
                                                <>
                                                    <div className="slot-content">
                                                        <div style={{ fontWeight: 'bold' }}>{member.name}</div>
                                                        {(() => {
                                                            const tags = getUnitTags(member.name, member.comment || '');
                                                            // Filter out the unit's own name (case insensitive)
                                                            const countsAsTag = tags.find(t => t.toLowerCase() !== member.name.toLowerCase());

                                                            if (countsAsTag) {
                                                                return (
                                                                    <div style={{ fontSize: '0.8rem', opacity: 0.7, fontStyle: 'italic' }}>
                                                                        ({countsAsTag})
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                        <button
                                                            className="info-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const fullUnit = db.getUnitBySlug(member.slug);
                                                                if (fullUnit) openUnitModal(fullUnit);
                                                            }}
                                                            style={{ marginTop: '0.25rem' }}
                                                            title="View Unit Stats"
                                                        >
                                                            <Info size={16} /> Profile
                                                        </button>
                                                    </div>
                                                    <button
                                                        className="remove-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveMember(idx);
                                                        }}
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="slot-content" style={{ opacity: 0.3 }}>
                                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                                                        {idx + 1}
                                                    </div>
                                                    <span>Empty Slot</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="bonus-panel">
                                <h4>Active Bonuses</h4>
                                <div className="bonus-list">
                                    {bonuses.map((bonus, idx) => (
                                        <div key={idx} className={`bonus-item ${bonus.isActive ? 'active' : ''} `}>
                                            <div className="bonus-check">
                                                {bonus.isActive ? <Check size={14} /> : <span style={{ fontSize: '10px' }}>{bonus.level}</span>}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <strong>Level {bonus.level}: </strong>
                                                <span>{bonus.description}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
