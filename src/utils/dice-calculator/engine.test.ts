
import { describe, it, expect } from 'vitest';
import { createInfinityDie, solveF2F, calculateExpectedWounds, WoundResults } from './engine';

function checkResults(
    actual: WoundResults,
    expected: any,
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

        // Pass bArm = 3 (6th argument)
        const res = calculateExpectedWounds(
            f2f,
            13, 0, 'N',
            10, 3, 'N'
        );

        const totalRolls = 10000;

        // P(Active Win) approx 0.6475.
        // P(Save) = 0.8 (16/20).
        // P(Active 0) = 0.6475 * 0.8 = 0.518 (5180).
        // P(Active 1) = 0.6475 * 0.2 = 0.1295 (1295).

        const expWounds1 = 0.1295 * totalRolls;
        const expWounds0 = 0.518 * totalRolls;

        const expected = {
            'active': {
                1: expWounds1,
                0: expWounds0
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
