import { Info } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext';
import { useModal } from '../../context/ModalContext';
import type { Fireteam, FireteamUnit, FireteamChart } from '../../types';

interface FireteamListViewProps {
    chart: FireteamChart;
}

export function FireteamListView({ chart }: FireteamListViewProps) {
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
