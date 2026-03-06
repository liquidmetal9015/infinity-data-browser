// dice-engine.ts - Infinity N5 Dice Calculator Engine (shared module)
// Implements N5 Rules: "Probability of Survival" (Roll Under PS to Save)
// Used by both frontend and MCP server

export interface InfinityF2FOutcome {
    aSuccess: number;
    aCrit: boolean;
    bSuccess: number;
    bCrit: boolean;
}

export interface WoundResults {
    active: Map<number, number>;
    reactive: Map<number, number>;
    fail: Map<number, number>;
    totalRolls: number;
}

export interface F2FResult {
    activeWins: number;
    reactiveWins: number;
    draw: number;
    expectedActiveWounds: number;
    expectedReactiveWounds: number;
    woundDistActive: Record<number, number>;
    woundDistReactive: Record<number, number>;
}

// ---------------------------------------------------------
// 1. Dice Probability Helpers
// ---------------------------------------------------------

export function createInfinityDie(sv: number): Map<number, number> {
    const dist = new Map<number, number>();
    const p = 0.05;

    let appliedSV = sv;
    let bonusCritLowerBound = 21;

    if (sv > 20) {
        bonusCritLowerBound = 20 - (sv - 20);
        appliedSV = 20;
    }

    for (let roll = 1; roll <= 20; roll++) {
        let isCrit = false;

        if (sv > 20) {
            if (roll >= bonusCritLowerBound) isCrit = true;
        } else {
            if (roll === sv) isCrit = true;
        }

        let f2fValue = 0;
        if (isCrit) f2fValue = 200;
        else if (roll <= appliedSV) f2fValue = roll;
        else f2fValue = 0;

        dist.set(f2fValue, (dist.get(f2fValue) || 0) + p);
    }
    return dist;
}

// ---------------------------------------------------------
// 2. Face to Face Solver
// ---------------------------------------------------------

export function solveF2F(
    burstA: number,
    burstB: number,
    dieA: Map<number, number>,
    dieB: Map<number, number>
): Map<string, number> {
    const outcomeDist = new Map<string, number>();

    const getMaxDist = (die: Map<number, number>, burst: number): Map<number, number> => {
        if (burst === 0) return new Map([[0, 1.0]]);

        const singleCDF = (v: number) => {
            let sum = 0;
            for (const [k, p] of die.entries()) {
                if (k <= v) sum += p;
            }
            return sum;
        };

        const dist = new Map<number, number>();
        const allKeys = Array.from(die.keys()).sort((a, b) => a - b);
        if (!allKeys.includes(0)) allKeys.unshift(0);

        const sorted = allKeys.sort((a, b) => a - b);

        for (let i = 0; i < sorted.length; i++) {
            const v = sorted[i];
            const pLeq = singleCDF(v);
            const pLess = (i === 0) ? 0 : singleCDF(sorted[i - 1]);
            const probMaxIsV = Math.pow(pLeq, burst) - Math.pow(pLess, burst);
            if (probMaxIsV > 1e-9) {
                dist.set(v, probMaxIsV);
            }
        }
        return dist;
    };

    const maxA = getMaxDist(dieA, burstA);
    const maxB = getMaxDist(dieB, burstB);

    for (const [va, pa] of maxA.entries()) {
        for (const [vb, pb] of maxB.entries()) {
            const jointProb = pa * pb;
            if (jointProb < 1e-9) continue;

            const res = {
                aSuccess: 0,
                aCrit: false,
                bSuccess: 0,
                bCrit: false
            };

            if (va > vb) {
                const p_leq_va = getProbLeq(dieA, va);
                const p_leq_vb = getProbLeq(dieA, vb);
                const numer = p_leq_va - p_leq_vb;

                let p_hit_given_leq_va = 0;
                if (p_leq_va > 0) p_hit_given_leq_va = numer / p_leq_va;

                const isCrit = (va >= 200);
                res.aCrit = isCrit;

                const n = burstA - 1;
                for (let k = 0; k <= n; k++) {
                    const binom = nCk(n, k) * Math.pow(p_hit_given_leq_va, k) * Math.pow(1 - p_hit_given_leq_va, n - k);
                    const totalHits = 1 + k;
                    const subRes = { ...res, aSuccess: totalHits };
                    const key = JSON.stringify(subRes);
                    outcomeDist.set(key, (outcomeDist.get(key) || 0) + (jointProb * binom));
                }

            } else if (vb > va) {
                const p_leq_vb = getProbLeq(dieB, vb);
                const p_leq_va = getProbLeq(dieB, va);
                const p_hit = (p_leq_vb - p_leq_va) / p_leq_vb;

                const isCrit = (vb >= 200);
                res.bCrit = isCrit;

                const n = burstB - 1;
                for (let k = 0; k <= n; k++) {
                    const binom = nCk(n, k) * Math.pow(p_hit, k) * Math.pow(1 - p_hit, n - k);
                    const totalHits = 1 + k;
                    const subRes = { ...res, bSuccess: totalHits };
                    const key = JSON.stringify(subRes);
                    outcomeDist.set(key, (outcomeDist.get(key) || 0) + (jointProb * binom));
                }

            } else {
                const key = JSON.stringify(res);
                outcomeDist.set(key, (outcomeDist.get(key) || 0) + jointProb);
            }
        }
    }

    return outcomeDist;
}

function getProbLeq(die: Map<number, number>, v: number): number {
    let sum = 0;
    for (const [k, p] of die.entries()) {
        if (k <= v) sum += p;
    }
    return sum;
}

function nCk(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    let res = 1;
    for (let i = 1; i <= k; i++) {
        res = res * (n - i + 1) / i;
    }
    return res;
}

// ---------------------------------------------------------
// 3. Expected Wounds Calculation
// ---------------------------------------------------------

export function calculateExpectedWounds(
    f2fDist: Map<string, number>,
    aPS: number,
    aArm: number,
    aAmmo: string,
    bPS: number,
    bArm: number,
    bAmmo: string,
    aCont: boolean = false,
    aBts: number = 0,
    aCritImmune: boolean = false,
    bCont: boolean = false,
    bBts: number = 0,
    bCritImmune: boolean = false
): WoundResults {
    const wRes: WoundResults = {
        active: new Map(),
        reactive: new Map(),
        fail: new Map(),
        totalRolls: 1.0
    };

    wRes.active.set(0, 0);
    wRes.reactive.set(0, 0);
    wRes.fail.set(0, 0);

    for (const [outcome, prob] of f2fDist.entries()) {
        const ev = JSON.parse(outcome);

        let winner = 'none';
        let armorSave = 0;
        let btsSave = 0;
        let damage = 1;
        let cont = false;
        let critImmune = false;
        let plasma = false;
        let hits = 0;
        let ammoMult = 1;

        if (ev.aSuccess > ev.bSuccess) {
            winner = 'active';
            armorSave = aPS + bArm;
            btsSave = aPS + bBts;
            damage = (aAmmo === 'T2') ? 2 : 1;
            cont = aCont;
            critImmune = bCritImmune;
            plasma = (aAmmo === 'PLASMA');
            hits = ev.aSuccess;
            if (aAmmo === 'DA') ammoMult = 2;
            if (aAmmo === 'EXP') ammoMult = 3;

        } else if (ev.bSuccess > ev.aSuccess) {
            winner = 'reactive';
            armorSave = bPS + aArm;
            btsSave = bPS + aBts;
            damage = (bAmmo === 'T2') ? 2 : 1;
            cont = bCont;
            critImmune = aCritImmune;
            plasma = (bAmmo === 'PLASMA');
            hits = ev.bSuccess;
            if (bAmmo === 'DA') ammoMult = 2;
            if (bAmmo === 'EXP') ammoMult = 3;
        } else {
            wRes.fail.set(0, (wRes.fail.get(0) || 0) + prob);
            continue;
        }

        let normalSaves = hits * ammoMult;

        const hasCrit = (winner === 'active' ? ev.aCrit : ev.bCrit);

        if (hasCrit && !critImmune) {
            normalSaves += 1;
        }

        let dist = getTotalWoundsDist(normalSaves, armorSave, damage, cont);

        if (plasma) {
            const plasmaDist = getTotalWoundsDist(normalSaves, btsSave, 1, false);
            dist = convolve(dist, plasmaDist);
        }

        const targetMap = (winner === 'active') ? wRes.active : wRes.reactive;
        for (const [w, p] of dist.entries()) {
            targetMap.set(w, (targetMap.get(w) || 0) + (p * prob));
        }
    }

    return wRes;
}

function getTotalWoundsDist(
    saves: number,
    threshold: number,
    damage: number,
    isCont: boolean
): Map<number, number> {
    if (saves <= 0) return new Map([[0, 1.0]]);
    const single = getSingleSaveDist(threshold, damage, isCont);
    let result = single;
    for (let i = 1; i < saves; i++) {
        result = convolve(result, single);
    }
    return result;
}

function getSingleSaveDist(
    threshold: number,
    damage: number,
    isCont: boolean
): Map<number, number> {
    const dist = new Map<number, number>();

    let pSave = threshold / 20.0;
    if (pSave < 0) pSave = 0;
    if (pSave > 1) pSave = 1;

    const pFail = 1.0 - pSave;

    if (!isCont) {
        dist.set(0, pSave);
        if (pFail > 0) dist.set(damage, pFail);
    } else {
        let remaining = 1.0;
        let wounds = 0;
        for (let i = 0; i < 10; i++) {
            const stop = remaining * pSave;
            if (stop > 0) dist.set(wounds, (dist.get(wounds) || 0) + stop);
            remaining *= pFail;
            wounds += damage;
            if (remaining < 1e-6) break;
        }
    }
    return dist;
}

function convolve(d1: Map<number, number>, d2: Map<number, number>): Map<number, number> {
    const res = new Map<number, number>();
    for (const [v1, p1] of d1.entries()) {
        for (const [v2, p2] of d2.entries()) {
            const v = v1 + v2;
            const p = p1 * p2;
            res.set(v, (res.get(v) || 0) + p);
        }
    }
    return res;
}

// ---------------------------------------------------------
// 4. High-Level API for MCP
// ---------------------------------------------------------

export interface CombatantInput {
    sv: number;         // Ballistic Skill or CC
    burst: number;
    damage: number;
    ammo: string;       // "NORMAL", "DA", "EXP", "T2", "PLASMA"
    arm: number;
    bts: number;
    cont?: boolean;
    critImmune?: boolean;
}

/**
 * Calculate face-to-face roll probabilities and expected wounds.
 * High-level function for MCP tool use.
 */
export function calculateF2F(active: CombatantInput, reactive: CombatantInput): F2FResult {
    const dieA = createInfinityDie(active.sv);
    const dieB = createInfinityDie(reactive.sv);

    const f2fDist = solveF2F(active.burst, reactive.burst, dieA, dieB);

    const wounds = calculateExpectedWounds(
        f2fDist,
        active.damage,
        reactive.arm,
        active.ammo,
        reactive.damage,
        active.arm,
        reactive.ammo,
        active.cont || false,
        reactive.bts,
        reactive.critImmune || false,
        reactive.cont || false,
        active.bts,
        active.critImmune || false
    );

    // Calculate summary statistics
    let activeWins = 0;
    let reactiveWins = 0;
    let draw = 0;

    for (const [key, prob] of f2fDist.entries()) {
        const outcome = JSON.parse(key);
        if (outcome.aSuccess > outcome.bSuccess) {
            activeWins += prob;
        } else if (outcome.bSuccess > outcome.aSuccess) {
            reactiveWins += prob;
        } else {
            draw += prob;
        }
    }

    // Calculate expected wounds
    let expectedActiveWounds = 0;
    for (const [w, p] of wounds.active.entries()) {
        expectedActiveWounds += w * p;
    }

    let expectedReactiveWounds = 0;
    for (const [w, p] of wounds.reactive.entries()) {
        expectedReactiveWounds += w * p;
    }

    // Convert Maps to plain objects for JSON serialization
    const woundDistActive: Record<number, number> = {};
    for (const [w, p] of wounds.active.entries()) {
        if (p > 0.001) woundDistActive[w] = Math.round(p * 10000) / 100;
    }

    const woundDistReactive: Record<number, number> = {};
    for (const [w, p] of wounds.reactive.entries()) {
        if (p > 0.001) woundDistReactive[w] = Math.round(p * 10000) / 100;
    }

    return {
        activeWins: Math.round(activeWins * 10000) / 100,
        reactiveWins: Math.round(reactiveWins * 10000) / 100,
        draw: Math.round(draw * 10000) / 100,
        expectedActiveWounds: Math.round(expectedActiveWounds * 100) / 100,
        expectedReactiveWounds: Math.round(expectedReactiveWounds * 100) / 100,
        woundDistActive,
        woundDistReactive
    };
}
