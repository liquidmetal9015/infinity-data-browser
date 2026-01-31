// Weapon Stats Table Component
import * as d3 from 'd3';
import type { ParsedWeapon } from './types';
import { RANGE_BANDS } from './types';

interface WeaponTableProps {
    weapons: ParsedWeapon[];
    onRemoveWeapon: (id: number) => void;
}

export function WeaponTable({ weapons, onRemoveWeapon }: WeaponTableProps) {
    if (weapons.length === 0) return null;

    return (
        <div className="stats-section">
            <table className="weapon-table">
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
                                <td className="weapon-cell-name">
                                    <div className="color-indicator" style={{ background: color }}></div>
                                    <span style={{ fontWeight: 600 }}>{w.name}</span>
                                </td>
                                <td className="weapon-cell-ranges">
                                    <div className="range-strip-row">
                                        {RANGE_BANDS.slice(0, 7).map((band, idx) => {
                                            const samplePoint = band.start + 1;
                                            const bandMod = w.bands.find(b => b.start < samplePoint && b.end >= samplePoint)?.mod ?? null;

                                            let modClass = 'mod-0';
                                            let content: string | number = '-';

                                            // Template Handling
                                            if (w.templateType && w.templateType !== 'none') {
                                                const tLen = w.templateType === 'small' ? 8.4 : 10.2;
                                                if (band.start < tLen) {
                                                    modClass = 'mod-template';
                                                    content = 'DT';
                                                } else {
                                                    modClass = 'mod-none';
                                                    content = '-';
                                                }
                                            } else {
                                                if (bandMod === null) {
                                                    modClass = 'mod-none';
                                                    content = '-';
                                                }
                                                else if (bandMod > 0) {
                                                    modClass = 'mod-pos';
                                                    content = `+${bandMod}`;
                                                }
                                                else if (bandMod < 0) {
                                                    modClass = 'mod-neg';
                                                    content = bandMod;
                                                } else {
                                                    content = '0';
                                                }
                                            }

                                            return (
                                                <div key={idx} className={`range-cell ${modClass}`} title={band.label}>
                                                    {content}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </td>
                                <td className="text-center font-medium">{w.damage}</td>
                                <td className="text-center font-medium">{w.burst}</td>
                                <td className="text-center text-sm">{w.ammunition}</td>
                                <td className="text-center text-sm">{w.saving}</td>
                                <td className="text-center text-sm">{w.savingNum || '-'}</td>
                                <td className="weapon-cell-traits">
                                    <div className="traits-list">
                                        {w.properties.map(p => <span key={p} className="trait-text">{p}</span>)}
                                    </div>
                                </td>
                                <td>
                                    <button
                                        className="remove-row-btn"
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
