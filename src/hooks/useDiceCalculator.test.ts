import { describe, it, expect } from 'vitest';
import { computeDiceResults, type PlayerParams } from './useDiceCalculator';

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
    weaponBands: [],
};

function makeParams(overrides: Partial<PlayerParams> = {}): PlayerParams {
    return { ...DEFAULT_PARAMS, ...overrides };
}

describe('computeDiceResults - freeform mode', () => {
    it('returns non-null for valid inputs', () => {
        const result = computeDiceResults(
            'freeform',
            makeParams(),
            makeParams({ burst: 1 }),
            0
        );
        expect(result).not.toBeNull();
    });

    it('active + reactive + fail probabilities sum to ~1.0', () => {
        const result = computeDiceResults(
            'freeform',
            makeParams({ sv: 14, burst: 3 }),
            makeParams({ sv: 10, burst: 1 }),
            0
        );
        expect(result).not.toBeNull();
        const total = result!.active.winProbability +
            result!.reactive.winProbability +
            result!.failProbability;
        expect(total).toBeCloseTo(1.0, 2);
    });

    it('higher burst gives higher win probability', () => {
        const lowBurst = computeDiceResults(
            'freeform',
            makeParams({ sv: 13, burst: 1 }),
            makeParams({ sv: 13, burst: 1 }),
            0
        );
        const highBurst = computeDiceResults(
            'freeform',
            makeParams({ sv: 13, burst: 4 }),
            makeParams({ sv: 13, burst: 1 }),
            0
        );
        expect(highBurst!.active.winProbability).toBeGreaterThan(
            lowBurst!.active.winProbability
        );
    });

    it('higher SV gives higher win probability', () => {
        const lowSv = computeDiceResults(
            'freeform',
            makeParams({ sv: 8 }),
            makeParams({ sv: 13, burst: 1 }),
            0
        );
        const highSv = computeDiceResults(
            'freeform',
            makeParams({ sv: 18 }),
            makeParams({ sv: 13, burst: 1 }),
            0
        );
        expect(highSv!.active.winProbability).toBeGreaterThan(
            lowSv!.active.winProbability
        );
    });

    it('DA ammo increases expected wounds vs normal', () => {
        const normal = computeDiceResults(
            'freeform',
            makeParams({ ammo: 'N', burst: 3 }),
            makeParams({ burst: 1 }),
            0
        );
        const da = computeDiceResults(
            'freeform',
            makeParams({ ammo: 'DA', burst: 3 }),
            makeParams({ burst: 1 }),
            0
        );
        expect(da!.active.expectedWounds).toBeGreaterThan(
            normal!.active.expectedWounds
        );
    });

    it('ignores distance and cover in freeform mode', () => {
        const noCover = computeDiceResults(
            'freeform',
            makeParams({ sv: 13, burst: 3 }),
            makeParams({ sv: 10, burst: 1, cover: false }),
            0
        );
        const withCover = computeDiceResults(
            'freeform',
            makeParams({ sv: 13, burst: 3 }),
            makeParams({ sv: 10, burst: 1, cover: true }),
            0
        );
        // In freeform, cover doesn't modify SV
        expect(noCover!.active.winProbability).toBeCloseTo(
            withCover!.active.winProbability, 5
        );
    });

    it('freeform SV floors at 1 (never 0)', () => {
        const result = computeDiceResults(
            'freeform',
            makeParams({ sv: -5, burst: 1 }),
            makeParams({ sv: 13, burst: 1 }),
            0
        );
        // Should not crash, and active can still win (SV=1 = crit only)
        expect(result).not.toBeNull();
        expect(result!.active.winProbability).toBeGreaterThan(0);
    });
});

describe('computeDiceResults - simulator mode', () => {
    it('cover reduces active win probability in simulator mode', () => {
        const noCover = computeDiceResults(
            'simulator',
            makeParams({ sv: 13, burst: 3, weaponBands: [{ start: 0, end: 32, mod: 0 }] }),
            makeParams({ sv: 10, burst: 1, cover: false }),
            16
        );
        const withCover = computeDiceResults(
            'simulator',
            makeParams({ sv: 13, burst: 3, weaponBands: [{ start: 0, end: 32, mod: 0 }] }),
            makeParams({ sv: 10, burst: 1, cover: true }),
            16
        );
        // Cover gives -3 to attacker SV and +3 ARM → active wins less
        expect(noCover!.active.winProbability).toBeGreaterThan(
            withCover!.active.winProbability
        );
    });

    it('range band mod affects outcome', () => {
        const badRange = computeDiceResults(
            'simulator',
            makeParams({ sv: 13, burst: 3, weaponBands: [{ start: 0, end: 16, mod: -3 }] }),
            makeParams({ sv: 10, burst: 1 }),
            8
        );
        const goodRange = computeDiceResults(
            'simulator',
            makeParams({ sv: 13, burst: 3, weaponBands: [{ start: 0, end: 16, mod: 3 }] }),
            makeParams({ sv: 10, burst: 1 }),
            8
        );
        expect(goodRange!.active.winProbability).toBeGreaterThan(
            badRange!.active.winProbability
        );
    });

    it('beyond max range applies -6 penalty', () => {
        const inRange = computeDiceResults(
            'simulator',
            makeParams({ sv: 13, burst: 3, weaponBands: [{ start: 0, end: 24, mod: 0 }] }),
            makeParams({ sv: 10, burst: 1 }),
            20
        );
        const outOfRange = computeDiceResults(
            'simulator',
            makeParams({ sv: 13, burst: 3, weaponBands: [{ start: 0, end: 24, mod: 0 }] }),
            makeParams({ sv: 10, burst: 1 }),
            30 // beyond 24" max range
        );
        expect(inRange!.active.winProbability).toBeGreaterThan(
            outOfRange!.active.winProbability
        );
    });

    it('AP halves target armor', () => {
        const noAp = computeDiceResults(
            'freeform',
            makeParams({ sv: 13, burst: 3, damage: 14, ap: false }),
            makeParams({ sv: 10, burst: 1, armor: 6 }),
            0
        );
        const withAp = computeDiceResults(
            'freeform',
            makeParams({ sv: 13, burst: 3, damage: 14, ap: true }),
            makeParams({ sv: 10, burst: 1, armor: 6 }),
            0
        );
        // AP halves armor → more wounds
        expect(withAp!.active.expectedWounds).toBeGreaterThan(
            noAp!.active.expectedWounds
        );
    });

    it('miscMod adjusts effective SV in simulator mode', () => {
        const noMod = computeDiceResults(
            'simulator',
            makeParams({ sv: 13, burst: 3, miscMod: 0, weaponBands: [{ start: 0, end: 32, mod: 0 }] }),
            makeParams({ sv: 10, burst: 1 }),
            16
        );
        const withMod = computeDiceResults(
            'simulator',
            makeParams({ sv: 13, burst: 3, miscMod: -6, weaponBands: [{ start: 0, end: 32, mod: 0 }] }),
            makeParams({ sv: 10, burst: 1 }),
            16
        );
        // -6 mod reduces active effectiveness
        expect(noMod!.active.winProbability).toBeGreaterThan(
            withMod!.active.winProbability
        );
    });
});
