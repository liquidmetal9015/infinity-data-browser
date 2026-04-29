/**
 * Script to download faction and unit logos from Corvus Belli servers
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

const DATA_DIR = path.join(__dirname, '../data');
const METADATA_PATH = path.join(DATA_DIR, 'metadata.json');
const FACTION_LOGOS_DIR = path.join(__dirname, '../public/logos/factions');
const UNIT_LOGOS_DIR = path.join(__dirname, '../public/logos/units');

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

function extractLogosFromJson(obj: unknown, logos: Set<string>) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
        for (const item of obj) {
            extractLogosFromJson(item, logos);
        }
        return;
    }
    const record = obj as Record<string, unknown>;
    if (typeof record.logo === 'string' && record.logo.endsWith('.svg')) {
        logos.add(record.logo);
    }
    for (const key in record) {
        extractLogosFromJson(record[key], logos);
    }
}

async function main() {
    console.log('🎨 Downloading faction and unit logos...\n');

    // Create output directories
    for (const dir of [FACTION_LOGOS_DIR, UNIT_LOGOS_DIR]) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
        }
    }
    console.log('');

    const downloadedUrls = new Set<string>();
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    // 1. Download Faction Logos
    console.log('--- Faction Logos ---');
    const metadataRaw = fs.readFileSync(METADATA_PATH, 'utf-8');
    const metadata: Metadata = JSON.parse(metadataRaw);

    const factionMapping: Record<string, string> = {};

    for (const faction of metadata.factions) {
        const logoUrl = faction.logo;

        if (!logoUrl || !logoUrl.startsWith('http')) {
            console.log(`⏭️  Skipping ${faction.name}: No valid logo URL`);
            skipCount++;
            continue;
        }

        const filename = `${faction.slug}.svg`;
        const destPath = path.join(FACTION_LOGOS_DIR, filename);
        factionMapping[faction.slug] = `/logos/factions/${filename}`;

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
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
            console.log(` ✗ ${error}`);
            failCount++;
        }
    }

    const factionMappingPath = path.join(FACTION_LOGOS_DIR, 'mapping.json');
    fs.writeFileSync(factionMappingPath, JSON.stringify(factionMapping, null, 2));
    console.log(`📄 Faction mapping file saved to: ${factionMappingPath}\n`);

    // 2. Download Unit Logos
    console.log('--- Unit Logos ---');
    const unitLogos = new Set<string>();
    const dataFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'metadata.json');

    for (const file of dataFiles) {
        const filePath = path.join(DATA_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        try {
            const parsed = JSON.parse(content);
            extractLogosFromJson(parsed, unitLogos);
        } catch {
            console.error(`Error parsing ${file}`);
        }
    }

    console.log(`Found ${unitLogos.size} unique unit logos across all data files.`);

    const unitMapping: Record<string, string> = {};

    let i = 0;
    for (const logoUrl of Array.from(unitLogos)) {
        i++;
        if (!logoUrl.startsWith('http')) continue;

        const filename = logoUrl.split('/').pop() || 'unknown.svg';
        const destPath = path.join(UNIT_LOGOS_DIR, filename);
        unitMapping[logoUrl] = `/logos/units/${filename}`;

        if (fs.existsSync(destPath)) {
            if (i % 50 === 0) console.log(`✓  Skipped existing: ${i}/${unitLogos.size}`);
            downloadedUrls.add(logoUrl);
            skipCount++;
            continue;
        }

        try {
            if (i % 10 === 0) process.stdout.write(`⬇️  Downloading ${filename} (${i}/${unitLogos.size})...`);
            await downloadFile(logoUrl, destPath);
            downloadedUrls.add(logoUrl);
            if (i % 10 === 0) console.log(' ✓');
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 10)); // small delay to not hammer server
        } catch (error) {
            if (i % 10 === 0) console.log(` ✗ ${error}`);
            failCount++;
        }
    }

    const unitMappingPath = path.join(UNIT_LOGOS_DIR, 'mapping.json');
    fs.writeFileSync(unitMappingPath, JSON.stringify(unitMapping, null, 2));
    console.log(`\n📄 Unit mapping file saved to: ${unitMappingPath}`);

    console.log('\n📊 Summary:');
    console.log(`   ✓ Downloaded: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ✗ Failed: ${failCount}`);
}

main().catch(console.error);
