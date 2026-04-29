import type { RangeBand, ParsedWeapon, DatabaseMetadata } from './types';

// Standard range bands in inches
export const RANGE_BANDS = [
    { start: 0, end: 8, label: '0-8"' },
    { start: 8, end: 16, label: '8-16"' },
    { start: 16, end: 24, label: '16-24"' },
    { start: 24, end: 32, label: '24-32"' },
    { start: 32, end: 40, label: '32-40"' },
    { start: 40, end: 48, label: '40-48"' },
    { start: 48, end: 96, label: '48-96"' },
];

/**
 * Parses a raw weapon from metadata.json into a rich ParsedWeapon object.
 * Logic extracted from RangesPage.tsx for reuse in MCP/Agents.
 */
export function parseWeapon(rawWeapon: DatabaseMetadata['weapons'][number], ammunitions: DatabaseMetadata['ammunitions']): ParsedWeapon | null {
    const bands: RangeBand[] = [];
    let templateType: 'small' | 'large' | 'none' = 'none';

    // 1. Detect Template Type
    if (rawWeapon.properties?.some((p: string) => p.includes('Direct Template'))) {
        if (rawWeapon.properties.some((p: string) => p.includes('Small Teardrop'))) {
            templateType = 'small';
        } else if (rawWeapon.properties.some((p: string) => p.includes('Large Teardrop'))) {
            templateType = 'large';
        }
    }

    // 2. Calculate Range Bands
    if (rawWeapon.distance) {
        const parts = Object.entries(rawWeapon.distance)
            .filter(([, val]) => val !== null)
            .map(([, val]) => ({
                max: Math.round(val.max * 0.4), // Convert CM to Inches (approx)
                mod: parseInt(val.mod)
            }))
            .sort((a, b) => a.max - b.max);

        let currentStart = 0;
        for (const part of parts) {
            if (part.max > currentStart) {
                bands.push({ start: currentStart, end: part.max, mod: part.mod });
                currentStart = part.max;
            }
        }
    }

    // 3. Resolve Ammo Name
    let ammoName = '-';
    if (rawWeapon.ammunition) {
        const ammo = ammunitions.find(a => a.id === rawWeapon.ammunition);
        ammoName = ammo ? ammo.name : rawWeapon.ammunition.toString();
    }

    // Filter out items that are not weapons (invalid range and no template)
    if (bands.length === 0 && templateType === 'none') {
        // Some "Weapons" in metadata might be weird entries, but usually if they lack distance AND template, they aren't useful for profile analysis
        // However, some melee weapons might lack distance but have property 'CC'??
        // Code from RangesPage excluded them: `if (bands.length === 0 && templateType === 'none') return;`
        // Let's stick to that logic for now, but be careful with CC weapons.
        // Wait, CC weapons have 'distance: null' in metadata ex. ID 78 AP+DA CC Weapon
        // But the RangesPage logic would exclude them!
        // Let's look at `RangesPage.tsx` again.
        // It says: `if (bands.length === 0 && templateType === 'none') { return; }`
        // So the Ranges Page DOES NOT show CC weapons in the chart.
        // BUT for the agent/profile view, we DO want to see CC weapons.

        // Let's modify the logic slightly: if it has 'CC' property, keep it.
        const isCC = rawWeapon.properties?.includes('CC');
        if (!isCC) {
            return null;
        }
    }

    return {
        id: rawWeapon.id,
        name: rawWeapon.name,
        bands,
        burst: rawWeapon.burst || '-',
        damage: rawWeapon.damage || '-',
        saving: rawWeapon.saving || '-',
        savingNum: rawWeapon.savingNum || '-',
        ammunition: ammoName,
        properties: rawWeapon.properties || [],
        templateType
    };
}
