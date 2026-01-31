// Best Weapons Analysis Bar Component
import { Trophy } from 'lucide-react';
import * as d3 from 'd3';
import type { ParsedWeapon, BestWeaponInfo } from './types';

interface BestWeaponsBarProps {
    bestWeapons: (BestWeaponInfo | null)[];
    selectedWeapons: ParsedWeapon[];
}

export function BestWeaponsBar({ bestWeapons, selectedWeapons }: BestWeaponsBarProps) {
    return (
        <div className="analysis-bar">
            <h3><Trophy size={14} /> Best Options</h3>
            <div className="range-strip">
                {bestWeapons.map((item, i) => {
                    if (!item || !item.weapon || item.band.start >= 48) return null;
                    const weapon = item.weapon as ParsedWeapon;
                    const weaponIndex = selectedWeapons.findIndex(w => w.id === weapon.id);
                    const color = d3.schemeCategory10[weaponIndex % 10];
                    return (
                        <div key={i} className="range-block" style={{ flex: 1, borderTop: `3px solid ${color}` }}>
                            <div className="range-label">{item.band.label}</div>
                            <div className="winner-name" style={{ color }}>{weapon.name}</div>
                            <div className="winner-mod">
                                {item.mod > 0 ? '+' : ''}{item.mod}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
