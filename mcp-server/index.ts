import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DatabaseAdapter } from "./DatabaseAdapter.js";
import { getFireteamBonuses } from "./utils.js";

// Initialize Database
const db = DatabaseAdapter.getInstance();

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
            results = results.filter(u => u.name.toLowerCase().includes(q) || u.isc.toLowerCase().includes(q));
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

// 6. Read Rules (Wiki) - OFFline Only
server.tool(
    "read_wiki_page",
    "Read a rule page from the local offline cache. Network access is disabled.",
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
    "Search the full text of the cached Infinity Wiki rules. Use this to find rules that are not Items (e.g. 'Line of Fire', 'Orders', 'States').",
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
        const { decodeArmyCode } = await import('./army-utils.js');
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
