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

// Rebuild weapons/skills/equips/ammunitions catalogs in data/metadata.json by
// merging entries from each faction's filters block. The CB API does not expose
// a public metadata endpoint (all candidate routes return 403), but every
// per-faction response ships a `filters` dictionary with names for every ID it
// references. Existing richer entries (with stats) are preserved; new IDs get a
// minimal entry so the ETL can still resolve them.
async function rebuildMetadataCatalogs(factions: FactionMetadata[]): Promise<void> {
    console.log('Rebuilding metadata.json weapon/skill/equip/ammo catalogs from faction filters...');
    const metadataStr = await fs.readFile(METADATA_PATH, 'utf-8');
    const metadata = JSON.parse(metadataStr) as Record<string, unknown> & {
        weapons?: Array<{ id: number;[k: string]: unknown }>;
        skills?: Array<{ id: number;[k: string]: unknown }>;
        equips?: Array<{ id: number;[k: string]: unknown }>;
        ammunitions?: Array<{ id: number;[k: string]: unknown }>;
    };

    const catalogs = {
        weapons: new Map<number, Record<string, unknown>>(),
        skills: new Map<number, Record<string, unknown>>(),
        equips: new Map<number, Record<string, unknown>>(),
        ammunitions: new Map<number, Record<string, unknown>>(),
    } as const;

    // Seed from existing metadata (preserves stats like burst/damage/distance).
    for (const w of metadata.weapons ?? []) catalogs.weapons.set(w.id, w);
    for (const s of metadata.skills ?? []) catalogs.skills.set(s.id, s);
    for (const e of metadata.equips ?? []) catalogs.equips.set(e.id, e);
    for (const a of metadata.ammunitions ?? []) catalogs.ammunitions.set(a.id, a);

    const beforeCounts = {
        weapons: catalogs.weapons.size, skills: catalogs.skills.size,
        equips: catalogs.equips.size, ammunitions: catalogs.ammunitions.size,
    };

    interface FactionFilters {
        weapons?: Array<{ id: number; name: string; type?: string }>;
        skills?: Array<{ id: number; name: string; wiki?: string }>;
        equip?: Array<{ id: number; name: string; type?: string; wiki?: string }>;
        ammunition?: Array<{ id: number; name: string; wiki?: string }>;
    }

    for (const faction of factions) {
        const filePath = path.join(DATA_DIR, `${faction.slug}.json`);
        let raw: string;
        try { raw = await fs.readFile(filePath, 'utf-8'); } catch { continue; }
        const data = JSON.parse(raw) as { filters?: FactionFilters };
        const f = data.filters;
        if (!f) continue;
        for (const w of f.weapons ?? []) if (!catalogs.weapons.has(w.id)) catalogs.weapons.set(w.id, { ...w });
        for (const s of f.skills ?? []) if (!catalogs.skills.has(s.id)) catalogs.skills.set(s.id, { ...s });
        for (const e of f.equip ?? []) if (!catalogs.equips.has(e.id)) catalogs.equips.set(e.id, { ...e });
        for (const a of f.ammunition ?? []) if (!catalogs.ammunitions.has(a.id)) catalogs.ammunitions.set(a.id, { ...a });
    }

    metadata.weapons = [...catalogs.weapons.values()].sort((a, b) => (a.id as number) - (b.id as number));
    metadata.skills = [...catalogs.skills.values()].sort((a, b) => (a.id as number) - (b.id as number));
    metadata.equips = [...catalogs.equips.values()].sort((a, b) => (a.id as number) - (b.id as number));
    metadata.ammunitions = [...catalogs.ammunitions.values()].sort((a, b) => (a.id as number) - (b.id as number));

    await fs.writeFile(METADATA_PATH, JSON.stringify(metadata, null, 4));

    const added = {
        weapons: catalogs.weapons.size - beforeCounts.weapons,
        skills: catalogs.skills.size - beforeCounts.skills,
        equips: catalogs.equips.size - beforeCounts.equips,
        ammunitions: catalogs.ammunitions.size - beforeCounts.ammunitions,
    };
    console.log(`  weapons: ${beforeCounts.weapons} -> ${catalogs.weapons.size} (+${added.weapons})`);
    console.log(`  skills: ${beforeCounts.skills} -> ${catalogs.skills.size} (+${added.skills})`);
    console.log(`  equips: ${beforeCounts.equips} -> ${catalogs.equips.size} (+${added.equips})`);
    console.log(`  ammunitions: ${beforeCounts.ammunitions} -> ${catalogs.ammunitions.size} (+${added.ammunitions})`);
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

        // 3. Rebuild metadata catalogs from union of per-faction filters
        await rebuildMetadataCatalogs(factions);
    } catch (err) {
        console.error("Fatal error:", err);
        process.exit(1);
    }
}

main().catch(console.error);
