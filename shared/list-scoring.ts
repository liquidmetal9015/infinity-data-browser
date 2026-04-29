// list-scoring.ts - Army list scoring and analysis
// Evaluates lists on multiple dimensions for MCP tools

import type { Unit, Profile, Option } from './types';
import type { UnitRoleAnalysis, RoleScore } from './unit-roles';
import { classifyUnit } from './unit-roles';
import type { ClassifiedObjective } from './classifieds';
import { getClassifiedsForOption } from './classifieds';

export interface ScoredListUnit {
    unit: Unit;
    profile: Profile;
    option: Option;
    isc: string;
    roleAnalysis: UnitRoleAnalysis;
}

export interface ListScore {
    // Order Economy
    totalOrders: number;
    regularOrders: number;
    irregularOrders: number;
    orderEfficiency: number; // orders per 50pts

    // Offensive Capability
    totalBurst: number;
    avgBS: number;
    gunfighterCount: number;
    meleeCount: number;

    // Defense
    avgArm: number;
    totalWounds: number;
    hackableCount: number;

    // Specialists
    totalSpecialists: number;
    doctorCount: number;
    engineerCount: number;
    hackerCount: number;
    forwardObserverCount: number;

    // Mobility
    fastUnitCount: number; // MOV 6-4 or better
    infiltratorCount: number;
    airborneCount: number;

    // Classifieds
    classifiedCoverage: number; // Percentage of classifieds completable
    completableClassifieds: string[];

    // Overall
    totalPoints: number;
    totalSwc: number;
    modelCount: number;
    overallScore: number;

    // Detailed breakdown
    breakdown: {
        offense: number;
        defense: number;
        orders: number;
        specialists: number;
        mobility: number;
        classifieds: number;
    };
}

export interface ListAnalysis {
    faction: string;
    name: string;
    points: {
        used: number;
        limit: number;
    };
    swc: {
        used: number;
        limit: number;
    };
    combatGroups: {
        units: ScoredListUnit[];
        orders: { regular: number; irregular: number };
    }[];
    score: ListScore;
    topGunfighters: UnitRoleAnalysis[];
    topMelee: UnitRoleAnalysis[];
    specialists: UnitRoleAnalysis[];
    weaknesses: string[];
    strengths: string[];
}

export interface ScoringMetadata {
    skills: Map<number, string>;
    weapons: Map<number, { name: string; burst?: string; damage?: string; distance?: { med?: { max: number } } }>;
    equips: Map<number, string>;
}

/**
 * Score a list of units on multiple dimensions.
 */
export function scoreList(
    units: Array<{ unit: Unit; profile: Profile; option: Option }>,
    classifieds: ClassifiedObjective[],
    metadata: ScoringMetadata,
    _pointsLimit: number = 300
): ListScore {
    const listUnits: ScoredListUnit[] = units.map(({ unit, profile, option }) => ({
        unit,
        profile,
        option,
        isc: unit.isc,
        roleAnalysis: classifyUnit(unit, profile, option, metadata)
    }));

    // Calculate basic stats
    const totalPoints = listUnits.reduce((sum, u) => sum + u.option.points, 0);
    const totalSwc = listUnits.reduce((sum, u) => sum + (u.option.swc || 0), 0);
    const modelCount = listUnits.length;

    // Order economy (simplified - assumes 1 order per unit)
    const regularOrders = listUnits.length; // Simplified
    const irregularOrders = 0; // Would need to check skills
    const totalOrders = regularOrders + irregularOrders;
    const orderEfficiency = (totalOrders / totalPoints) * 50;

    // Offense
    let totalBurst = 0;
    let bsSum = 0;
    let gunfighterCount = 0;
    let meleeCount = 0;

    for (const u of listUnits) {
        bsSum += u.profile.bs;
        if (u.roleAnalysis.primaryRole === 'gunfighter') gunfighterCount++;
        if (u.roleAnalysis.primaryRole === 'melee') meleeCount++;

        // Rough burst estimate
        const hasHeavyWeapon = u.roleAnalysis.roles.find((r: RoleScore) => r.role === 'heavy')?.score || 0;
        totalBurst += hasHeavyWeapon > 20 ? 4 : 3;
    }

    const avgBS = bsSum / listUnits.length;

    // Defense
    let armSum = 0;
    let totalWounds = 0;
    let hackableCount = 0;

    for (const u of listUnits) {
        armSum += u.profile.arm;
        totalWounds += u.profile.w;
        const hackScore = u.roleAnalysis.roles.find((r: RoleScore) => r.role === 'hack_target')?.score || 0;
        if (hackScore > 0) hackableCount++;
    }

    const avgArm = armSum / listUnits.length;

    // Specialists
    let doctorCount = 0;
    let engineerCount = 0;
    let hackerCount = 0;
    let forwardObserverCount = 0;

    for (const u of listUnits) {
        const specRole = u.roleAnalysis.roles.find((r: RoleScore) => r.role === 'specialist');
        if (specRole) {
            for (const reason of specRole.reasons) {
                if (reason.includes('doctor')) doctorCount++;
                if (reason.includes('engineer')) engineerCount++;
                if (reason.includes('hacker')) hackerCount++;
                if (reason.includes('forward observer')) forwardObserverCount++;
            }
        }
    }

    const totalSpecialists = doctorCount + engineerCount + hackerCount + forwardObserverCount;

    // Mobility
    let fastUnitCount = 0;
    let infiltratorCount = 0;
    const airborneCount = 0;

    for (const u of listUnits) {
        const mov = u.profile.move;
        if (mov && mov.length >= 2 && mov[0] >= 6) fastUnitCount++;

        const skirmScore = u.roleAnalysis.roles.find((r: RoleScore) => r.role === 'skirmisher')?.score || 0;
        if (skirmScore >= 25) infiltratorCount++;
    }

    // Classifieds coverage
    const allClassifiedMatches = new Set<number>();
    const completableClassifieds: string[] = [];

    for (const u of listUnits) {
        const matches = getClassifiedsForOption(
            u.unit,
            u.profile,
            u.option,
            classifieds,
            metadata
        );
        for (const m of matches) {
            if (m.canComplete) {
                allClassifiedMatches.add(m.objectiveId);
            }
        }
    }

    for (const cls of classifieds) {
        if (allClassifiedMatches.has(cls.id)) {
            completableClassifieds.push(cls.name);
        }
    }

    const classifiedCoverage = (completableClassifieds.length / classifieds.length) * 100;

    // Calculate breakdown scores (0-100 each)
    const offenseScore = Math.min(100, (avgBS - 10) * 15 + gunfighterCount * 10);
    const defenseScore = Math.min(100, avgArm * 10 + totalWounds * 5);
    const ordersScore = Math.min(100, orderEfficiency * 30);
    const specialistsScore = Math.min(100, totalSpecialists * 20);
    const mobilityScore = Math.min(100, fastUnitCount * 10 + infiltratorCount * 15);
    const classifiedsScore = classifiedCoverage;

    const overallScore = Math.round(
        (offenseScore + defenseScore + ordersScore + specialistsScore + mobilityScore + classifiedsScore) / 6
    );

    return {
        totalOrders,
        regularOrders,
        irregularOrders,
        orderEfficiency: Math.round(orderEfficiency * 100) / 100,
        totalBurst,
        avgBS: Math.round(avgBS * 10) / 10,
        gunfighterCount,
        meleeCount,
        avgArm: Math.round(avgArm * 10) / 10,
        totalWounds,
        hackableCount,
        totalSpecialists,
        doctorCount,
        engineerCount,
        hackerCount,
        forwardObserverCount,
        fastUnitCount,
        infiltratorCount,
        airborneCount,
        classifiedCoverage: Math.round(classifiedCoverage),
        completableClassifieds,
        totalPoints,
        totalSwc,
        modelCount,
        overallScore,
        breakdown: {
            offense: Math.round(offenseScore),
            defense: Math.round(defenseScore),
            orders: Math.round(ordersScore),
            specialists: Math.round(specialistsScore),
            mobility: Math.round(mobilityScore),
            classifieds: Math.round(classifiedsScore)
        }
    };
}

/**
 * Compare two lists and identify relative strengths/weaknesses.
 */
export function compareLists(
    list1: {
        name: string;
        units: Array<{ unit: Unit; profile: Profile; option: Option }>;
    },
    list2: {
        name: string;
        units: Array<{ unit: Unit; profile: Profile; option: Option }>;
    },
    classifieds: ClassifiedObjective[],
    metadata: ScoringMetadata,
    pointsLimit: number = 300
): {
    list1: { name: string; score: ListScore };
    list2: { name: string; score: ListScore };
    comparison: {
        dimension: string;
        list1Value: number;
        list2Value: number;
        winner: string;
        delta: number;
    }[];
    summary: string;
} {
    const score1 = scoreList(list1.units, classifieds, metadata, pointsLimit);
    const score2 = scoreList(list2.units, classifieds, metadata, pointsLimit);

    const comparisons = [
        { dimension: 'Overall', list1Value: score1.overallScore, list2Value: score2.overallScore },
        { dimension: 'Offense', list1Value: score1.breakdown.offense, list2Value: score2.breakdown.offense },
        { dimension: 'Defense', list1Value: score1.breakdown.defense, list2Value: score2.breakdown.defense },
        { dimension: 'Orders', list1Value: score1.breakdown.orders, list2Value: score2.breakdown.orders },
        { dimension: 'Specialists', list1Value: score1.breakdown.specialists, list2Value: score2.breakdown.specialists },
        { dimension: 'Mobility', list1Value: score1.breakdown.mobility, list2Value: score2.breakdown.mobility },
        { dimension: 'Classifieds', list1Value: score1.breakdown.classifieds, list2Value: score2.breakdown.classifieds },
    ];

    const comparison = comparisons.map(c => ({
        ...c,
        winner: c.list1Value > c.list2Value ? list1.name : (c.list2Value > c.list1Value ? list2.name : 'Tie'),
        delta: Math.abs(c.list1Value - c.list2Value)
    }));

    const list1Wins = comparison.filter(c => c.winner === list1.name).length;
    const list2Wins = comparison.filter(c => c.winner === list2.name).length;

    let summary = '';
    if (list1Wins > list2Wins) {
        summary = `${list1.name} leads in ${list1Wins} dimensions vs ${list2Wins} for ${list2.name}.`;
    } else if (list2Wins > list1Wins) {
        summary = `${list2.name} leads in ${list2Wins} dimensions vs ${list1Wins} for ${list1.name}.`;
    } else {
        summary = 'Lists are closely matched across dimensions.';
    }

    return {
        list1: { name: list1.name, score: score1 },
        list2: { name: list2.name, score: score2 },
        comparison,
        summary
    };
}
