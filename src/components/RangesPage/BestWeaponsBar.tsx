// Best Weapons Analysis Bar Component
import { Trophy } from 'lucide-react';
import * as d3 from 'd3';
import type { ParsedWeapon, BestWeaponInfo } from './types';
import styles from '../../pages/RangesPage.module.css';

interface BestWeaponsBarProps {
    bestWeapons: (BestWeaponInfo | null)[];
    selectedWeapons: ParsedWeapon[];
}

export function BestWeaponsBar({ bestWeapons, selectedWeapons }: BestWeaponsBarProps) {
    return (
        <div className={styles.analysisBar}>
            <h3><Trophy size={14} /> Best Options</h3>
            <div className={styles.rangeStrip}>
                {bestWeapons.map((item, i) => {
                    if (!item || !item.weapon || item.band.start >= 48) return null;
                    const weapon = item.weapon as ParsedWeapon;
                    const weaponIndex = selectedWeapons.findIndex(w => w.id === weapon.id);
                    const color = d3.schemeCategory10[weaponIndex % 10];
                    return (
                        <div key={i} data-testid="range-block" className={styles.rangeBlock} style={{ flex: 1, borderTop: `3px solid ${color}` }}>
                            <div className={styles.rangeLabel}>{item.band.label}</div>
                            <div className={styles.winnerName} style={{ color }}>{weapon.name}</div>
                            <div className={styles.winnerMod}>
                                {item.mod > 0 ? '+' : ''}{item.mod}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
