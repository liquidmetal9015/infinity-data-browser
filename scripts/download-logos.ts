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
const PROCESSED_DATA_DIR = path.join(DATA_DIR, 'processed');
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

function downloadFile(url: string, destPath: string, retries = 3): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'image/svg+xml,image/*,*/*',
            },
        };

        const req = https.get(url, options, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                    file.close();
                    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
                    downloadFile(redirectUrl, destPath, retries).then(resolve).catch(reject);
                    return;
                }
            }

            if (response.statusCode !== 200) {
                file.close();
                if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
                if (retries > 0) {
                    setTimeout(() => {
                        downloadFile(url, destPath, retries - 1).then(resolve).catch(reject);
                    }, 500);
                } else {
                    reject(new Error(`Failed ${url}: HTTP ${response.statusCode}`));
                }
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve();
            });
        });

        req.on('error', (err) => {
            file.close();
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            if (retries > 0) {
                setTimeout(() => {
                    downloadFile(url, destPath, retries - 1).then(resolve).catch(reject);
                }, 500);
            } else {
                reject(err);
            }
        });
    });
}

function extractLogosFromJson(obj: unknown, unitLogos: Set<string>, factionLogos: Set<string>) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
        for (const item of obj) {
            extractLogosFromJson(item, unitLogos, factionLogos);
        }
        return;
    }
    const record = obj as Record<string, unknown>;
    if (typeof record.logo === 'string' && record.logo.startsWith('http')) {
        const url = record.logo.trim();
        if (url.includes('/factions/') || url.includes('logo/factions/')) {
            factionLogos.add(url);
        } else {
            unitLogos.add(url);
        }
    }
    for (const key in record) {
        extractLogosFromJson(record[key], unitLogos, factionLogos);
    }
}

async function runPool<T>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<void>): Promise<void> {
    let index = 0;
    const workers = Array.from({ length: concurrency }, async () => {
        while (index < items.length) {
            const currentIdx = index++;
            await fn(items[currentIdx], currentIdx);
        }
    });
    await Promise.all(workers);
}

async function main() {
    console.log('🎨 Downloading faction and unit logos...\n');

    for (const dir of [FACTION_LOGOS_DIR, UNIT_LOGOS_DIR]) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
        }
    }

    const unitLogos = new Set<string>();
    const factionLogos = new Set<string>();

    // 1. Collect from metadata.json
    if (fs.existsSync(METADATA_PATH)) {
        try {
            const metadata: Metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
            for (const f of metadata.factions || []) {
                if (f.logo && f.logo.startsWith('http')) {
                    factionLogos.add(f.logo.trim());
                }
            }
        } catch (e) {
            console.error('Error reading metadata.json:', e);
        }
    }

    // 2. Collect from data/ and data/processed/
    const dataDirs = [DATA_DIR, PROCESSED_DATA_DIR];
    for (const dir of dataDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'metadata.json');
        for (const file of files) {
            const filePath = path.join(dir, file);
            try {
                const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                extractLogosFromJson(parsed, unitLogos, factionLogos);
            } catch {
                console.error(`Error parsing ${filePath}`);
            }
        }
    }

    console.log(`Discovered ${factionLogos.size} faction logos and ${unitLogos.size} unit logos.\n`);

    // 3. Download Faction Logos
    console.log('--- Faction Logos ---');
    let factionDownloaded = 0;
    let factionSkipped = 0;
    let factionFailed = 0;
    const factionMapping: Record<string, string> = {};

    // Load existing mapping if present
    const factionMappingPath = path.join(FACTION_LOGOS_DIR, 'mapping.json');
    if (fs.existsSync(factionMappingPath)) {
        try {
            Object.assign(factionMapping, JSON.parse(fs.readFileSync(factionMappingPath, 'utf-8')));
        } catch {
            // ignore
        }
    }

    for (const logoUrl of Array.from(factionLogos)) {
        const filename = logoUrl.split('/').pop() || 'unknown.svg';
        const destPath = path.join(FACTION_LOGOS_DIR, filename);
        factionMapping[logoUrl] = `/logos/factions/${filename}`;

        if (fs.existsSync(destPath)) {
            factionSkipped++;
            continue;
        }

        try {
            process.stdout.write(`⬇️  Downloading faction logo ${filename}...`);
            await downloadFile(logoUrl, destPath);
            console.log(' ✓');
            factionDownloaded++;
        } catch (err) {
            console.log(` ✗ ${err}`);
            factionFailed++;
        }
    }

    fs.writeFileSync(factionMappingPath, JSON.stringify(factionMapping, null, 2));
    console.log(`Faction logos: ${factionDownloaded} downloaded, ${factionSkipped} skipped, ${factionFailed} failed.\n`);

    // 4. Download Unit Logos
    console.log('--- Unit Logos ---');
    let unitDownloaded = 0;
    let unitSkipped = 0;
    let unitFailed = 0;
    const unitMapping: Record<string, string> = {};

    const unitMappingPath = path.join(UNIT_LOGOS_DIR, 'mapping.json');
    if (fs.existsSync(unitMappingPath)) {
        try {
            Object.assign(unitMapping, JSON.parse(fs.readFileSync(unitMappingPath, 'utf-8')));
        } catch {
            // ignore
        }
    }

    const unitUrls = Array.from(unitLogos);
    const missingUnitUrls = unitUrls.filter(url => {
        const filename = url.split('/').pop() || 'unknown.svg';
        unitMapping[url] = `/logos/units/${filename}`;
        return !fs.existsSync(path.join(UNIT_LOGOS_DIR, filename));
    });

    unitSkipped = unitUrls.length - missingUnitUrls.length;
    console.log(`Unit logos: ${missingUnitUrls.length} to download, ${unitSkipped} already present.`);

    if (missingUnitUrls.length > 0) {
        console.log(`Downloading ${missingUnitUrls.length} missing unit logos with concurrency 6...`);
        let completed = 0;

        await runPool(missingUnitUrls, 6, async (url) => {
            const filename = url.split('/').pop() || 'unknown.svg';
            const destPath = path.join(UNIT_LOGOS_DIR, filename);

            try {
                await downloadFile(url, destPath);
                unitDownloaded++;
            } catch (err) {
                console.error(` ✗ Error downloading ${filename}:`, err);
                unitFailed++;
            } finally {
                completed++;
                if (completed % 15 === 0 || completed === missingUnitUrls.length) {
                    process.stdout.write(` Progress: ${completed}/${missingUnitUrls.length} (${Math.round((completed / missingUnitUrls.length) * 100)}%)\n`);
                }
            }
        });
    }

    fs.writeFileSync(unitMappingPath, JSON.stringify(unitMapping, null, 2));
    console.log(`\n📄 Unit mapping file saved to: ${unitMappingPath}`);

    console.log('\n📊 Summary:');
    console.log(`   ✓ Factions: ${factionDownloaded} downloaded, ${factionSkipped} skipped, ${factionFailed} failed`);
    console.log(`   ✓ Units:    ${unitDownloaded} downloaded, ${unitSkipped} skipped, ${unitFailed} failed`);
}

main().catch(console.error);
