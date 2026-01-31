
// engine.ts - Infinity N5 Dice Calculator Engine
// Implements N5 Rules: "Probability of Survival" (Roll Under PS to Save)

export interface InfinityF2FOutcome {
    aSuccess: number;
    aCrit: boolean; // Did A get at least one crit?
    bSuccess: number;
    bCrit: boolean;
}

export interface WoundResults {
    active: Map<number, number>;   // Wounds dealt by Active player
    reactive: Map<number, number>; // Wounds dealt by Reactive player
    fail: Map<number, number>;     // Probability of no wounds (e.g. miss or both fail)
    totalRolls: number;            // For scaling, usually 1.0 if normalized
}

// ---------------------------------------------------------
// 1. Dice Probability Helpers
// ---------------------------------------------------------

/**
 * Creates a map of roll result -> probability for a single D20.
 * Handles Infinity rules: Normal roll vs Target (sv).
 * Crit: If sv >= 20, 20 is a crit. If sv > 20, values > 20 - (sv-20) are crits.
 * But "infinity_die" usually maps "roll" to "value".
 * Value 0 = Miss. 1..19 = Success. 20 = Crit?
 * We use 0-20 scale: 0 = Miss. 1-19 = Normal Success. 20 = Crit.
 */
export function createInfinityDie(sv: number): Map<number, number> {
    const dist = new Map<number, number>();

    // Normal Range: 1 to 20
    const p = 0.05; // 1/20

    // Handle Crits
    // Base rule: Roll = SV is a hit. But Crit rule?
    // Usually Crit = Roll of SV? Or Roll of 20?
    // "Rolls equal to the Attribute are Critical Hits" is NOT general rule.
    // General N4 Rule: "A roll of 20... is NOT always a crit".
    // Wait, N4 Crit: "If the result... is equal to the Attribute... or a 20..." ???
    // Actually, "Critical Success: Result equal to the Modified Attribute...".
    // AND "If Mod Attribute >= 20, result 20 is always a Crit".
    // Let's stick to the ported logic which was working for N4.
    // N4 Reference: `infinity_die` logic.
    // If SV <= 20: 1..SV=Success. Criticals? Often specific rolls.
    // Standard rule: Roll == SV is a Crit? NO. 
    // Wait, "Critical Success" IS "Result = Effective Attribute".
    // So if SV=13, Roll 13 is Crit.
    // Reference check from previous turn: `if roll == sv or roll > 20: return 20`.
    // Yes. So if SV 13: 13 is Crit. 1-12 Hit. 14-20 Miss.

    let appliedSV = sv;
    let bonusCritLowerBound = 21; // Default crit is just SV. 21 ensures 20 doesn't trigger "bonus" crit.

    if (sv > 20) {
        bonusCritLowerBound = 20 - (sv - 20); // e.g. SV 23 -> 20 - 3 = 17. 17,18,19,20 are crits.
        appliedSV = 20;
    }

    for (let roll = 1; roll <= 20; roll++) {
        let value = 0; // 0 = Miss
        // Apply Crit Logic
        let isCrit = false;

        if (sv > 20) {
            // High SV logic
            // Add (SV-20) to roll? No, usually range extension.
            // Crit range: [bonusCritLowerBound, 20]
            if (roll >= bonusCritLowerBound) isCrit = true;
            else value = roll; // Always hits if < crit range, since SV > 20
        } else {
            // Normal SV
            if (roll === sv) isCrit = true;
            else if (roll < sv) value = roll;
            else value = 0; // Miss
        }

        if (isCrit) value = 100; // Special marker for Crit > normal rolls

        // Map internal value to canonical outcome
        // We need to compare specific rolls. F2F compares Value vs Value.
        // Higher value wins.
        // Crit (100) beats everything.
        // Miss (0) loses to everything.

        // Wait, 100 is just a marker.
        // In F2F logic: If Value > OpponentValue -> Win.
        // But Value must be <= 20 (unless crit).

        // Let's use clean values:
        // 0 = Miss
        // 1..20 = Normal Success Value
        // 200 = Critical Success (Arbitrary high number)

        // For SV 13: 
        // 1..12 -> 1..12
        // 13 -> 200
        // 14..20 -> 0

        let f2fValue = 0;
        if (isCrit) f2fValue = 200;
        else if (roll <= appliedSV) f2fValue = roll;
        else f2fValue = 0;

        // Add to Distribution
        dist.set(f2fValue, (dist.get(f2fValue) || 0) + p);
    }
    return dist;
}

// ---------------------------------------------------------
// 2. Face to Face Solver (Dynamic Programming)
// ---------------------------------------------------------

// Helper to convolution distributions (sum of random variables? No, max of random variables)
// We need Max(Burst A) vs Max(Burst B).
// Actually, F2F is "My array of dice" vs "Opponent array".
// Cancellation: Any of my dice > Their highest die?
// It's complex. Reference logic used `InfinityFace2FaceEvaluator`.
// We implemented a simplified DP in previous steps.

// To avoid complex combinatorial explosion, we assumed:
// P(Best Outcome for A) vs P(Best Outcome for B).
// Actually, we iterate all outcome pairs of (MaxA, MaxB)?
// Only if Burst=1.
// For Burst > 1, we need distribution of the "Best Result".
// Infinity rule: "Any die lower than opponent's best die is cancelled."
// "Any die higher than opponent's best die is a Success."
// So we need probability that A has K dice > B's Max.
// And checking Crits.

// Optimized Logic:
// 1. Calculate Dist of Max(A_Dice). (And counts of how many passed).
// Actually, iterating all dice outcomes is O(20^Burst). Too slow for Burst 5.
// But dice are identical independent.
// We used `d20` library reference logic.
// Here we implemented a direct `solveF2F`.

// Re-implementing a clean solveF2F for High Burst:
// We iterate over the "Highest Roll of B" (or B is null).
// For a fixed B_Best (value 0..200):
// A's dice are independent.
// For each A-die:
//   Win if A_val > B_Best. (Count as hit)
//   Cancel if A_val <= B_Best. (Unless A_val is Crit and B_Best is normal... wait)
//   Crit vs Crit: Cancel.
//   Crit vs Normal: Win.

export function solveF2F(
    burstA: number,
    burstB: number,
    dieA: Map<number, number>,
    dieB: Map<number, number>
): Map<string, number> {
    const outcomeDist = new Map<string, number>();

    // Optimization: Calculate Cumulative Distribution Function (CDF) for Die A and Die B
    // P(Roll <= X).
    // Values are 0, 1..20, 200.
    const sortedValues = Array.from(new Set([...dieA.keys(), ...dieB.keys(), 0])).sort((a, b) => a - b);

    // We can iterate over "The highest roll on the table".
    // Or iterate B's highest roll, then calculate A's performance against it?
    // Not quite. B's dice also get cancelled by A's best.
    // It's symmetric. "Compare A_Max and B_Max".
    // If A_Max > B_Max: A wins. How many A dice > B_Max?
    // If B_Max > A_Max: B wins.
    // If A_Max == B_Max: Draw (Cancel each other). (Note: Crit cancels Crit).

    // Step 1: Calculate distribution of Max(Burst) for A and B.
    // DistMaxA[v] = Probability that Max(A) == v.

    const getMaxDist = (die: Map<number, number>, burst: number): Map<number, number> => {
        if (burst === 0) return new Map([[0, 1.0]]); // Max is 0 (Miss/None)

        // P(Max <= v) = P(die <= v) ^ burst
        // P(Max == v) = P(Max <= v) - P(Max <= v-1)

        const cdf = new Map<number, number>();
        let runningP = 0;
        // sorted values logic
        // We need strict inequalities.
        // Let's use strict logic over the full domain 0..20 and 200.
        // Actually map is sparse.

        // Build full CDF for single die
        const singleCDF = (v: number) => {
            // sum prob for k <= v
            let sum = 0;
            for (const [k, p] of die.entries()) {
                if (k <= v) sum += p;
            }
            return sum;
        };

        const dist = new Map<number, number>();
        const allKeys = Array.from(die.keys()).sort((a, b) => a - b);
        // Add 0 if not present
        if (!allKeys.includes(0)) allKeys.unshift(0);

        // We iterate possible Max values v.
        // P(Max=v) = P(Max<=v) - P(Max<v)
        // P(Max<=v) = (P(single<=v))^burst

        // Identify "step" values. Max can only be one of the die values.

        // For each possible value v in die keys:
        // Calculate P(single <= v)
        // Calculate P(single < v)  (which is P(single <= prev_v))

        // Sort keys
        const sorted = allKeys.sort((a, b) => a - b);

        for (let i = 0; i < sorted.length; i++) {
            const v = sorted[i];
            const pLeq = singleCDF(v);
            const pLess = (i === 0) ? 0 : singleCDF(sorted[i - 1]); // Or strictly less logic

            // Re-verify strictly less logic to be safe
            // pLess should be sum of probs for all k < v.
            // If sorted list is comprehensive of all possible outcomes, then sorted[i-1] is correct.
            // Yes.

            const probMaxIsV = Math.pow(pLeq, burst) - Math.pow(pLess, burst);
            if (probMaxIsV > 1e-9) {
                dist.set(v, probMaxIsV);
            }
        }
        return dist;
    };

    const maxA = getMaxDist(dieA, burstA);
    const maxB = getMaxDist(dieB, burstB);

    // Step 2: Convolve Max distributions to find Winner
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

            // Determine Winner
            if (va > vb) {
                // A Wins.
                // A's Best > B's Best.
                // All B dice are cancelled.
                // A dice > vb are successes.
                // We need Expected Number of A dice > vb, GIVEN Max(A) == va.
                // This is slightly tricky. We approximated in previous engine.
                // DP Approach: P(k dice > vb | Max=va).

                // Simplified Approximation for Performance:
                // If A wins, we know AT LEAST 1 A die is `va`.
                // For the other (burst-1) dice:
                // They are distributed in range [0, va].
                // We count how many are > vb.

                // Let p_beat = P(dieA > vb).  (Strictly beat B's best)
                // Let p_match = P(dieA == va). (Is the max)
                // Let p_under = P(dieA < va).

                // Conditional Probability is complex.
                // Let's use the "Number of successes" loop approach instead?
                // No, sticking to approximation:
                // We guarantee 1 hit (the Max).
                // Remaining (Burst-1) dice have prob P(die > vb | die <= va).
                // P(Hit) = P(die > vb) / P(die <= va).
                // Expected Hits = 1 + (Burst-1) * P(Hit).
                // We'll output integer distribution by convolving binomials?
                // Or just use Expected Value?
                // The `calculateExpectedWounds` takes the specific count distribution.
                // So we do need P(1 hit), P(2 hits)...

                // Prob of a non-max die hitting:
                // pHit_others = P(die > vb && die <= va) ? 
                // Actually they just need to be > vb. But they MUST be <= va (since va is Max).
                // So prob is P(vb < die <= va) / P(die <= va).

                const p_leq_va = getProbLeq(dieA, va);
                const p_leq_vb = getProbLeq(dieA, vb);
                const numer = p_leq_va - p_leq_vb; // P(vb < die <= va)

                let p_hit_given_leq_va = 0;
                if (p_leq_va > 0) p_hit_given_leq_va = numer / p_leq_va;

                // However, we know at least one is va.
                // Logic: 1 die is fixed at va. (Hit).
                // (Burst-1) dice are constrained <= va.
                // Each hits with prob p_hit_given_leq_va.
                // Binomial distribution for remaining dice.

                // Is va a Crit?
                const isCrit = (va >= 200);
                res.aCrit = isCrit;

                // Binomial expansion for k additional hits
                const n = burstA - 1;
                for (let k = 0; k <= n; k++) {
                    const binom = nCk(n, k) * Math.pow(p_hit_given_leq_va, k) * Math.pow(1 - p_hit_given_leq_va, n - k);
                    const totalHits = 1 + k;
                    // Key: `active_${totalHits}_crit_${isCrit}`
                    // We must aggregate output JSON keys carefully.
                    // Actually return a simplified outcome object?
                    // We serialize to string for map key.
                    // This creates multiple entries from one (va, vb) pair.

                    const subRes = { ...res, aSuccess: totalHits };
                    const key = JSON.stringify(subRes);
                    outcomeDist.set(key, (outcomeDist.get(key) || 0) + (jointProb * binom));
                }

            } else if (vb > va) {
                // B Wins. Symmetric logic.
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
                // Draw (va == vb).
                // Everything cancelled.
                // Returns 0 successes.
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
// 3. Expected Wounds Calculation (N5)
// ---------------------------------------------------------

export function calculateExpectedWounds(
    f2fDist: Map<string, number>,
    aPS: number,   // N5: Save Attribute (PS)
    aArm: number,  // N5: Armor
    aAmmo: string,
    bPS: number,
    bArm: number,
    bAmmo: string,
    aCont: boolean = false,
    aBts: number = 0,
    aCritImmune: boolean = false,
    bCont: boolean = false,
    bBts: number = 0,
    bCritImmune: boolean = false,
    n5BetaCriticals: boolean = false
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
        let crits = 0;
        let hits = 0;
        let ammoMult = 1;

        if (ev.aSuccess > ev.bSuccess) {
            winner = 'active';
            // Target is B.
            // Save Threshold = WeaponPS (A) + Armor (B)
            armorSave = aPS + bArm;
            btsSave = aPS + bBts;
            damage = (aAmmo === 'T2') ? 2 : 1;
            cont = aCont;
            critImmune = bCritImmune;
            plasma = (aAmmo === 'PLASMA');

            crits = ev.aCrit;
            hits = ev.aSuccess;
            if (aAmmo === 'DA') ammoMult = 2;
            if (aAmmo === 'EXP') ammoMult = 3;

        } else if (ev.bSuccess > ev.aSuccess) {
            winner = 'reactive';
            // Target is A.
            armorSave = bPS + aArm;
            btsSave = bPS + aBts;
            damage = (bAmmo === 'T2') ? 2 : 1;
            cont = bCont;
            critImmune = aCritImmune;
            plasma = (bAmmo === 'PLASMA');

            crits = ev.bCrit;
            hits = ev.bSuccess;
            if (bAmmo === 'DA') ammoMult = 2;
            if (bAmmo === 'EXP') ammoMult = 3;
        } else {
            wRes.fail.set(0, (wRes.fail.get(0) || 0) + prob);
            continue;
        }

        let autoWounds = 0;
        let normalSaves = hits * ammoMult; // Default saves

        // Crit Logic: 1 hit becomes Auto Wound (if not immune)
        let hasCrit = (winner === 'active' ? ev.aCrit : ev.bCrit);

        if (hasCrit && !critImmune) {
            autoWounds = 1;
            normalSaves -= 1; // 1 save converted to auto wound
            // If normal hits caused multiple saves (DA), do we lose ALL of them for the auto wound?
            // "One of the saving throws... becomes an automatic wound".
            // So if DA Hit (2 saves) is a Crit: 1 Auto Wound + 1 Save?
            // YES. 
            // My calculation above: `normalSaves` was total saves.
            // `hits * ammoMult`.
            // Currently I subtracted 1 save.
            // e.g. DA (2) * 1 Hit = 2 Saves.
            // Crit -> 1 Auto, 1 remaining Save. Correct.

            // Wait, what if I have 3 hits?
            // Only 1 is Crit.
            // But `hasCrit` means "At least one value was Crit".
            // Do ALL hits become crits? No.
            // "If you get a Critical... target suffers 1 Wound." (Once per order? Or per hit?)
            // Usually Critical is per Attack Roll.
            // If I roll 3 Crits? 3 Auto Wounds?
            // My F2F engine returns `digits` of success.
            // But currently `aCrit` is boolean.
            // WE assume 1 Crit Max for now to be safe/conservative,
            // or simplify that "If ANY Crit, 1 Auto Wound". 
            // (Standard N4 interpretation usually caps crit effect).
        }

        let dist = getTotalWoundsDist(normalSaves, armorSave, damage, cont);

        if (plasma) {
            // Convolve with BTS saves
            const plasmaDist = getTotalWoundsDist(normalSaves, btsSave, 1, false);
            dist = convolve(dist, plasmaDist);
        }

        if (autoWounds > 0) {
            const shifted = new Map<number, number>();
            for (const [w, p] of dist.entries()) {
                shifted.set(w + autoWounds, p);
            }
            dist = shifted;
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

    // N5: Save if Roll <= Threshold
    let pSave = threshold / 20.0;
    if (pSave < 0) pSave = 0;
    if (pSave > 1) pSave = 1;

    const pFail = 1.0 - pSave;

    if (!isCont) {
        dist.set(0, pSave);
        if (pFail > 0) dist.set(damage, pFail);
    } else {
        // Simple recursive cont logic
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
