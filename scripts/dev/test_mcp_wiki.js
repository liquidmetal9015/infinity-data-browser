import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
    console.log("Starting MCP Wiki Test...");

    const transport = new StdioClientTransport({
        command: "/bin/bash",
        args: ["/home/clindbeck9/infinity-data/run_mcp.sh"]
    });

    const client = new Client({
        name: "test-client",
        version: "1.0.0"
    }, {
        capabilities: {}
    });

    await client.connect(transport);
    console.log("Connected to MCP Server");

    // 1. List Tools
    const tools = await client.listTools();
    console.log("Tools available:", tools.tools.map(t => t.name).join(", "));

    // 2. Search Items checking for Wiki link
    console.log("\nSearching for 'Camouflage'...");
    const searchResult = await client.callTool({
        name: "search_items",
        arguments: {
            query: "Camouflage",
            type: "skill"
        }
    });

    const camo = JSON.parse(searchResult.content[0].text).items[0];
    console.log("Found Item:", camo);

    if (camo && camo.wiki) {
        console.log(`\nTesting read_wiki_page with URL: ${camo.wiki}`);
        try {
            const wikiResult = await client.callTool({
                name: "read_wiki_page",
                arguments: {
                    url: camo.wiki
                }
            });
            const wikiData = JSON.parse(wikiResult.content[0].text);
            console.log("Wiki Page Title:", wikiData.title);
            console.log("Content Snippet:", wikiData.content.substring(0, 200) + "...");
        } catch (e) {
            console.error("Wiki read failed:", e.message);
        }
    } else {
        console.log("No wiki link found for Camouflage. Trying 'Trench-Hammer'...");
        const searchResult2 = await client.callTool({
            name: "search_items",
            arguments: {
                query: "Trench-Hammer",
                type: "weapon"
            }
        });
        const hammer = JSON.parse(searchResult2.content[0].text).items[0];
        console.log("Found Item:", hammer);
        if (hammer && hammer.wiki) {
            console.log(`\nTesting read_wiki_page with URL: ${hammer.wiki}`);
            const wikiResult = await client.callTool({
                name: "read_wiki_page",
                arguments: {
                    url: hammer.wiki
                }
            });
            const wikiData = JSON.parse(wikiResult.content[0].text);
            console.log("Wiki Page Title:", wikiData.title);
            console.log("Content Snippet:", wikiData.content.substring(0, 200) + "...");
        }
    }

    await client.close();

    // 3. Search Wiki Content
    console.log("\nSearching Wiki Content for 'Line of Fire'...");
    // Re-connect for cleaner flow or just use existing client before close
    // Re-instantiate client (simplified for this script, just reopen)

    const transport2 = new StdioClientTransport({
        command: "/bin/bash",
        args: ["/home/clindbeck9/infinity-data/run_mcp.sh"]
    });
    const client2 = new Client({ name: "test-client-2", version: "1.0.0" }, { capabilities: {} });
    await client2.connect(transport2);

    const searchWikiResult = await client2.callTool({
        name: "search_wiki",
        arguments: {
            query: "Line of Fire"
        }
    });

    const searchWikiData = JSON.parse(searchWikiResult.content[0].text);
    console.log(`Found ${searchWikiData.count} results.`);
    if (searchWikiData.results.length > 0) {
        console.log("First Result:", searchWikiData.results[0]);
    }

    await client2.close();
    process.exit(0);
}

main().catch(console.error);
