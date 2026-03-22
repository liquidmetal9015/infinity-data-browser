import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DatabaseAdapter } from "./DatabaseAdapter.js";
import { getFireteamBonuses } from "./utils.js";
import { hydrateUnit } from "./list-utils.js";
import { ListBuilder } from "./list-builder.js";
import { enrichSkillsWithSummaries } from "./skill-summaries.js";



// Initialize Database
const db = DatabaseAdapter.getInstance();
const listBuilder = ListBuilder.getInstance();

// Create Server
const server = new McpServer({
    name: "infinity-data-server",
    version: "1.0.0"
});

// --- RESOURCES ---

// 1. Metadata Resource
server.resource(
    "metadata",
    "infinity://metadata",
    async (uri) => {
        if (!db.metadata) await db.init();
        return {
            contents: [{
                uri: uri.href,
                text: JSON.stringify(db.metadata, null, 2)
            }]
        };
    }
);

// 2. Faction Resource
server.resource(
    "faction",
    "infinity://factions/{slug}",
    async (uri, { slug }) => {
        if (!db.metadata) await db.init();
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            const dataDir = path.join(process.cwd(), 'data');
            const filePath = path.join(dataDir, `${slug}.json`);

            const text = await fs.readFile(filePath, 'utf-8');
            return {
                contents: [{
                    uri: uri.href,
                    text: text
                }]
            };
        } catch (e) {
            throw new Error(`Faction file not found: ${slug}`);
        }
    }
);

// 3. Fireteam Chart Resource
server.resource(
    "fireteam_chart",
    "infinity://rules/fireteams/{faction_id}",
    async (uri, { faction_id }) => {
        if (!db.metadata) await db.init();
        const fid = parseInt(faction_id);
        const chart = db.getFireteamChart(fid);

        if (!chart) {
            throw new Error("No fireteam chart found for faction ID " + fid);
        }

        return {
            contents: [{
                uri: uri.href,
                text: JSON.stringify(chart, null, 2)
            }]
        };
    }
);

// 4. Core Rules Summary Resource
server.resource(
    "core_rules",
    "infinity://rules/core-summary",
    async (uri) => {
        const fs = await import('fs/promises');
        const path = await import('path');
        const dataDir = path.join(process.cwd(), 'data');
        const filePath = path.join(dataDir, 'core-rules-summary.md');

        try {
            const text = await fs.readFile(filePath, 'utf-8');
            return {
                contents: [{
                    uri: uri.href,
                    text: text
                }]
            };
        } catch (e) {
            return {
                contents: [{
                    uri: uri.href,
                    text: "Core rules summary not found. Use read_wiki_page and search_wiki to look up specific rules."
                }]
            };
        }
    }
);

// --- TOOLS ---

// 1. Search Units
server.tool(
    "search_units",
    "Search for units using criteria. Supports name query and structured filters (stats, weapons, skills).",
    {
        query: z.string().optional().describe("Name search query"),
        operator: z.enum(["and", "or"]).default("and").describe("Logic for combining filters. Default is AND."),
        filters: z.array(z.object({
            type: z.enum(["weapon", "skill", "equipment", "stat"]),
            baseId: z.number().optional().describe("ID of the item (for weapon/skill/equipment)"),
            modifiers: z.array(z.number()).optional().describe("Modifiers IDs for the item"),
            matchAnyModifier: z.boolean().optional(),
            stat: z.string().optional().describe("Stat name (MOV, CC, BS, PH, WIP, ARM, BTS, W, S)"),
            statOperator: z.enum([">", ">=", "=", "<=", "<"]).optional(),
            value: z.number().optional()
        })).optional().describe("List of filters")
    },
    async ({ query, operator, filters }) => {
        if (!db.metadata) await db.init();

        let results = db.units;

        if (query) {
            const q = query.toLowerCase();
            results = results.filter(u => (u.name?.toLowerCase() || '').includes(q) || (u.isc?.toLowerCase() || '').includes(q));
        }

        if (filters && filters.length > 0) {
            const itemFilters = filters.filter(f => f.type !== 'stat').map(f => ({
                type: f.type as 'weapon' | 'skill' | 'equipment',
                baseId: f.baseId!,
                modifiers: f.modifiers || [],
                matchAnyModifier: f.matchAnyModifier || false
            }));

            const statFilters = filters.filter(f => f.type === 'stat');

            if (itemFilters.length > 0) {
                const itemMatches = db.searchWithModifiers(itemFilters, operator);
                if (operator === 'and') {
                    const matchIds = new Set(itemMatches.map(u => u.id));
                    results = results.filter(u => matchIds.has(u.id));
                } else {
                    const matchIds = new Set(itemMatches.map(u => u.id));
                    results = results.filter(u => matchIds.has(u.id));
                }
            }

            if (statFilters.length > 0) {
                results = results.filter(unit => {
                    const resultsForUnit = statFilters.map(f => {
                        if (!f.stat || !f.statOperator || f.value === undefined) return false;
                        return unit.raw.profileGroups.some(pg =>
                            pg.profiles.some(p => {
                                let statVal = 0;
                                switch (f.stat) {
                                    case 'CC': statVal = p.cc; break;
                                    case 'BS': statVal = p.bs; break;
                                    case 'PH': statVal = p.ph; break;
                                    case 'WIP': statVal = p.wip; break;
                                    case 'ARM': statVal = p.arm; break;
                                    case 'BTS': statVal = p.bts; break;
                                    case 'W': statVal = p.w; break;
                                    case 'S': statVal = p.s; break;
                                    case 'MOV':
                                        if (p.move.length === 2) statVal = Math.round((p.move[0] + p.move[1]) * 0.4);
                                        break;
                                }

                                switch (f.statOperator) {
                                    case '>': return statVal > f.value!;
                                    case '>=': return statVal >= f.value!;
                                    case '=': return statVal === f.value!;
                                    case '<=': return statVal <= f.value!;
                                    case '<': return statVal < f.value!;
                                }
                                return false;
                            })
                        );
                    });

                    if (operator === 'and') return resultsForUnit.every(r => r);
                    return resultsForUnit.some(r => r);
                });
            }
        }

        const responseData = {
            count: results.length,
            units: results.map(u => ({
                name: u.name,
                isc: u.isc,
                slug: u.raw.slug,
                factions: u.factions.map(f => db.factionMap.get(f)).filter(Boolean)
            }))
        };

        return {
            content: [{
                type: "text",
                text: JSON.stringify(responseData, null, 2)
            }]
        };
    }
);

// 2. Get Unit Details
server.tool(
    "get_unit_details",
    "Get full details for a unit by slug or ISC.",
    {
        slug: z.string().describe("Unit Slug or ISC name")
    },
    async ({ slug }) => {
        if (!db.metadata) await db.init();
        const unit = db.getUnitBySlug(slug) || db.getUnitBySlug(slug.toLowerCase().replace(/ /g, '-'));

        if (!unit) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({ error: "Unit not found" })
                }]
            };
        }

        const responseData = {
            unit: unit.raw,
            stats: {
                points: unit.pointsRange
            }
        };

        return {
            content: [{
                type: "text",
                text: JSON.stringify(responseData, null, 2)
            }]
        };
    }
);

// 2.5 Get Enriched Unit Profile (Agent Optimized)
server.tool(
    "get_unit_profile",
    "Get enriched unit profiles with full stats, skills (with rule summaries), and loadout options. This tool auto-includes brief explanations of each skill. For detailed rule interactions, use read_wiki_page on specific skills.",
    {
        slug: z.string().describe("Unit Slug or ISC name")
    },
    async ({ slug }) => {
        if (!db.metadata) await db.init();
        const unit = db.getUnitBySlug(slug) || db.getUnitBySlug(slug.toLowerCase().replace(/ /g, '-'));

        if (!unit) {
            return {
                content: [{ type: "text", text: `Unit '${slug}' not found.` }],
                isError: true
            };
        }

        const loadouts: any[] = [];

        for (const pg of unit.raw.profileGroups) {
            // Use heuristics to find the primary profile (usually the first one)
            const profile = pg.profiles[0];
            if (!profile) continue;

            for (const option of pg.options) {
                const hydrated = hydrateUnit(db, unit, profile, option);
                // Enrich skills with summaries for better agent understanding
                const enrichedSkills = enrichSkillsWithSummaries(hydrated.skills || []);
                const enrichedEquipment = enrichSkillsWithSummaries(hydrated.equipment || []);

                loadouts.push({
                    id: option.id,
                    name: hydrated.name,
                    points: hydrated.points,
                    swc: hydrated.swc,
                    stats: hydrated.profile, // mov, cc, bs, etc.
                    weapons: hydrated.weapons,
                    skills: enrichedSkills,
                    equipment: enrichedEquipment
                });
            }
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    unit: {
                        name: unit.name,
                        isc: unit.isc,
                        factions: unit.factions.map(f => db.getFactionName(f)),
                        profileCount: loadouts.length
                    },
                    loadouts
                }, null, 2)
            }]
        };
    }
);

// 3. Search Items (Helpers for IDs)
server.tool(
    "search_items",
    "Lookup IDs for weapons, skills, or equipment to use in search_units filters.",
    {
        query: z.string(),
        type: z.enum(["weapon", "skill", "equipment"]).optional()
    },
    async ({ query, type }) => {
        if (!db.metadata) await db.init();

        const suggestions = db.getSuggestions(query);
        let valid = suggestions;
        if (type) {
            valid = valid.filter(s => s.type === type);
        }

        const responseData = {
            items: valid.map(s => ({
                id: s.id,
                name: s.name,
                displayName: s.displayName,
                type: s.type,
                modifiers: s.modifiers,
                wiki: s.wiki
            }))
        };

        return {
            content: [{
                type: "text",
                text: JSON.stringify(responseData, null, 2)
            }]
        };
    }
);

// 4. Validate Fireteam
server.tool(
    "validate_fireteam",
    "Validate a fireteam composition and calculate current bonuses.",
    {
        factionId: z.number().describe("ID of the sectorial/faction"),
        teamName: z.string().describe("Name of the Fireteam (e.g. 'Core Fireteam', 'Haris Fireteam', 'Duo Fireteam')"),
        members: z.array(z.string()).describe("List of unit names/ISCs in the team")
    },
    async ({ factionId, teamName, members }) => {
        if (!db.metadata) await db.init();

        const chart = db.getFireteamChart(factionId);
        if (!chart) return {
            content: [{ type: "text", text: JSON.stringify({ error: "No fireteam rules for this faction" }) }]
        };

        const teamDef = chart.teams.find(t => t.name.toLowerCase() === teamName.toLowerCase()) ||
            chart.teams.find(t => t.name.toLowerCase().includes(teamName.toLowerCase()));

        if (!teamDef) return {
            content: [{ type: "text", text: JSON.stringify({ error: `Fireteam '${teamName}' not found in chart.` }) }]
        };

        const memberDetails = members.map(mName => {
            const inTeam = teamDef.units.find(u => u.name.toLowerCase() === mName.toLowerCase());
            if (inTeam) return { name: inTeam.name, comment: inTeam.comment };

            const wildcard = chart.teams.find(t => t.name.toLowerCase().includes('wildcard'))?.units.find(u => u.name.toLowerCase() === mName.toLowerCase());
            if (wildcard) return { name: wildcard.name, comment: wildcard.comment };

            return { name: mName };
        });

        const bonuses = getFireteamBonuses(teamDef, memberDetails);
        const activeLevels = bonuses.filter(b => b.isActive).map(b => b.level);

        const responseData = {
            teamName: teamDef.name,
            valid: bonuses[0].isActive,
            activeLevels: activeLevels,
            bonuses: bonuses.filter(b => b.isActive).map(b => b.description)
        };

        return {
            content: [{
                type: "text",
                text: JSON.stringify(responseData, null, 2)
            }]
        };
    }
);

// 5. Get Faction Roster
server.tool(
    "get_faction_roster",
    "Get all units available to a specific faction.",
    {
        factionSlug: z.string()
    },
    async ({ factionSlug }) => {
        if (!db.metadata) await db.init();

        const faction = db.factionRegistry?.getAllFactions().find(f => f.slug === factionSlug);
        if (!faction) return {
            content: [{ type: "text", text: JSON.stringify({ error: "Faction not found" }) }]
        };

        const roster = db.units.filter(u => u.factions.includes(faction.id));

        const responseData = {
            faction: faction.name,
            count: roster.length,
            units: roster.map(u => u.name)
        };

        return {
            content: [{
                type: "text",
                text: JSON.stringify(responseData, null, 2)
            }]
        };
    }
);

// 5.5 Get Faction Context (Agent Optimized)
server.tool(
    "get_faction_context",
    "Get comprehensive context for list building: fireteam chart, key units, and reference data.",
    {
        factionSlug: z.string().describe("Faction slug (e.g. 'kestrel-colonial-force')"),
        includeRoster: z.boolean().default(true).describe("Include full unit roster"),
        includeFireteams: z.boolean().default(true).describe("Include fireteam chart"),
        includeReferenceTables: z.boolean().default(false).describe("Include hacking programs, fireteam bonuses, etc.")
    },
    async ({ factionSlug, includeRoster, includeFireteams, includeReferenceTables }) => {
        if (!db.metadata) await db.init();

        const faction = db.factionRegistry?.getAllFactions().find(f => f.slug === factionSlug);
        if (!faction) return {
            content: [{ type: "text", text: JSON.stringify({ error: "Faction not found" }) }]
        };

        const responseData: any = {
            faction: { id: faction.id, name: faction.name, parentId: faction.parentId }
        };

        if (includeFireteams) {
            const chart = db.getFireteamChart(faction.id);
            if (chart) responseData.fireteams = chart;
            else responseData.fireteams = "No fireteam data available for this faction.";
        }

        if (includeReferenceTables) {
            responseData.reference = {
                message: "Use get_reference_table for full tables"
            };
        }

        if (includeRoster) {
            const roster = db.units.filter(u => u.factions.includes(faction.id));
            responseData.roster = roster.map(u => ({
                name: u.name,
                slug: u.isc.toLowerCase().replace(/ /g, '-'),
                points: u.pointsRange
            }));
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify(responseData, null, 2)
            }]
        };
    }
);

// 6. Read Rules (Wiki) - OFFline Only
server.tool(
    "read_wiki_page",
    "Read a rule page from the local Infinity N5 wiki cache. USE THIS TOOL to verify game mechanics before making claims about rules. Never rely on training data for specific N5 rules - always verify with this tool. Common lookups: Mimetism, Camouflage, Cover, ARO, Orders, BS_Attack, CC_Attack, Dodge, Hacking.",
    {
        url: z.string().describe("Full URL of the wiki page or the Page Title/Slug")
    },
    async ({ url }) => {
        if (!db.wikiLoaded) await db.loadWiki();

        // Try to find the page
        const page = db.getWikiPage(url);

        if (page) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        title: page.title,
                        url: page.url,
                        content: page.content,
                        source: "local_cache"
                    }, null, 2)
                }]
            };
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    error: "Page not found in local cache. Network access is disabled.",
                    query: url
                })
            }]
        };
    }
);

// 7. Search Wiki (Full Text)
server.tool(
    "search_wiki",
    "Search the Infinity N5 wiki rules database. USE THIS to find rules when you don't know the exact page name. CRITICAL: Never assume you know Infinity rules from training data - always verify with search_wiki or read_wiki_page. Good for: finding modifier interactions, state effects, skill requirements.",
    {
        query: z.string().describe("Search query")
    },
    async ({ query }) => {
        if (!db.wikiLoaded) await db.loadWiki();

        const results = db.searchWiki(query);

        const responseData = {
            count: results.length,
            results: results.map(p => ({
                title: p.title,
                slug: p.slug,
                url: p.url,
                snippet: p.content.substring(0, 150).replace(/\n/g, ' ') + "..."
            }))
        };

        return {
            content: [{
                type: "text",
                text: JSON.stringify(responseData, null, 2)
            }]
        };
    }
);

// 8. Read ITS Rules
server.tool(
    "read_its_rules",
    "Read a specific section of the ITS Season 17 Tournament Rules.",
    {
        section: z.string().describe("Name of the section to read (e.g. 'Scenarios', 'Tournament Rules', 'Extras')")
    },
    async ({ section }) => {
        if (!db.itsRules) await db.loadITSRules();

        const result = db.getITSRuleSection(section);

        if (result) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        } else {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        error: "Section not found.",
                        availableSections: db.itsRules?.toc.map(t => t.title).slice(0, 20)
                    })
                }]
            };
        }
    }
);

// 9. Search ITS Rules
server.tool(
    "search_its_rules",
    "Search the full text of the ITS Season 17 Tournament Rules.",
    {
        query: z.string().describe("Search query")
    },
    async ({ query }) => {
        if (!db.itsRules) await db.loadITSRules();

        const results = db.searchITSRules(query);

        return {
            content: [{
                type: "text",
                text: JSON.stringify({ results }, null, 2)
            }]
        };
    }
);

// 10. Parse Army Code
server.tool(
    "parse_army_code",
    "Parse an Infinity Army Code (Base64) into a detailed list analysis. Returns full stats, weapons, and skills for every unit. Use this to analyze lists or compare them.",
    {
        armyCode: z.string().describe("The Base64 army code string")
    },
    async ({ armyCode }) => {
        if (!db.metadata) await db.init();

        // Dynamic import to avoid initialization issues if modules depend on DB
        const { decodeArmyCode } = await import('../shared/armyCode.js');
        const { hydrateList } = await import('./list-utils.js');

        try {
            const decoded = decodeArmyCode(armyCode);
            const hydrated = hydrateList(decoded);

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(hydrated, null, 2)
                }]
            };
        } catch (e) {
            return {
                isError: true,
                content: [{
                    type: "text",
                    text: `Failed to parse army code: ${e instanceof Error ? e.message : String(e)}`
                }]
            };
        }
    }
);

// 11. Analyze Classifieds
server.tool(
    "analyze_classifieds",
    "Analyze which classified objectives a list can complete. Input either an army code or list of unit names.",
    {
        armyCode: z.string().optional().describe("Base64 army code"),
        unitNames: z.array(z.string()).optional().describe("List of unit names/ISCs as alternative to army code")
    },
    async ({ armyCode, unitNames }) => {
        if (!db.metadata) await db.init();

        // Load classifieds data
        const fs = await import('fs/promises');
        const path = await import('path');
        const dataDir = path.join(process.cwd(), 'data');
        const classifiedsPath = path.join(dataDir, 'classifieds.json');

        let classifieds: Array<{
            id: number;
            name: string;
            category: string;
            designatedTroopers: string[];
            objective: string;
        }>;

        try {
            const text = await fs.readFile(classifiedsPath, 'utf-8');
            classifieds = JSON.parse(text);
        } catch {
            return {
                content: [{ type: "text", text: JSON.stringify({ error: "Could not load classifieds data" }) }]
            };
        }

        // Build skill/equip name maps
        const skillsMap = new Map<number, string>();
        const equipsMap = new Map<number, string>();

        if (db.metadata?.skills) {
            for (const s of db.metadata.skills) {
                skillsMap.set(s.id, s.name);
            }
        }
        if (db.metadata?.equips) {
            for (const e of db.metadata.equips) {
                equipsMap.set(e.id, e.name);
            }
        }

        // Get units to analyze
        let units: Array<{ name: string; isc: string; skills: string[]; equipment: string[] }> = [];

        if (armyCode) {
            const { decodeArmyCode } = await import('../shared/armyCode.js');
            const { hydrateList } = await import('./list-utils.js');

            try {
                const decoded = decodeArmyCode(armyCode);
                const hydrated = hydrateList(decoded);

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
            } catch (e) {
                return {
                    content: [{ type: "text", text: JSON.stringify({ error: `Failed to parse army code: ${e}` }) }]
                };
            }
        } else if (unitNames) {
            for (const name of unitNames) {
                const unit = db.getUnitBySlug(name) || db.getUnitBySlug(name.toLowerCase().replace(/ /g, '-'));
                if (unit) {
                    const skills: string[] = [];
                    const equipment: string[] = [];
                    for (const id of unit.allSkillIds) {
                        const name = skillsMap.get(id);
                        if (name) skills.push(name);
                    }
                    for (const id of unit.allEquipmentIds) {
                        const name = equipsMap.get(id);
                        if (name) equipment.push(name);
                    }
                    units.push({
                        name: unit.name,
                        isc: unit.isc,
                        skills,
                        equipment
                    });
                }
            }
        }

        // Analyze classifieds
        const results: Array<{
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

            results.push({
                classified: cls.name,
                category: cls.category.split(' ')[0],
                canComplete: completableBy.length > 0,
                completableBy: [...new Set(completableBy)],
                requirement: cls.designatedTroopers.join(' or ')
            });
        }

        const completable = results.filter(r => r.canComplete);
        const notCompletable = results.filter(r => !r.canComplete);

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
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
                }, null, 2)
            }]
        };
    }
);

// 12. Calculate Face-to-Face
server.tool(
    "calculate_f2f",
    "Calculate face-to-face roll probabilities and expected wounds between two combatants.",
    {
        active: z.object({
            sv: z.number().describe("Ballistic Skill or CC value (after all modifiers)"),
            burst: z.number().describe("Number of dice"),
            damage: z.number().describe("Weapon damage"),
            ammo: z.string().default("NORMAL").describe("Ammo type: NORMAL, DA, EXP, T2, PLASMA"),
            arm: z.number().describe("Defender's ARM"),
            bts: z.number().default(0).describe("Defender's BTS"),
            cont: z.boolean().default(false).describe("Continuous damage"),
            critImmune: z.boolean().default(false).describe("Target is crit immune")
        }),
        reactive: z.object({
            sv: z.number().describe("Ballistic Skill or CC value (after all modifiers)"),
            burst: z.number().describe("Number of dice"),
            damage: z.number().describe("Weapon damage"),
            ammo: z.string().default("NORMAL").describe("Ammo type: NORMAL, DA, EXP, T2, PLASMA"),
            arm: z.number().describe("Defender's ARM"),
            bts: z.number().default(0).describe("Defender's BTS"),
            cont: z.boolean().default(false).describe("Continuous damage"),
            critImmune: z.boolean().default(false).describe("Target is crit immune")
        })
    },
    async ({ active, reactive }) => {
        const { calculateF2F } = await import('../shared/dice-engine.js');

        const result = calculateF2F(active, reactive);

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    summary: {
                        activeWinPct: `${result.activeWins}%`,
                        reactiveWinPct: `${result.reactiveWins}%`,
                        drawPct: `${result.draw}%`
                    },
                    expectedWounds: {
                        activeDeals: result.expectedActiveWounds,
                        reactiveDeals: result.expectedReactiveWounds
                    },
                    woundDistribution: {
                        activeDeals: result.woundDistActive,
                        reactiveDeals: result.woundDistReactive
                    }
                }, null, 2)
            }]
        };
    }
);

// 13. Classify Units by Role
server.tool(
    "classify_units",
    "Find the best units for a specific combat role (gunfighter, melee, specialist, skirmisher, heavy, support).",
    {
        factionSlug: z.string().optional().describe("Faction to search within"),
        armyCode: z.string().optional().describe("Army code to analyze"),
        role: z.enum(["gunfighter", "melee", "specialist", "button_pusher", "skirmisher", "heavy", "support", "hack_target", "order_generator"])
            .describe("Combat role to rank units by"),
        limit: z.number().default(10).describe("Maximum results to return")
    },
    async ({ factionSlug, armyCode, role, limit }) => {
        if (!db.metadata) await db.init();

        // Build metadata maps
        const skillsMap = new Map<number, string>();
        const weaponsMap = new Map<number, { name: string; burst?: string; damage?: string; distance?: { med?: { max: number } } }>();
        const equipsMap = new Map<number, string>();

        if (db.metadata?.skills) {
            for (const s of db.metadata.skills) {
                skillsMap.set(s.id, s.name);
            }
        }
        if (db.metadata?.weapons) {
            for (const w of db.metadata.weapons) {
                weaponsMap.set(w.id, {
                    name: w.name,
                    burst: w.burst,
                    damage: w.damage,
                    distance: w.distance
                });
            }
        }
        if (db.metadata?.equips) {
            for (const e of db.metadata.equips) {
                equipsMap.set(e.id, e.name);
            }
        }

        const metadata = { skills: skillsMap, weapons: weaponsMap, equips: equipsMap };

        // Get units to analyze
        let unitsToAnalyze: Array<{ unit: typeof db.units[0]; profile: { bs: number; cc: number; ph: number; wip: number; arm: number; bts: number; w: number; s: number; move: number[]; type?: number; skills: { id: number }[]; equip: { id: number }[]; weapons?: { id: number }[]; name: string }; option: { name: string; points: number; swc?: number; skills: { id: number }[]; equip: { id: number }[]; weapons: { id: number }[] } }> = [];

        if (armyCode) {
            const { decodeArmyCode } = await import('../shared/armyCode.js');
            const { hydrateList } = await import('./list-utils.js');

            try {
                const decoded = decodeArmyCode(armyCode);
                const hydrated = hydrateList(decoded);

                for (const group of hydrated.groups) {
                    for (const unit of group.units) {
                        const dbUnit = db.getUnitBySlug(unit.isc || unit.name.toLowerCase().replace(/ /g, '-'));
                        if (dbUnit) {
                            const pg = dbUnit.raw.profileGroups[0];
                            const profile = pg?.profiles[0];
                            const option = pg?.options[0];
                            if (profile && option) {
                                unitsToAnalyze.push({
                                    unit: dbUnit,
                                    profile: profile,
                                    option: option
                                });
                            }
                        }
                    }
                }
            } catch {
                // Fall through to faction search
            }
        }

        if (unitsToAnalyze.length === 0 && factionSlug) {
            const faction = db.factionRegistry?.getAllFactions().find(f => f.slug === factionSlug);
            if (faction) {
                const roster = db.units.filter(u => u.factions.includes(faction.id));
                for (const unit of roster.slice(0, 50)) { // Limit for performance
                    const pg = unit.raw.profileGroups[0];
                    const profile = pg?.profiles[0];
                    const option = pg?.options[0];
                    if (profile && option) {
                        unitsToAnalyze.push({ unit, profile, option });
                    }
                }
            }
        }

        // Import classification logic
        const { classifyUnit, getTopUnitsByRole } = await import('../shared/unit-roles.js');

        // Classify and rank
        const results: Array<{
            name: string;
            isc: string;
            option: string;
            points: number;
            swc: number;
            roleScore: number;
            reasons: string[];
            primaryRole: string;
        }> = [];

        for (const { unit, profile, option } of unitsToAnalyze) {
            const analysis = classifyUnit(unit as any, profile as any, option as any, metadata as any);
            const roleScore = analysis.roles.find(r => r.role === role);

            if (roleScore && roleScore.score > 0) {
                results.push({
                    name: unit.name,
                    isc: unit.isc,
                    option: option.name,
                    points: option.points,
                    swc: option.swc || 0,
                    roleScore: roleScore.score,
                    reasons: roleScore.reasons,
                    primaryRole: analysis.primaryRole
                });
            }
        }

        results.sort((a, b) => b.roleScore - a.roleScore);

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    role,
                    count: Math.min(results.length, limit),
                    units: results.slice(0, limit)
                }, null, 2)
            }]
        };
    }
);

// 14. Analyze Matchup (high-level unit comparison)
server.tool(
    "analyze_matchup",
    "Analyze how two specific units would fare against each other in combat.",
    {
        attacker: z.string().describe("Attacker unit name/ISC"),
        defender: z.string().describe("Defender unit name/ISC"),
        range: z.number().default(16).describe("Combat range in inches"),
        cover: z.boolean().default(false).describe("Defender is in cover")
    },
    async ({ attacker, defender, range, cover }) => {
        if (!db.metadata) await db.init();

        const attackerUnit = db.getUnitBySlug(attacker) || db.getUnitBySlug(attacker.toLowerCase().replace(/ /g, '-'));
        const defenderUnit = db.getUnitBySlug(defender) || db.getUnitBySlug(defender.toLowerCase().replace(/ /g, '-'));

        if (!attackerUnit || !defenderUnit) {
            return {
                content: [{
                    type: "text", text: JSON.stringify({
                        error: "Unit not found",
                        attackerFound: !!attackerUnit,
                        defenderFound: !!defenderUnit
                    })
                }]
            };
        }

        // Get primary profiles
        const aPg = attackerUnit.raw.profileGroups[0];
        const dPg = defenderUnit.raw.profileGroups[0];
        const aProfile = aPg?.profiles[0];
        const dProfile = dPg?.profiles[0];
        const aOption = aPg?.options[0];
        const dOption = dPg?.options[0];

        if (!aProfile || !dProfile) {
            return {
                content: [{ type: "text", text: JSON.stringify({ error: "Could not find profiles" }) }]
            };
        }

        // Find best weapon for range
        const rangeCm = range * 2.5; // Convert inches to cm
        const weaponsMap = new Map<number, any>();
        if (db.metadata?.weapons) {
            for (const w of db.metadata.weapons) {
                weaponsMap.set(w.id, w);
            }
        }

        const getWeaponAtRange = (weaponIds: Set<number>, rangeCm: number) => {
            let bestMod = -100;
            let bestWeapon = null;

            for (const id of weaponIds) {
                const w = weaponsMap.get(id);
                if (!w || !w.distance) continue;

                let mod = -6;
                if (rangeCm <= (w.distance.short?.max || 0)) mod = parseInt(w.distance.short?.mod || '-3');
                else if (rangeCm <= (w.distance.med?.max || 0)) mod = parseInt(w.distance.med?.mod || '0');
                else if (rangeCm <= (w.distance.long?.max || 0)) mod = parseInt(w.distance.long?.mod || '-3');
                else if (rangeCm <= (w.distance.max?.max || 0)) mod = parseInt(w.distance.max?.mod || '-6');

                if (mod > bestMod) {
                    bestMod = mod;
                    bestWeapon = { ...w, rangeMod: mod };
                }
            }
            return bestWeapon;
        };

        const aWeapon = getWeaponAtRange(attackerUnit.allWeaponIds, rangeCm);
        const dWeapon = getWeaponAtRange(defenderUnit.allWeaponIds, rangeCm);

        const { calculateF2F } = await import('../shared/dice-engine.js');

        // Calculate with standard active turn scenario (attacker shoots, defender AROs)
        const aSV = aProfile.bs + (aWeapon?.rangeMod || 0);
        const dSV = dProfile.bs + (dWeapon?.rangeMod || 0) + (cover ? -3 : 0);

        const result = calculateF2F(
            {
                sv: aSV,
                burst: parseInt(aWeapon?.burst || '3'),
                damage: parseInt(aWeapon?.damage || '13'),
                ammo: 'NORMAL',
                arm: dProfile.arm + (cover ? 3 : 0),
                bts: dProfile.bts
            },
            {
                sv: dSV,
                burst: 1,
                damage: parseInt(dWeapon?.damage || '13'),
                ammo: 'NORMAL',
                arm: aProfile.arm,
                bts: aProfile.bts
            }
        );

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    scenario: {
                        attacker: attackerUnit.name,
                        defender: defenderUnit.name,
                        range: `${range}"`,
                        cover: cover
                    },
                    weapons: {
                        attacker: aWeapon?.name || 'Unknown',
                        attackerMod: aWeapon?.rangeMod || 0,
                        defender: dWeapon?.name || 'Unknown',
                        defenderMod: dWeapon?.rangeMod || 0
                    },
                    effectiveValues: {
                        attackerBS: aSV,
                        defenderBS: dSV
                    },
                    results: {
                        attackerWins: `${result.activeWins}%`,
                        defenderWins: `${result.reactiveWins}%`,
                        draw: `${result.draw}%`,
                        expectedWoundsOnDefender: result.expectedActiveWounds,
                        expectedWoundsOnAttacker: result.expectedReactiveWounds
                    },
                    analysis: result.activeWins > 60
                        ? `${attackerUnit.name} has a strong advantage.`
                        : result.activeWins > 40
                            ? "Roughly even matchup."
                            : `${defenderUnit.name} is favored despite being reactive.`
                }, null, 2)
            }]
        };
    }
);

// 15. Compare Lists
server.tool(
    "compare_lists",
    "Compare two army lists and analyze relative strengths and weaknesses.",
    {
        list1Code: z.string().describe("First army code"),
        list2Code: z.string().describe("Second army code"),
        list1Name: z.string().default("List 1").describe("Name for first list"),
        list2Name: z.string().default("List 2").describe("Name for second list")
    },
    async ({ list1Code, list2Code, list1Name, list2Name }) => {
        if (!db.metadata) await db.init();

        const { decodeArmyCode } = await import('../shared/armyCode.js');
        const { hydrateList } = await import('./list-utils.js');

        let list1Info, list2Info;

        try {
            const decoded1 = decodeArmyCode(list1Code);
            const hydrated1 = hydrateList(decoded1);
            list1Info = hydrated1;
        } catch (e) {
            return {
                content: [{ type: "text", text: JSON.stringify({ error: `Failed to parse list 1: ${e}` }) }]
            };
        }

        try {
            const decoded2 = decodeArmyCode(list2Code);
            const hydrated2 = hydrateList(decoded2);
            list2Info = hydrated2;
        } catch (e) {
            return {
                content: [{ type: "text", text: JSON.stringify({ error: `Failed to parse list 2: ${e}` }) }]
            };
        }

        // Calculate basic metrics for each list
        const getListMetrics = (list: typeof list1Info) => {
            let points = 0;
            let swc = 0;
            let models = 0;
            let specialists = 0;
            const unitNames: string[] = [];

            for (const group of list.groups) {
                for (const unit of group.units) {
                    points += unit.points || 0;
                    swc += unit.swc || 0;
                    models++;
                    unitNames.push(unit.name);

                    // Check for specialist skills
                    const skills = unit.skills?.map((s: { name: string }) => s.name.toLowerCase()) || [];
                    if (skills.some((s: string) => ['doctor', 'engineer', 'hacker', 'forward observer', 'paramedic'].some(spec => s.includes(spec)))) {
                        specialists++;
                    }
                }
            }

            return { points, swc, models, specialists, units: unitNames, combatGroups: list.groups.length };
        };

        const metrics1 = getListMetrics(list1Info);
        const metrics2 = getListMetrics(list2Info);

        const comparison = {
            [list1Name]: metrics1,
            [list2Name]: metrics2,
            analysis: {
                pointsDiff: metrics1.points - metrics2.points,
                modelsDiff: metrics1.models - metrics2.models,
                specialistsDiff: metrics1.specialists - metrics2.specialists,
                moreEfficient: metrics1.models > metrics2.models ? list1Name : list2Name,
                moreSpecialists: metrics1.specialists > metrics2.specialists ? list1Name : list2Name
            }
        };

        return {
            content: [{
                type: "text",
                text: JSON.stringify(comparison, null, 2)
            }]
        };
    }
);



// ============================================================================
// List Building Tools (Stateful)
// ============================================================================

// 12. Create List
server.tool(
    "create_list",
    "Start building a new army list.",
    {
        factionSlug: z.string().describe("Faction Slug (e.g. 'kestrel-colonial-force')"),
        armyName: z.string().default("New List").describe("Name of the list"),
        pointsLimit: z.number().default(300).describe("Maximum points (usually 300)")
    },
    async ({ factionSlug, armyName, pointsLimit }) => {
        if (!db.metadata) await db.init();
        try {
            const status = listBuilder.createList(factionSlug, armyName, pointsLimit);
            return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
        }
    }
);

// 13. Add Unit
server.tool(
    "add_unit",
    "Add a unit to the current list.",
    {
        unitSlug: z.string().describe("Unit Slug or ISC name"),
        groupNumber: z.number().default(1).describe("Combat Group number (1 or 2)"),
        optionId: z.number().optional().describe("Specific option ID (loadout). If omitted, uses default/first option."),
        profileId: z.number().optional().describe("Specific profile ID (optional, rarely needed)")
    },
    async ({ unitSlug, groupNumber, optionId, profileId }) => {
        try {
            const status = listBuilder.addUnit(unitSlug, groupNumber, optionId, profileId);
            return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
        }
    }
);

// 14. Remove Unit
server.tool(
    "remove_unit",
    "Remove a unit from the current list.",
    {
        groupNumber: z.number().describe("Combat Group number"),
        slotIndex: z.number().describe("Index of the unit in the group (0-based)")
    },
    async ({ groupNumber, slotIndex }) => {
        try {
            const status = listBuilder.removeUnit(groupNumber, slotIndex);
            return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
        }
    }
);

// 15. Get List Status
server.tool(
    "get_list_status",
    "Get current list status: points, SWC, orders, and validation issues.",
    {},
    async () => {
        try {
            const status = listBuilder.getStatus();
            return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
        }
    }
);

// 16. Export Army Code
server.tool(
    "export_army_code",
    "Generate a shareable army code for the current list.",
    {},
    async () => {
        try {
            const code = listBuilder.generateCode();
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        code: code,
                        url: `https://army.infinityuniverse.com/?code=${code}` // Basic URL construction
                    }, null, 2)
                }]
            };
        } catch (e: any) {
            return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
        }
    }
);


// Start Server
async function main() {
    await db.init();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Infinity MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
