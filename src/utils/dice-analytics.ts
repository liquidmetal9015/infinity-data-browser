import { createInfinityDie, solveF2F, calculateExpectedWounds } from '../../shared/dice-engine';
import type { InfinityF2FOutcome } from '../../shared/dice-engine';

/**
 * Data structures for Recharts consumption
 */

// Plot 1: Max-of-N Distributions
export interface MaxOfNDataPoint {
    rollValue: string; // "Fail", "1", "2" ... "20", "Crit"
    burst1: number;
    burst2: number;
    burst3: number;
    burst4: number;
}

// Plot 2: F2F Win Heatmap
export interface F2FHeatmapDataPoint {
    activeSV: number;
    reactiveSV: number;
    activeWinProb: number;
}

// Plot 3: Burst Scaling Curve
export interface BurstScalingDataPoint {
    burst: number;
    favorable: number; // SV 15 vs SV 10
    even: number;      // SV 12 vs SV 12
    unfavorable: number; // SV 10 vs SV 15
}

// Plot 4: Wound Pipeline
export interface WoundPipelineDataPoint {
    category: string;
    wounds: number; // 0, 1, 2, 3+
    activeProbability: number;
    reactiveProbability: number;
}


/**
 * Generates the Max-of-N probability distribution for Burst 1 to 4 given a fixed SV.
 */
export function generateMaxOfNData(sv: number): MaxOfNDataPoint[] {
    const die = createInfinityDie(sv);

    // Internal helper from engine logic
    const singleCDF = (v: number) => {
        let sum = 0;
        for (const [k, p] of die.entries()) {
            if (k <= v) sum += p;
        }
        return sum;
    };

    const getMaxDist = (burst: number): Map<number, number> => {
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

    const b1Dist = getMaxDist(1);
    const b2Dist = getMaxDist(2);
    const b3Dist = getMaxDist(3);
    const b4Dist = getMaxDist(4);

    const labels = ["Fail"];
    for (let i = 1; i <= 20; i++) labels.push(i.toString());
    labels.push("Crit");

    const getProb = (dist: Map<number, number>, label: string) => {
        if (label === "Fail") return dist.get(0) || 0;
        if (label === "Crit") return dist.get(200) || 0;
        return dist.get(parseInt(label)) || 0;
    };

    return labels.map(label => ({
        rollValue: label,
        burst1: getProb(b1Dist, label) * 100, // as percentage for charts
        burst2: getProb(b2Dist, label) * 100,
        burst3: getProb(b3Dist, label) * 100,
        burst4: getProb(b4Dist, label) * 100
    }));
}

/**
 * Generates the win probability heatmap data for Active SV vs Reactive SV at a fixed burst.
 */
export function generateHeatmapData(activeBurst: number, reactiveBurst: number): F2FHeatmapDataPoint[] {
    const data: F2FHeatmapDataPoint[] = [];

    // Pre-calculate dice to save time
    const diceBySV = new Map<number, Map<number, number>>();
    for (let i = 1; i <= 20; i++) {
        diceBySV.set(i, createInfinityDie(i));
    }

    for (let activeSV = 1; activeSV <= 20; activeSV++) {
        for (let reactiveSV = 1; reactiveSV <= 20; reactiveSV++) {
            const f2fDist = solveF2F(activeBurst, reactiveBurst, diceBySV.get(activeSV)!, diceBySV.get(reactiveSV)!);

            let activeWinProb = 0;
            for (const [outcomeStr, prob] of f2fDist.entries()) {
                const outcome: InfinityF2FOutcome = JSON.parse(outcomeStr);

                // Active wins if active has a crit and reactive does not, OR active > 0 successes and reactive has 0
                // We're just calculating raw F2F win probability (active scoring at least 1 hit)
                if (outcome.aCrit && !outcome.bCrit) {
                    activeWinProb += prob;
                } else if (outcome.aSuccess > 0 && !outcome.bCrit && outcome.bSuccess === 0) {
                    activeWinProb += prob;
                }
            }

            data.push({
                activeSV,
                reactiveSV,
                activeWinProb: activeWinProb * 100
            });
        }
    }
    return data;
}

/**
 * Generates Burst Scaling Curve Data
 */
export function generateBurstScalingData(reactiveBurst: number): BurstScalingDataPoint[] {
    const data: BurstScalingDataPoint[] = [];

    const favorableActiveDie = createInfinityDie(15);
    const favorableReactiveDie = createInfinityDie(10);

    const evenActiveDie = createInfinityDie(12);
    const evenReactiveDie = createInfinityDie(12);

    const unfavorableActiveDie = createInfinityDie(10);
    const unfavorableReactiveDie = createInfinityDie(15);

    const computeWinProb = (aDie: Map<number, number>, bDie: Map<number, number>, bA: number, bB: number) => {
        const dist = solveF2F(bA, bB, aDie, bDie);
        let winProb = 0;
        for (const [outcomeStr, prob] of dist.entries()) {
            const outcome: InfinityF2FOutcome = JSON.parse(outcomeStr);
            if (outcome.aCrit && !outcome.bCrit) {
                winProb += prob;
            } else if (outcome.aSuccess > 0 && !outcome.bCrit && outcome.bSuccess === 0) {
                winProb += prob;
            }
        }
        return winProb * 100;
    };

    for (let burst = 1; burst <= 6; burst++) {
        data.push({
            burst,
            favorable: computeWinProb(favorableActiveDie, favorableReactiveDie, burst, reactiveBurst),
            even: computeWinProb(evenActiveDie, evenReactiveDie, burst, reactiveBurst),
            unfavorable: computeWinProb(unfavorableActiveDie, unfavorableReactiveDie, burst, reactiveBurst)
        });
    }

    return data;
}

/**
 * Generates data for the Wound Pipeline Waterfall chart.
 */
export function generateWoundPipelineData(
    activeBurst: number, activeSV: number, activeDam: number, activeAmmo: string, activeContinuous: boolean, activeCritImmune: boolean,
    reactiveBurst: number, reactiveSV: number, reactiveDam: number, reactiveAmmo: string, reactiveContinuous: boolean, reactiveCritImmune: boolean,
    activeArmor: number, reactiveArmor: number, activeBTS: number, reactiveBTS: number
): WoundPipelineDataPoint[] {

    const dieA = createInfinityDie(activeSV);
    const dieB = createInfinityDie(reactiveSV);
    const f2fDist = solveF2F(activeBurst, reactiveBurst, dieA, dieB);

    const wRes = calculateExpectedWounds(
        f2fDist,
        activeDam, reactiveArmor, activeAmmo,
        reactiveDam, activeArmor, reactiveAmmo,
        activeContinuous, reactiveBTS, reactiveCritImmune,
        reactiveContinuous, activeBTS, activeCritImmune
    );

    const result: WoundPipelineDataPoint[] = [];

    // Aggregate Wounds (max 3+ logic)
    const mapWounds = (map: Map<number, number>) => {
        const agg = { 0: 0, 1: 0, 2: 0, '3+': 0 };
        for (const [w, p] of map.entries()) {
            if (w === 0) agg[0] += p;
            else if (w === 1) agg[1] += p;
            else if (w === 2) agg[2] += p;
            else agg['3+'] += p;
        }
        return agg;
    };

    const activeWounds = mapWounds(wRes.active);
    const reactiveWounds = mapWounds(wRes.reactive);

    let failTotal = 0;
    for (const p of wRes.fail.values()) failTotal += p;

    // F2F Draw / Fail
    result.push({
        category: 'No Hits (Draw/Miss)',
        wounds: 0,
        activeProbability: failTotal * 100,
        reactiveProbability: failTotal * 100
    });

    result.push({ category: '0 Wounds', wounds: 0, activeProbability: activeWounds[0] * 100, reactiveProbability: reactiveWounds[0] * 100 });
    result.push({ category: '1 Wound', wounds: 1, activeProbability: activeWounds[1] * 100, reactiveProbability: reactiveWounds[1] * 100 });
    result.push({ category: '2+ Wounds', wounds: 2, activeProbability: (activeWounds[2] + activeWounds['3+']) * 100, reactiveProbability: (reactiveWounds[2] + reactiveWounds['3+']) * 100 });

    return result;
}
