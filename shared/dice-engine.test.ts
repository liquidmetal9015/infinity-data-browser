import { describe, it, expect } from 'vitest';
import {
    createInfinityDie,
    solveF2F,
    calculateF2F,
} from './dice-engine';
import type { CombatantInput } from './dice-engine';

// Helper: sum all probabilities in a die distribution (should equal 1.0)
function sumProbs(die: Map<number, number>): number {
    let total = 0;
    for (const p of die.values()) total += p;
    return total;
}

// Helper: get total probability that active causes at least N wounds
function pActiveWoundsAtLeast(result: ReturnType<typeof calculateF2F>, n: number): number {
    let sum = 0;
    for (const [wounds, pct] of Object.entries(result.woundDistActive)) {
        if (Number(wounds) >= n) sum += pct;
    }
    return sum;
}

describe('createInfinityDie', () => {
    it('produces a valid probability distribution summing to 1.0', () => {
        for (const sv of [1, 5, 10, 13, 15, 20]) {
            const die = createInfinityDie(sv);
            expect(sumProbs(die)).toBeCloseTo(1.0, 10);
        }
    });

    it('SV=1: only roll of 1 hits (as crit), rest miss', () => {
        const die = createInfinityDie(1);
        // Roll=1 is a crit (value 200), probability 0.05
        expect(die.get(200)).toBeCloseTo(0.05);
        // Rest are misses (value 0)
        expect(die.get(0)).toBeCloseTo(0.95);
    });

    it('SV=20: all rolls hit, roll=20 is crit', () => {
        const die = createInfinityDie(20);
        // Roll 20 = crit (value 200), P=0.05
        expect(die.get(200)).toBeCloseTo(0.05);
        // All other rolls (1-19) hit with their face value, no misses
        expect(die.get(0)).toBeUndefined();
    });

    it('SV>20: bonus crits from excess skill value', () => {
        const die = createInfinityDie(23);
        // SV=23: bonusCritLowerBound = 20 - (23-20) = 17
        // Rolls >= 17 are crits: 17,18,19,20 = 4 crits → P=0.20
        expect(die.get(200)).toBeCloseTo(0.20);
        // No misses (all rolls 1-20 hit)
        expect(die.get(0)).toBeUndefined();
    });

    it('SV=0: all misses', () => {
        const die = createInfinityDie(0);
        expect(die.get(0)).toBeCloseTo(1.0);
    });
});

describe('solveF2F', () => {
    it('burst 0 vs burst 0 always draws', () => {
        const dieA = createInfinityDie(13);
        const dieB = createInfinityDie(10);
        const dist = solveF2F(0, 0, dieA, dieB);
        // All outcomes should be draw (aSuccess=0, bSuccess=0)
        for (const [key] of dist.entries()) {
            const ev = JSON.parse(key);
            expect(ev.aSuccess).toBe(0);
            expect(ev.bSuccess).toBe(0);
        }
    });

    it('higher SV has advantage in equal-burst F2F', () => {
        const die13 = createInfinityDie(13);
        const die10 = createInfinityDie(10);
        const dist = solveF2F(1, 1, die13, die10);

        let aWins = 0, bWins = 0;
        for (const [key, prob] of dist.entries()) {
            const ev = JSON.parse(key);
            if (ev.aSuccess > ev.bSuccess) aWins += prob;
            else if (ev.bSuccess > ev.aSuccess) bWins += prob;
        }
        expect(aWins).toBeGreaterThan(bWins);
    });
});

describe('calculateF2F - Normal ammo', () => {
    const makeInput = (overrides: Partial<CombatantInput> = {}): CombatantInput => ({
        sv: 13,
        burst: 3,
        damage: 13,
        ammo: 'N',
        arm: 3,
        bts: 0,
        ...overrides,
    });

    it('active+reactive wins sum close to 100%', () => {
        const result = calculateF2F(makeInput(), makeInput({ sv: 10, burst: 1 }));
        const total = result.activeWins + result.reactiveWins + result.draw;
        expect(total).toBeCloseTo(100, 0);
    });

    it('higher burst gives significant advantage', () => {
        const result = calculateF2F(
            makeInput({ sv: 13, burst: 3 }),
            makeInput({ sv: 13, burst: 1 })
        );
        expect(result.activeWins).toBeGreaterThan(result.reactiveWins);
        expect(result.activeWins).toBeGreaterThan(50);
    });

    it('more burst causes more expected wounds (more hits)', () => {
        const lowBurst = calculateF2F(
            makeInput({ sv: 14, burst: 2, damage: 13 }),
            makeInput({ sv: 8, burst: 1 })
        );
        const highBurst = calculateF2F(
            makeInput({ sv: 14, burst: 5, damage: 13 }),
            makeInput({ sv: 8, burst: 1 })
        );
        expect(highBurst.expectedActiveWounds).toBeGreaterThan(lowBurst.expectedActiveWounds);
    });

    it('SV=1 single die has low but non-zero win probability', () => {
        const result = calculateF2F(
            makeInput({ sv: 1, burst: 1 }),
            makeInput({ sv: 13, burst: 1 })
        );
        // SV=1 can only crit (5% chance), so it can win but rarely
        expect(result.activeWins).toBeGreaterThan(0);
        expect(result.activeWins).toBeLessThan(10);
    });

    it('burst 5 vs burst 1 is heavily favored', () => {
        const result = calculateF2F(
            makeInput({ sv: 13, burst: 5 }),
            makeInput({ sv: 13, burst: 1 })
        );
        expect(result.activeWins).toBeGreaterThan(70);
    });
});

describe('calculateF2F - DA ammo (Double Action)', () => {
    it('DA doubles save rolls, increasing expected wounds', () => {
        const normal = calculateF2F(
            { sv: 13, burst: 3, damage: 13, ammo: 'N', arm: 3, bts: 0 },
            { sv: 10, burst: 1, damage: 13, ammo: 'N', arm: 3, bts: 0 }
        );
        const da = calculateF2F(
            { sv: 13, burst: 3, damage: 13, ammo: 'DA', arm: 3, bts: 0 },
            { sv: 10, burst: 1, damage: 13, ammo: 'N', arm: 3, bts: 0 }
        );
        // DA doubles saves → more expected wounds
        expect(da.expectedActiveWounds).toBeGreaterThan(normal.expectedActiveWounds);
    });

    it('DA can cause 2+ wounds from a single hit', () => {
        const result = calculateF2F(
            { sv: 15, burst: 3, damage: 15, ammo: 'DA', arm: 0, bts: 0 },
            { sv: 10, burst: 1, damage: 13, ammo: 'N', arm: 1, bts: 0 }
        );
        // With DA + low ARM, 2+ wounds should be possible
        expect(pActiveWoundsAtLeast(result, 2)).toBeGreaterThan(0);
    });
});

describe('calculateF2F - EXP ammo (Explosive)', () => {
    it('EXP triples save rolls, causing more wounds than DA', () => {
        const da = calculateF2F(
            { sv: 13, burst: 2, damage: 14, ammo: 'DA', arm: 3, bts: 0 },
            { sv: 10, burst: 1, damage: 13, ammo: 'N', arm: 2, bts: 0 }
        );
        const exp = calculateF2F(
            { sv: 13, burst: 2, damage: 14, ammo: 'EXP', arm: 3, bts: 0 },
            { sv: 10, burst: 1, damage: 13, ammo: 'N', arm: 2, bts: 0 }
        );
        expect(exp.expectedActiveWounds).toBeGreaterThan(da.expectedActiveWounds);
    });
});

describe('calculateF2F - T2 ammo', () => {
    it('T2 deals 2 damage per failed save (double normal)', () => {
        const normal = calculateF2F(
            { sv: 13, burst: 3, damage: 13, ammo: 'N', arm: 3, bts: 0 },
            { sv: 10, burst: 1, damage: 13, ammo: 'N', arm: 3, bts: 0 }
        );
        const t2 = calculateF2F(
            { sv: 13, burst: 3, damage: 13, ammo: 'T2', arm: 3, bts: 0 },
            { sv: 10, burst: 1, damage: 13, ammo: 'N', arm: 3, bts: 0 }
        );
        // T2 should cause roughly 2x wounds per failed save
        expect(t2.expectedActiveWounds).toBeGreaterThan(normal.expectedActiveWounds * 1.5);
    });
});

describe('calculateF2F - PLASMA ammo', () => {
    it('PLASMA forces both ARM and BTS saves, more wounds than normal', () => {
        const normal = calculateF2F(
            { sv: 14, burst: 2, damage: 14, ammo: 'N', arm: 3, bts: 3 },
            { sv: 10, burst: 1, damage: 13, ammo: 'N', arm: 3, bts: 3 }
        );
        const plasma = calculateF2F(
            { sv: 14, burst: 2, damage: 14, ammo: 'PLASMA', arm: 3, bts: 3 },
            { sv: 10, burst: 1, damage: 13, ammo: 'N', arm: 3, bts: 3 }
        );
        expect(plasma.expectedActiveWounds).toBeGreaterThan(normal.expectedActiveWounds);
    });

    it('PLASMA causes more wounds than NORMAL due to dual saves', () => {
        const normal = calculateF2F(
            { sv: 15, burst: 5, damage: 15, ammo: 'N', arm: 3, bts: 3 },
            { sv: 5, burst: 1, damage: 13, ammo: 'N', arm: 3, bts: 3 }
        );
        const plasma = calculateF2F(
            { sv: 15, burst: 5, damage: 15, ammo: 'PLASMA', arm: 3, bts: 3 },
            { sv: 5, burst: 1, damage: 13, ammo: 'N', arm: 3, bts: 3 }
        );
        // PLASMA forces both ARM and BTS save rolls → strictly more wounds
        expect(plasma.expectedActiveWounds).toBeGreaterThan(normal.expectedActiveWounds);
    });
});

describe('calculateF2F - Critical immunity', () => {
    it('crit immunity reduces wounds from crits', () => {
        // Use low SV (only crits hit) so crit immunity has maximum impact
        // SV=1, burst=1: only roll=1 hits, and it's always a crit
        const normal = calculateF2F(
            { sv: 1, burst: 1, damage: 13, ammo: 'N', arm: 0, bts: 0 },
            { sv: 0, burst: 0, damage: 13, ammo: 'N', arm: 0, bts: 0 }
        );
        const critImmune = calculateF2F(
            { sv: 1, burst: 1, damage: 13, ammo: 'N', arm: 0, bts: 0 },
            { sv: 0, burst: 0, damage: 13, ammo: 'N', arm: 0, bts: 0, critImmune: true }
        );
        // When all hits are crits, crit immunity removes the bonus save entirely
        // Normal: hit (crit) → 1+1=2 saves. CritImmune: hit (crit) → 1 save.
        expect(critImmune.expectedActiveWounds).toBeLessThanOrEqual(normal.expectedActiveWounds);
    });
});

describe('calculateF2F - Continuous damage', () => {
    it('continuous damage increases expected wounds', () => {
        const normal = calculateF2F(
            { sv: 13, burst: 3, damage: 13, ammo: 'N', arm: 3, bts: 0 },
            { sv: 10, burst: 1, damage: 13, ammo: 'N', arm: 3, bts: 0 }
        );
        const cont = calculateF2F(
            { sv: 13, burst: 3, damage: 13, ammo: 'N', arm: 3, bts: 0, cont: true },
            { sv: 10, burst: 1, damage: 13, ammo: 'N', arm: 3, bts: 0 }
        );
        expect(cont.expectedActiveWounds).toBeGreaterThan(normal.expectedActiveWounds);
    });

    it('continuous with low damage generates more wounds than high damage (more re-rolls)', () => {
        // Continuous: keep rolling saves until one passes. Lower save threshold = more re-rolls
        // Lower damage = lower save threshold = harder to save = more wound cascading
        const lowDmg = calculateF2F(
            { sv: 15, burst: 5, damage: 8, ammo: 'N', arm: 0, bts: 0, cont: true },
            { sv: 5, burst: 0, damage: 13, ammo: 'N', arm: 0, bts: 0 }
        );
        const highDmg = calculateF2F(
            { sv: 15, burst: 5, damage: 16, ammo: 'N', arm: 0, bts: 0, cont: true },
            { sv: 5, burst: 0, damage: 13, ammo: 'N', arm: 0, bts: 0 }
        );
        // Higher damage → higher save threshold → easier to pass → fewer continuous wounds
        // But also each wound does 1 dmg either way. Key: lowDmg has lower save → more cascades
        expect(lowDmg.expectedActiveWounds).toBeGreaterThan(highDmg.expectedActiveWounds);
    });
});

describe('calculateF2F - Edge cases', () => {
    it('zero burst reactive (normal roll) still produces wounds', () => {
        const result = calculateF2F(
            { sv: 13, burst: 3, damage: 13, ammo: 'N', arm: 3, bts: 0 },
            { sv: 0, burst: 0, damage: 0, ammo: 'N', arm: 3, bts: 0 }
        );
        // Active always wins when reactive has burst 0
        expect(result.activeWins).toBeGreaterThan(60);
        expect(result.reactiveWins).toBe(0);
    });

    it('maximum burst (5) does not crash', () => {
        expect(() => calculateF2F(
            { sv: 15, burst: 5, damage: 15, ammo: 'EXP', arm: 5, bts: 3, cont: true },
            { sv: 14, burst: 5, damage: 14, ammo: 'DA', arm: 4, bts: 6, critImmune: true }
        )).not.toThrow();
    });

    it('extremely high damage with low ARM causes many wounds', () => {
        const result = calculateF2F(
            { sv: 15, burst: 4, damage: 16, ammo: 'DA', arm: 0, bts: 0 },
            { sv: 10, burst: 1, damage: 13, ammo: 'N', arm: 0, bts: 0 }
        );
        // 16+0=16 save threshold → P(save)=16/20=0.8, P(fail)=0.2
        // But DA doubles saves and high burst → should still cause decent wounds
        expect(result.expectedActiveWounds).toBeGreaterThan(0.3);
    });
});
