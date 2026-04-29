
import { describe, it, expect } from 'vitest';
import { createInfinityDie, solveF2F, calculateExpectedWounds } from './engine';
import type { WoundResults } from './engine';

function checkResults(
    actual: WoundResults,
    expected: Record<string, Record<string, number>>,
    totalRolls: number,
    tolerance: number = 2.0
) {
    if (expected.active) {
        for (const [w, count] of Object.entries(expected.active)) {
            const wounds = Number(w);
            const prob = actual.active.get(wounds) || 0;
            const myCount = prob * totalRolls;
            const diff = Math.abs(myCount - (count as number));
            if (diff >= tolerance) {
                console.error(`Mismatch for Wounds ${w}: Expected ${count}, Got ${myCount} (Diff ${diff})`);
            }
            expect(diff).toBeLessThan(tolerance);
        }
    }
}

describe('Infinity N5 Dice Engine', () => {

    it('smoke_test_n5_save_mechanic', () => {
        const burstA = 1;
        const burstB = 0;
        const dieA = createInfinityDie(13);
        const dieB = createInfinityDie(1);

        const f2f = solveF2F(burstA, burstB, dieA, dieB);

        // bArm = 3 → save threshold = damage(13) + arm(3) = 16
        // P(save) = 16/20 = 0.8
        const res = calculateExpectedWounds(
            f2f,
            13, 0, 'N',
            10, 3, 'N'
        );

        const totalRolls = 10000;

        // Die A (SV 13): P(miss)=7/20=0.35, P(hit non-crit)=12/20=0.6, P(crit)=1/20=0.05
        // Die B has burst 0, so B max is always 0 → active wins on any hit
        // Non-crit wins (P=0.6): 1 save roll. P(save)=0.8, P(fail)=0.2.
        // Crit wins (P=0.05): 2 save rolls. 
        // P(0 wounds) = 0.6 * 0.8 + 0.05 * (0.8 * 0.8) = 0.48 + 0.032 = 0.512
        // P(1 wound) = 0.6 * 0.2 + 0.05 * (2 * 0.8 * 0.2) = 0.12 + 0.016 = 0.136
        // P(2 wounds) = 0.05 * (0.2 * 0.2) = 0.002

        const expected = {
            'active': {
                2: 0.002 * totalRolls,
                1: 0.136 * totalRolls,
                0: 0.512 * totalRolls
            }
        };

        checkResults(res, expected, totalRolls, 100.0);
    });

    it('test_crit_immune_n5', () => {
        const burstA = 1;
        const burstB = 0;
        const dieA = createInfinityDie(20);
        const dieB = createInfinityDie(0);

        const f2f = solveF2F(burstA, burstB, dieA, dieB);
        const res = calculateExpectedWounds(
            f2f,
            10, 0, 'N',
            10, 0, 'N',
            false, 0, false,
            false, 0, true
        );

        const totalRolls = 1000;
        const expected = {
            'active': { 1: 500, 0: 500 }
        };
        checkResults(res, expected, totalRolls);
    });

});
