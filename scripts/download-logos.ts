/**
 * Script to download faction logos from Corvus Belli servers
 * and save them locally to avoid external requests at runtime.
 * 
 * Usage: npx tsx scripts/download-logos.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const METADATA_PATH = path.join(__dirname, '../data/metadata.json');
const OUTPUT_DIR = path.join(__dirname, '../public/logos/factions');

interface Faction {
    id: number;
    name: string;
    slug: string;
    logo: string;
}

interface Metadata {
    factions: Faction[];
}

function downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);

        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Follow redirect
                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                    file.close();
                    fs.unlinkSync(destPath);
                    downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
                    return;
                }
            }

            if (response.statusCode !== 200) {
                file.close();
                fs.unlinkSync(destPath);
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            file.close();
            fs.unlinkSync(destPath);
            reject(err);
        });
    });
}

async function main() {
    console.log('🎨 Downloading faction logos...\n');

    // Read metadata
    const metadataRaw = fs.readFileSync(METADATA_PATH, 'utf-8');
    const metadata: Metadata = JSON.parse(metadataRaw);

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`📁 Created directory: ${OUTPUT_DIR}\n`);
    }

    // Track unique logos (some factions may share logos)
    const downloadedUrls = new Set<string>();
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const faction of metadata.factions) {
        const logoUrl = faction.logo;

        if (!logoUrl || !logoUrl.startsWith('http')) {
            console.log(`⏭️  Skipping ${faction.name}: No valid logo URL`);
            skipCount++;
            continue;
        }

        if (downloadedUrls.has(logoUrl)) {
            console.log(`⏭️  Skipping ${faction.name}: Already downloaded`);
            skipCount++;
            continue;
        }

        // Extract filename from URL
        const filename = `${faction.slug}.svg`;
        const destPath = path.join(OUTPUT_DIR, filename);

        // Check if already exists
        if (fs.existsSync(destPath)) {
            console.log(`✓  ${faction.name}: Already exists locally`);
            downloadedUrls.add(logoUrl);
            skipCount++;
            continue;
        }

        try {
            process.stdout.write(`⬇️  Downloading ${faction.name}...`);
            await downloadFile(logoUrl, destPath);
            downloadedUrls.add(logoUrl);
            console.log(' ✓');
            successCount++;

            // Be polite to the server
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.log(` ✗ ${error}`);
            failCount++;
        }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✓ Downloaded: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ✗ Failed: ${failCount}`);
    console.log(`\n📁 Logos saved to: ${OUTPUT_DIR}`);

    // Generate a mapping file for easy reference
    const mapping: Record<string, string> = {};
    for (const faction of metadata.factions) {
        if (faction.logo && faction.logo.startsWith('http')) {
            mapping[faction.slug] = `/logos/factions/${faction.slug}.svg`;
        }
    }

    const mappingPath = path.join(OUTPUT_DIR, 'mapping.json');
    fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
    console.log(`📄 Mapping file saved to: ${mappingPath}`);
}

main().catch(console.error);
