import { clsx } from 'clsx';
import { Info } from 'lucide-react';
import { useDatabase } from '../../hooks/useDatabase';
import { useModal } from '../../hooks/useModal';
import type { Fireteam, FireteamUnit, FireteamChart } from '@shared/types';
import styles from './FireteamsPage.module.css';

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
        <div className={styles.fireteamGrid}>
            {regularTeams.map((team: Fireteam, idx: number) => (
                <div key={idx} className={styles.fireteamCard}>
                    <div className={styles.cardHeader}>
                        <h4>{team.name}</h4>
                        <div className={styles.typesRow}>
                            {team.type.includes('CORE') && <span className={clsx(styles.badge, styles.core)}>CORE</span>}
                            {team.type.includes('HARIS') && <span className={clsx(styles.badge, styles.haris)}>HARIS</span>}
                            {team.type.includes('DUO') && <span className={clsx(styles.badge, styles.duo)}>DUO</span>}
                        </div>
                    </div>
                    <div className={styles.cardContent}>
                        {team.units.map((u: FireteamUnit, uIdx: number) => {

                            return (
                                <div key={uIdx} className={clsx(styles.unitRow, u.required && styles.required)}>
                                    <span>
                                        {u.name}
                                        {u.comment && <span className={styles.unitNote} style={{ fontSize: '0.9em', color: 'inherit', marginLeft: '6px', opacity: 0.8 }}>{u.comment}</span>}
                                        <button
                                            className={styles.infoBtn}
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
                                    <span className={styles.minMax}>{u.required ? '*' : u.min}-{u.max}</span>
                                </div>
                            );
                        })}

                        {wildcards && (
                            <div className="wildcard-section" style={{ marginTop: '1rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.25rem', color: 'var(--color-primary)' }}>
                                    + Wildcards (up to limit):
                                </div>
                                {wildcards.units.map((u: FireteamUnit, wIdx: number) => (
                                    <div key={`w-${wIdx} `} className={styles.unitRow}>
                                        <span>{u.name}</span>
                                        <span className={styles.minMax}>{u.min}-{u.max}</span>
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
