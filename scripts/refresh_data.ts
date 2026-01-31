import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const METADATA_PATH = path.join(DATA_DIR, 'metadata.json');
// Verified endpoint from example_code/search_api.md
const BASE_URL = "https://api.corvusbelli.com/army/units/en";

interface FactionMetadata {
    id: number;
    parent: number;
    name: string;
    slug: string;
    discontinued: boolean;
    logo: string;
}

interface Metadata {
    factions: FactionMetadata[];
}

async function fetchFactionData(faction: FactionMetadata): Promise<boolean> {
    const url = `${BASE_URL}/${faction.id}`; // using ID as per docs
    console.log(`[${faction.id}] Fetching ${faction.name} from ${url}...`);

    try {
        const response = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Referer": "https://infinityuniverse.com/",
                "Origin": "https://infinityuniverse.com"
            }
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`  -> ERROR ${response.status}: ${response.statusText}`);
            if (response.status === 403 || response.status === 404) {
                console.error(`  -> Response body preview: ${text.substring(0, 200)}`);
            }
            return false;
        }

        const data = await response.json();

        // Save to file
        const filePath = path.join(DATA_DIR, `${faction.slug}.json`);
        await fs.writeFile(filePath, JSON.stringify(data, null, 4));
        console.log(`  -> Saved to ${filePath}`);

        return true;

    } catch (error) {
        console.error(`  -> EXCEPTION: ${error}`);
        return false;
    }
}

async function main() {
    console.log("Starting data refresh...");

    try {
        // 1. Read metadata
        console.log(`Reading metadata from ${METADATA_PATH}`);
        const metadataStr = await fs.readFile(METADATA_PATH, "utf-8");
        const metadata: Metadata = JSON.parse(metadataStr);

        if (!metadata.factions || !Array.isArray(metadata.factions)) {
            throw new Error("Invalid metadata format: 'factions' array missing.");
        }

        const factions = metadata.factions;
        console.log(`Found ${factions.length} factions definitions.`);

        let successCount = 0;
        let failCount = 0;

        // 2. Iterate and fetch
        for (const faction of factions) {
            const success = await fetchFactionData(faction);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }

            // Be polite to the server
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log('-----------------------------------');
        console.log(`Finished. Success: ${successCount}, Failed: ${failCount}`);
    } catch (err) {
        console.error("Fatal error:", err);
        process.exit(1);
    }
}

main().catch(console.error);
