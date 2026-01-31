import { useState, useMemo } from 'react';
import { createInfinityDie, solveF2F, calculateExpectedWounds, type WoundResults } from '../utils/dice-calculator/engine';

export interface PlayerParams {
    sv: number;          // Success Value (BS/CC/WIP etc.)
    burst: number;       // Burst value
    damage: number;      // Damage attribute
    armor: number;       // ARM or BTS
    ammo: string;        // Ammo type: 'N', 'DA', 'EXP', 'T2', 'PLASMA'
    continuous: boolean; // Continuous damage
    bts: number;         // BTS (for plasma)
    critImmune: boolean; // Critical Immunity
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
    continuous: false,
    bts: 0,
    critImmune: false
};

export function useDiceCalculator() {
    const [activeParams, setActiveParams] = useState<PlayerParams>(DEFAULT_PARAMS);
    const [reactiveParams, setReactiveParams] = useState<PlayerParams>({ ...DEFAULT_PARAMS, burst: 1 });

    const results = useMemo<CalculatorResults | null>(() => {
        try {
            // Create dice distributions
            const activeDie = createInfinityDie(activeParams.sv);
            const reactiveDie = createInfinityDie(reactiveParams.sv);

            // Solve F2F
            const f2fDist = solveF2F(
                activeParams.burst,
                reactiveParams.burst,
                activeDie,
                reactiveDie
            );

            // Calculate wounds
            const woundResults: WoundResults = calculateExpectedWounds(
                f2fDist,
                activeParams.damage,      // aOpponentSave
                activeParams.armor,       // aArm
                activeParams.ammo,        // aAmmo
                reactiveParams.damage,    // bOpponentSave
                reactiveParams.armor,     // bArm
                reactiveParams.ammo,      // bAmmo
                activeParams.continuous,  // aCont
                activeParams.bts,         // aBts
                activeParams.critImmune,  // aCritImmune
                reactiveParams.continuous, // bCont
                reactiveParams.bts,       // bBts
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
        activeParams,
        reactiveParams,
        setActiveParams,
        setReactiveParams,
        results
    };
}
