import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { useModal } from '../../context/ModalContext';
import type { Fireteam, FireteamUnit, FireteamChart, Unit } from '../../types';
import type { IDatabase } from '../../services/Database';
import { getUnitTags } from '../../utils/fireteams';

interface UnitPerspectiveViewProps {
    chart: FireteamChart;
    db: IDatabase;
    factionId: number;
}

export function UnitPerspectiveView({ chart, db, factionId }: UnitPerspectiveViewProps) {
    const { openUnitModal } = useModal();
    // Get all units in this faction
    const units = useMemo(() => {
        return db.units.filter((u: Unit) => u.factions.includes(factionId))
            .sort((a: Unit, b: Unit) => a.name.localeCompare(b.name));
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
            {units.map((unit: Unit) => {
                const slug = unit.raw.slug || unit.isc.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                const exactTeams = unitFireteamMap.get(slug) || [];

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
                                const teamSimple = team.name.toLowerCase();

                                let definition = team.units.find(u => u.slug === slug);
                                if (!definition) {
                                    const wildTeam = chart.teams.find((t: Fireteam) => t.name.toLowerCase().includes('wildcard'));
                                    definition = wildTeam?.units.find((u: FireteamUnit) => u.slug === slug);
                                }

                                const tags = getUnitTags(unit.name, definition?.comment);

                                const teamWords = teamSimple.split(' ').filter(w => w.length > 3 && w !== 'fireteam');
                                const checkList = [unit.name, ...tags];

                                const countsAsMatch = checkList.some(tag => {
                                    const tagLower = tag.toLowerCase();
                                    return teamWords.some(w => tagLower.includes(w) || w.includes(tagLower));
                                });

                                const isNominalMember = countsAsMatch;

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
