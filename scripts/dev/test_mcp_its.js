import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
    console.log("Starting MCP ITS Rules Test...");

    const transport = new StdioClientTransport({
        command: "/bin/bash",
        args: ["/home/clindbeck9/infinity-data/run_mcp.sh"]
    });

    const client = new Client({
        name: "test-client-its",
        version: "1.0.0"
    }, {
        capabilities: {}
    });

    await client.connect(transport);
    console.log("Connected to MCP Server");

    // 1. Read Section
    console.log("\nReading 'TOURNAMENT RULES' section...");
    const readResult = await client.callTool({
        name: "read_its_rules",
        arguments: {
            section: "TOURNAMENT RULES"
        }
    });
    console.log("Result:", readResult.content[0].text.substring(0, 500));

    // 2. Search Rules
    console.log("\nSearching for 'Reinforcements'...");
    const searchResult = await client.callTool({
        name: "search_its_rules",
        arguments: {
            query: "Reinforcements"
        }
    });
    console.log("Result:", searchResult.content[0].text);

    await client.close();
}

main().catch(console.error);
