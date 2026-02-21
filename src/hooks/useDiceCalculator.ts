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
    selectedUnit?: any;  // The whole Unit object
    selectedProfile?: any; // The chosen Profile object
    selectedOption?: any; // To access weapons
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

export function useDiceCalculator(mode: 'freeform' | 'simulator' = 'simulator') {
    const [distance, setDistance] = useState<number>(16); // Default 16 inches
    const [activeParams, setActiveParams] = useState<PlayerParams>(DEFAULT_PARAMS);
    const [reactiveParams, setReactiveParams] = useState<PlayerParams>({ ...DEFAULT_PARAMS, burst: 1 });

    const results = useMemo<CalculatorResults | null>(() => {
        try {
            // Helper to compute effective SV
            const computeEffectiveSv = (params: PlayerParams, opponentParams: PlayerParams) => {
                let sv = params.sv;

                if (mode === 'freeform') return Math.max(1, sv);

                // 1. Distance Mod
                if (params.weaponBands.length > 0) {
                    const band = params.weaponBands.find(b => distance > b.start && distance <= b.end);
                    if (band) {
                        sv += band.mod;
                    } else if (distance > params.weaponBands[params.weaponBands.length - 1].end) {
                        // Beyond max range, technically a miss but we'll apply a steep penalty or just -6
                        sv -= 6;
                    }
                }

                // 2. Cover Mod (if opponent has cover, -3 to my SV)
                if (opponentParams.cover) {
                    sv -= 3;
                }

                // 3. Misc Mod
                sv += params.miscMod;

                return Math.max(1, sv); // SV theoretically can't go below 1 (though target number > 0)
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
                activeParams.damage,      // aPS
                activeArmVsReactive,      // aArm
                activeParams.ammo,        // aAmmo
                reactiveParams.damage,    // bPS
                reactiveArmVsActive,      // bArm
                reactiveParams.ammo,      // bAmmo
                activeParams.continuous,  // aCont
                activeBtsVsReactive,      // aBts
                activeParams.critImmune,  // aCritImmune
                reactiveParams.continuous, // bCont
                reactiveBtsVsActive,      // bBts
                reactiveParams.critImmune // bCritImmune
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
    }, [activeParams, reactiveParams]);

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
