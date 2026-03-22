
import { DatabaseAdapter } from './DatabaseAdapter.js';
import { decodeArmyCode } from '../shared/armyCode.js';
import { hydrateList } from './list-utils.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
    const armyCode = "axZrZXN0cmVsLWNvbG9uaWFsLWZvcmNlASCBLAIBAQAKAIcXAQQAAIcLAQcAAIcLAQkAAIcQAQMAAIcMAQUAAIcVAQEAAIcVAQEAAIcPAQEAAIcSAQMAAC4BAgACAQAFAIcVAQUAAIcVAQUAAIcgAQUAAIYiAQQAACYBAQA=";

    const db = DatabaseAdapter.getInstance();
    await db.init();

    // 1. SCORING
    const decoded = decodeArmyCode(armyCode);
    const hydrated = hydrateList(decoded);

    let totalPoints = 0;
    let totalSwc = 0;
    let models = 0;
    let specialists = 0;
    let doctors = 0;
    let engineers = 0;
    let hackers = 0;
    let heavyWeapons = 0;
    let fastUnits = 0;
    let totalBS = 0;
    let totalARM = 0;
    let totalWounds = 0;

    for (const group of hydrated.groups) {
        for (const unit of group.units) {
            totalPoints += unit.points || 0;
            totalSwc += unit.swc || 0;
            models++;
            totalBS += unit.profile.bs || 11;
            totalARM += unit.profile.arm || 0;
            totalWounds += unit.profile.w || 1;

            const skills = unit.skills?.map((s: { name: string }) => s.name.toLowerCase()) || [];

            if (skills.some((s: string) => s.includes('doctor'))) { doctors++; specialists++; }
            if (skills.some((s: string) => s.includes('engineer'))) { engineers++; specialists++; }
            if (skills.some((s: string) => s.includes('hacker'))) { hackers++; specialists++; }
            if (skills.some((s: string) => s.includes('forward observer'))) specialists++;
            if (skills.some((s: string) => s.includes('paramedic'))) specialists++;

            // Check for heavy weapons
            const weapons = unit.weapons?.map((w: { name: string }) => w.name.toLowerCase()) || [];
            if (weapons.some((w: string) => ['hmg', 'missile', 'spitfire', 'tag'].some(hw => w.includes(hw)))) {
                heavyWeapons++;
            }

            // Check movement
            const moveVal = parseInt(unit.profile.move.split('-')[0] || '0');
            if (moveVal >= 6) fastUnits++;
        }
    }

    const avgBS = totalBS / models;
    const avgARM = totalARM / models;
    const orderEfficiency = (models / totalPoints) * 50;

    const offenseScore = Math.min(100, Math.round((avgBS - 10) * 15 + heavyWeapons * 15));
    const defenseScore = Math.min(100, Math.round(avgARM * 10 + totalWounds * 5));
    const ordersScore = Math.min(100, Math.round(orderEfficiency * 30));
    const specialistsScore = Math.min(100, Math.round(specialists * 25));
    const mobilityScore = Math.min(100, Math.round(fastUnits * 15));

    const overallScore = Math.round((offenseScore + defenseScore + ordersScore + specialistsScore + mobilityScore) / 5);

    const scoreResult = {
        summary: {
            totalPoints,
            totalSwc: Math.round(totalSwc * 10) / 10,
            models,
            combatGroups: hydrated.groups.length
        },
        breakdown: {
            offense: { score: offenseScore, details: { avgBS: Math.round(avgBS * 10) / 10, heavyWeapons } },
            defense: { score: defenseScore, details: { avgARM: Math.round(avgARM * 10) / 10, totalWounds } },
            orders: { score: ordersScore, details: { efficiency: Math.round(orderEfficiency * 100) / 100 } },
            specialists: { score: specialistsScore, details: { total: specialists, doctors, engineers, hackers } },
            mobility: { score: mobilityScore, details: { fastUnits } }
        },
        overallScore,
        grade: overallScore >= 80 ? 'A' : overallScore >= 60 ? 'B' : overallScore >= 40 ? 'C' : 'D'
    };

    console.log("SCORING RESULT:");
    console.log(JSON.stringify(scoreResult, null, 2));

    // 2. CLASSIFIEDS
    const dataDir = path.join(process.cwd(), 'data');
    const classifiedsPath = path.join(dataDir, 'classifieds.json');
    const classifiedsText = await fs.readFile(classifiedsPath, 'utf-8');
    const classifieds = JSON.parse(classifiedsText);

    let units: Array<{ name: string; isc: string; skills: string[]; equipment: string[] }> = [];

    for (const group of hydrated.groups) {
        for (const unit of group.units) {
            const skills = unit.skills?.map((s: { name: string }) => s.name) || [];
            const equipment = unit.equipment?.map((e: { name: string }) => e.name) || [];
            units.push({
                name: unit.name,
                isc: unit.isc || unit.name,
                skills,
                equipment
            });
        }
    }

    const clfResults: Array<{
        classified: string;
        category: string;
        canComplete: boolean;
        completableBy: string[];
        requirement: string;
    }> = [];

    for (const cls of classifieds) {
        const completableBy: string[] = [];

        for (const unit of units) {
            const allTraits = [...unit.skills, ...unit.equipment].map(t => t.toLowerCase());

            for (const requirement of cls.designatedTroopers) {
                const reqLower = requirement.toLowerCase();
                if (reqLower === 'any') {
                    completableBy.push(unit.name);
                    break;
                }
                if (allTraits.some(t => t.includes(reqLower) || reqLower.includes(t))) {
                    completableBy.push(unit.name);
                    break;
                }
            }
        }

        clfResults.push({
            classified: cls.name,
            category: cls.category.split(' ')[0],
            canComplete: completableBy.length > 0,
            completableBy: [...new Set(completableBy)],
            requirement: cls.designatedTroopers.join(' or ')
        });
    }

    const completable = clfResults.filter(r => r.canComplete);
    const notCompletable = clfResults.filter(r => !r.canComplete);

    const classifiedResult = {
        summary: {
            totalClassifieds: classifieds.length,
            completable: completable.length,
            coverage: `${Math.round((completable.length / classifieds.length) * 100)}%`
        },
        completable: completable.map(r => ({
            name: r.classified,
            by: r.completableBy
        })),
        notCompletable: notCompletable.map(r => ({
            name: r.classified,
            needs: r.requirement
        }))
    };

    console.log("\nCLASSIFIEDS RESULT:");
    console.log(JSON.stringify(classifiedResult, null, 2));
}

main().catch(console.error);
