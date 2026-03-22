import { useMemo } from 'react';
import { RANGE_BANDS, type BestWeaponInfo } from '../components/RangesPage';
import type { ParsedWeapon } from '@shared/types';

export function useBestWeapons(selectedWeapons: ParsedWeapon[]): (BestWeaponInfo | null)[] {
    return useMemo(() => {
        if (selectedWeapons.length === 0) return [];

        return RANGE_BANDS.map(band => {
            let bestWeapon: ParsedWeapon | null = null;
            let bestMod = -Infinity;
            let secondBestMod = -Infinity;

            selectedWeapons.forEach(w => {
                const samplePoint = band.start + 1;
                const bandMod = w.bands.find(b => b.start < samplePoint && b.end >= samplePoint)?.mod ?? -Infinity;

                if (bandMod > bestMod) {
                    secondBestMod = bestMod;
                    bestMod = bandMod;
                    bestWeapon = w;
                } else if (bandMod > secondBestMod) {
                    secondBestMod = bandMod;
                }
            });

            if (bestMod <= -100) return null;

            return {
                band,
                weapon: bestWeapon,
                mod: bestMod,
                diff: secondBestMod > -Infinity ? bestMod - secondBestMod : 0,
            };
        });
    }, [selectedWeapons]);
}
