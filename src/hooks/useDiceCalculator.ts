import { useState, useMemo } from 'react';
import { createInfinityDie, solveF2F, calculateExpectedWounds, type WoundResults } from '../utils/dice-calculator/engine';
import type { RangeBand } from '../../shared/types';

export interface PlayerParams {
    sv: number;          // Success Value (BS/CC/WIP etc.)
    burst: number;       // Burst value
    damage: number;      // Damage attribute
    armor: number;       // ARM or BTS
    ammo: string;        // Ammo type: 'N', 'DA', 'EXP', 'T2', 'PLASMA'
    ap: boolean;         // AP ammo (halves target armor)
    continuous: boolean; // Continuous damage
    bts: number;         // BTS (for plasma)
    critImmune: boolean; // Critical Immunity
    selectedWeapon?: string; // Name of the currently selected weapon
    cover: boolean;      // Target is in cover (+3 ARM, -3 incoming BS)
    miscMod: number;     // e.g. Mimetism, Range mods
    weaponBands: RangeBand[]; // Range limits and mods
    selectedUnit?: import('../../shared/types').Unit;
    selectedProfile?: import('../../shared/types').Profile;
    selectedOption?: import('../../shared/types').Loadout;
}

export interface CalculatorResults {
    active: {
        wounds: Map<number, number>;
        expectedWounds: number;
        winProbability: number;
    };
    reactive: {
        wounds: Map<number, number>;
        expectedWounds: number;
        winProbability: number;
    };
    failProbability: number;
}

const DEFAULT_PARAMS: PlayerParams = {
    sv: 13,
    burst: 3,
    damage: 13,
    armor: 0,
    ammo: 'N',
    ap: false,
    continuous: false,
    bts: 0,
    critImmune: false,
    cover: false,
    miscMod: 0,
    weaponBands: []
};

// ============================================================================
// Pure computation function — usable outside React
// ============================================================================

export function computeDiceResults(
    mode: 'freeform' | 'simulator',
    activeParams: PlayerParams,
    reactiveParams: PlayerParams,
    distance: number
): CalculatorResults | null {
    try {
        const computeEffectiveSv = (params: PlayerParams, opponentParams: PlayerParams) => {
            let sv = params.sv;

            if (mode === 'freeform') return Math.max(1, sv);

            // 1. Distance Mod
            if (params.weaponBands.length > 0) {
                const band = params.weaponBands.find(b => distance > b.start && distance <= b.end);
                if (band) {
                    sv += band.mod;
                } else if (distance > params.weaponBands[params.weaponBands.length - 1].end) {
                    sv -= 6;
                }
            }

            // 2. Cover Mod (if opponent has cover, -3 to my SV)
            if (opponentParams.cover) {
                sv -= 3;
            }

            // 3. Misc Mod
            sv += params.miscMod;

            return Math.max(1, sv);
        };

        const activeEffectiveSv = computeEffectiveSv(activeParams, reactiveParams);
        const reactiveEffectiveSv = computeEffectiveSv(reactiveParams, activeParams);

        // Create dice distributions
        const activeDie = createInfinityDie(activeEffectiveSv);
        const reactiveDie = createInfinityDie(reactiveEffectiveSv);

        // Solve F2F
        const f2fDist = solveF2F(
            activeParams.burst,
            reactiveParams.burst,
            activeDie,
            reactiveDie
        );

        // Apply AP halving and Cover (+3 ARM)
        const getEffectiveArmor = (defParams: PlayerParams, attParams: PlayerParams) => {
            let armor = defParams.armor;
            if (mode === 'simulator' && defParams.cover) armor += 3;
            return attParams.ap ? Math.ceil(armor / 2) : armor;
        };

        const activeArmVsReactive = getEffectiveArmor(activeParams, reactiveParams);
        const activeBtsVsReactive = reactiveParams.ap ? Math.ceil(activeParams.bts / 2) : activeParams.bts;

        const reactiveArmVsActive = getEffectiveArmor(reactiveParams, activeParams);
        const reactiveBtsVsActive = activeParams.ap ? Math.ceil(reactiveParams.bts / 2) : reactiveParams.bts;

        // Calculate wounds
        const woundResults: WoundResults = calculateExpectedWounds(
            f2fDist,
            activeParams.damage,
            activeArmVsReactive,
            activeParams.ammo,
            reactiveParams.damage,
            reactiveArmVsActive,
            reactiveParams.ammo,
            activeParams.continuous,
            activeBtsVsReactive,
            activeParams.critImmune,
            reactiveParams.continuous,
            reactiveBtsVsActive,
            reactiveParams.critImmune
        );

        // Calculate expected values and probabilities
        const calcExpected = (wounds: Map<number, number>) => {
            let sum = 0;
            for (const [w, p] of wounds.entries()) {
                sum += w * p;
            }
            return sum;
        };

        const calcWinProbability = (wounds: Map<number, number>) => {
            let sum = 0;
            for (const [, p] of wounds.entries()) {
                sum += p;
            }
            return sum;
        };

        const failProb = woundResults.fail.get(0) || 0;

        return {
            active: {
                wounds: woundResults.active,
                expectedWounds: calcExpected(woundResults.active),
                winProbability: calcWinProbability(woundResults.active)
            },
            reactive: {
                wounds: woundResults.reactive,
                expectedWounds: calcExpected(woundResults.reactive),
                winProbability: calcWinProbability(woundResults.reactive)
            },
            failProbability: failProb
        };
    } catch (error) {
        console.error('Dice calculation error:', error);
        return null;
    }
}

// ============================================================================
// React hook — two signatures:
//   1. useDiceCalculator(mode) — self-contained with own state (for tests)
//   2. useDiceCalculator(mode, activeParams, reactiveParams, distance)
//      — computation only using external state (for store integration)
// ============================================================================

export function useDiceCalculator(mode?: 'freeform' | 'simulator'): {
    distance: number;
    setDistance: React.Dispatch<React.SetStateAction<number>>;
    activeParams: PlayerParams;
    reactiveParams: PlayerParams;
    setActiveParams: React.Dispatch<React.SetStateAction<PlayerParams>>;
    setReactiveParams: React.Dispatch<React.SetStateAction<PlayerParams>>;
    results: CalculatorResults | null;
};
export function useDiceCalculator(
    mode: 'freeform' | 'simulator',
    activeParams: PlayerParams,
    reactiveParams: PlayerParams,
    distance: number
): CalculatorResults | null;
export function useDiceCalculator(
    mode: 'freeform' | 'simulator' = 'simulator',
    externalActive?: PlayerParams,
    externalReactive?: PlayerParams,
    externalDistance?: number
) {
    // Self-contained state (only used when no external params provided)
    const [distance, setDistance] = useState<number>(16);
    const [activeParams, setActiveParams] = useState<PlayerParams>(DEFAULT_PARAMS);
    const [reactiveParams, setReactiveParams] = useState<PlayerParams>({ ...DEFAULT_PARAMS, burst: 1 });

    const isExternalMode = externalActive !== undefined;
    const effectiveActive = isExternalMode ? externalActive : activeParams;
    const effectiveReactive = isExternalMode ? externalReactive! : reactiveParams;
    const effectiveDistance = isExternalMode ? externalDistance! : distance;

    const results = useMemo<CalculatorResults | null>(() => {
        return computeDiceResults(mode, effectiveActive, effectiveReactive, effectiveDistance);
    }, [mode, effectiveActive, effectiveReactive, effectiveDistance]);

    if (isExternalMode) {
        // External mode: return just the results
        return results;
    }

    // Self-contained mode: return full state + results
    return {
        distance,
        setDistance,
        activeParams,
        reactiveParams,
        setActiveParams,
        setReactiveParams,
        results
    };
}
