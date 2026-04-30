// Weapon Stats Table Component
import { clsx } from 'clsx';
import * as d3 from 'd3';
import type { ParsedWeapon } from './types';
import { RANGE_BANDS } from './types';
import styles from '../../pages/RangesPage.module.css';

interface WeaponTableProps {
    weapons: ParsedWeapon[];
    onRemoveWeapon: (id: number) => void;
}

export function WeaponTable({ weapons, onRemoveWeapon }: WeaponTableProps) {
    if (weapons.length === 0) return null;

    return (
        <div className={styles.statsSection}>
            <table className={styles.weaponTable}>
                <thead>
                    <tr>
                        <th style={{ width: '20%' }}>Name</th>
                        <th style={{ width: '25%' }}>Range</th>
                        <th className="text-center" title="Power / Damage">PS</th>
                        <th className="text-center" title="Burst">B</th>
                        <th className="text-center">AMMO</th>
                        <th className="text-center">SR: ATTRIB</th>
                        <th className="text-center" title="Saving Roll Number">SR: No</th>
                        <th style={{ width: '20%' }}>Traits</th>
                        <th style={{ width: '30px' }}></th>
                    </tr>
                </thead>
                <tbody>
                    {weapons.map((w, i) => {
                        const color = d3.schemeCategory10[i % 10];
                        return (
                            <tr key={w.id}>
                                <td className={styles.weaponCellName}>
                                    <div className={styles.colorIndicator} style={{ background: color }}></div>
                                    <span style={{ fontWeight: 600 }}>{w.name}</span>
                                </td>
                                <td>
                                    <div className={styles.rangeStripRow}>
                                        {RANGE_BANDS.slice(0, 7).map((band, idx) => {
                                            const samplePoint = band.start + 1;
                                            const bandMod = w.bands.find(b => b.start < samplePoint && b.end >= samplePoint)?.mod ?? null;

                                            let modClass = styles.mod0;
                                            let content: string | number = '-';

                                            if (w.templateType && w.templateType !== 'none') {
                                                const tLen = w.templateType === 'small' ? 8.4 : 10.2;
                                                if (band.start < tLen) {
                                                    modClass = styles.modTemplate;
                                                    content = 'DT';
                                                } else {
                                                    modClass = styles.modNone;
                                                    content = '-';
                                                }
                                            } else {
                                                if (bandMod === null) {
                                                    modClass = styles.modNone;
                                                    content = '-';
                                                } else if (bandMod > 0) {
                                                    modClass = styles.modPos;
                                                    content = `+${bandMod}`;
                                                } else if (bandMod < 0) {
                                                    modClass = styles.modNeg;
                                                    content = bandMod;
                                                } else {
                                                    content = '0';
                                                }
                                            }

                                            return (
                                                <div key={idx} className={clsx(styles.rangeCell, modClass)} title={band.label}>
                                                    {content}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </td>
                                <td className="text-center font-medium">{w.damage}</td>
                                <td className="text-center font-medium">{w.burst}</td>
                                <td className="text-center text-sm">{w.ammunition}</td>
                                <td className="text-center text-sm">{w.saving}</td>
                                <td className="text-center text-sm">{w.savingNum || '-'}</td>
                                <td>
                                    <div className={styles.traitsList}>
                                        {w.properties.map(p => <span key={p} className={styles.traitText}>{p}</span>)}
                                    </div>
                                </td>
                                <td>
                                    <button
                                        className={styles.removeRowBtn}
                                        onClick={() => onRemoveWeapon(w.id)}
                                    >×</button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
