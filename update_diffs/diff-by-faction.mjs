#!/usr/bin/env node
// Generate one report per faction comparing OLD (snapshot) vs NEW (current) processed data,
// with weapon/skill/equipment IDs resolved to names.
//
// Usage: node diff-by-faction.mjs <old-root> <new-root> <out-dir>

import fs from 'node:fs';
import path from 'node:path';

const [, , OLD_ROOT, NEW_ROOT, OUT_DIR] = process.argv;
if (!OLD_ROOT || !NEW_ROOT || !OUT_DIR) {
    console.error('Usage: node diff-by-faction.mjs <old-root> <new-root> <out-dir>');
    process.exit(1);
}

function resolveProcDir(root) {
    if (fs.existsSync(path.join(root, 'data/processed'))) return path.join(root, 'data/processed');
    if (fs.existsSync(path.join(root, 'processed'))) return path.join(root, 'processed');
    return root;
}

const oldProc = resolveProcDir(OLD_ROOT);
const newProc = resolveProcDir(NEW_ROOT);

function load(p) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return null; }
}

// Build name lookups from the NEW metadata (preferred) with OLD as fallback.
const newMeta = load(path.join(newProc, 'metadata.json')) || {};
const oldMeta = load(path.join(oldProc, 'metadata.json')) || {};

function buildLookup(cat) {
    const m = new Map();
    for (const x of (oldMeta[cat] || [])) m.set(x.id, x.name);
    for (const x of (newMeta[cat] || [])) m.set(x.id, x.name); // new overrides
    return m;
}
const weaponNames = buildLookup('weapons');
const skillNames = buildLookup('skills');
const equipNames = buildLookup('equipment');
const ammoNames = buildLookup('ammunitions');

// Walk a unit's profileGroups → profiles + options, collecting mod-aware
// displayNames for skills/weapons/equipment. This captures things like
// "Mimetism(-6)" vs "Mimetism(-3)" and "Thunderbolt(+2B)" vs "Thunderbolt"
// that bare ID arrays (allWeaponIds, allSkillIds) cannot distinguish.
function collectDisplayNames(unit) {
    const skills = new Set();
    const weapons = new Set();
    const equipment = new Set();
    for (const pg of (unit.profileGroups || [])) {
        for (const p of (pg.profiles || [])) {
            for (const s of (p.skills || [])) skills.add(s.displayName);
            for (const w of (p.weapons || [])) weapons.add(w.displayName);
            for (const e of (p.equipment || [])) equipment.add(e.displayName);
        }
        for (const o of (pg.options || [])) {
            for (const s of (o.skills || [])) skills.add(s.displayName);
            for (const w of (o.weapons || [])) weapons.add(w.displayName);
            for (const e of (o.equipment || [])) equipment.add(e.displayName);
        }
    }
    return { skills, weapons, equipment };
}

function diffSets(oldSet, newSet) {
    const added = [...newSet].filter(x => !oldSet.has(x)).sort();
    const removed = [...oldSet].filter(x => !newSet.has(x)).sort();
    return { added, removed };
}

function pointsStr(r) {
    if (!r) return '?';
    if (Array.isArray(r)) return r[0] === r[1] ? String(r[0]) : `${r[0]}-${r[1]}`;
    return String(r);
}

function listFactionFiles(dir) {
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .filter(f => !['metadata.json', 'factions.json'].includes(f));
}

// Universal mercenaries appear in every faction file with `factionIds: []`
// even though the faction can't actually field them. Filter them out so each
// faction's diff only contains units that genuinely belong to that faction.
function isUniversalMerc(unit) {
    return !unit.factionIds || unit.factionIds.length === 0;
}

const oldFiles = new Set(listFactionFiles(oldProc));
const newFiles = new Set(listFactionFiles(newProc));
const allFiles = new Set([...oldFiles, ...newFiles]);

fs.mkdirSync(OUT_DIR, { recursive: true });

// Detect IDs that appear in unit data but not in either old or new metadata.
// These are new game elements that the refresh script didn't pull because
// scripts/refresh_data.ts only fetches per-faction data, not the global
// weapon/skill/equipment catalog (data/metadata.json).
const unresolvedW = new Set(), unresolvedS = new Set(), unresolvedE = new Set();

const indexLines = ['# Per-Faction Change Report', '',
    `Old: ${OLD_ROOT}`, `New: ${NEW_ROOT}`, `Generated: ${new Date().toISOString()}`, '',
    '| Faction | Added | Removed | Modified | Old→New units |',
    '|---|---:|---:|---:|---|'];

let grandAdd = 0, grandRem = 0, grandMod = 0;

for (const file of [...allFiles].sort()) {
    const slug = file.replace(/\.json$/, '');
    const o = oldFiles.has(file) ? load(path.join(oldProc, file)) : null;
    const n = newFiles.has(file) ? load(path.join(newProc, file)) : null;

    const oUnits = (o?.units || []).filter(u => !isUniversalMerc(u));
    const nUnits = (n?.units || []).filter(u => !isUniversalMerc(u));
    const oMap = new Map(oUnits.map(u => [u.id, u]));
    const nMap = new Map(nUnits.map(u => [u.id, u]));

    const added = [...nMap.keys()].filter(id => !oMap.has(id));
    const removed = [...oMap.keys()].filter(id => !nMap.has(id));
    const modified = [];

    for (const id of nMap.keys()) {
        if (!oMap.has(id)) continue;
        const ou = oMap.get(id);
        const nu = nMap.get(id);

        const oNames = collectDisplayNames(ou);
        const nNames = collectDisplayNames(nu);
        const weaponDiff = diffSets(oNames.weapons, nNames.weapons);
        const skillDiff = diffSets(oNames.skills, nNames.skills);
        const equipDiff = diffSets(oNames.equipment, nNames.equipment);

        for (const id of (nu.allWeaponIds || [])) if (id != null && !weaponNames.has(id)) unresolvedW.add(id);
        for (const id of (nu.allSkillIds || [])) if (id != null && !skillNames.has(id)) unresolvedS.add(id);
        for (const id of (nu.allEquipmentIds || [])) if (id != null && !equipNames.has(id)) unresolvedE.add(id);

        const pointsChanged = JSON.stringify(ou.pointsRange) !== JSON.stringify(nu.pointsRange);
        const pgChanged = (ou.profileGroups?.length || 0) !== (nu.profileGroups?.length || 0);

        if (weaponDiff.added.length || weaponDiff.removed.length ||
            skillDiff.added.length || skillDiff.removed.length ||
            equipDiff.added.length || equipDiff.removed.length ||
            pointsChanged || pgChanged) {
            modified.push({ id, isc: nu.isc, name: nu.name, weaponDiff, skillDiff, equipDiff,
                points: pointsChanged ? { old: pointsStr(ou.pointsRange), new: pointsStr(nu.pointsRange) } : null,
                profileGroups: pgChanged ? { old: ou.profileGroups?.length || 0, new: nu.profileGroups?.length || 0 } : null });
        }
    }

    grandAdd += added.length; grandRem += removed.length; grandMod += modified.length;
    indexLines.push(`| ${slug} | ${added.length} | ${removed.length} | ${modified.length} | ${oUnits.length} → ${nUnits.length} |`);

    if (!added.length && !removed.length && !modified.length) continue;

    const lines = [];
    lines.push(`# ${slug}`);
    lines.push('');
    lines.push(`Units: ${oUnits.length} → ${nUnits.length}`);
    lines.push(`Added: ${added.length} · Removed: ${removed.length} · Modified: ${modified.length}`);
    lines.push('');

    if (added.length) {
        lines.push('## Added units');
        for (const id of added) {
            const u = nMap.get(id);
            lines.push(`- **[${id}] ${u.isc}** / ${u.name} — ${pointsStr(u.pointsRange)} pts`);
        }
        lines.push('');
    }
    if (removed.length) {
        lines.push('## Removed units');
        for (const id of removed) {
            const u = oMap.get(id);
            lines.push(`- **[${id}] ${u.isc}** / ${u.name} — was ${pointsStr(u.pointsRange)} pts`);
        }
        lines.push('');
    }
    if (modified.length) {
        lines.push('## Modified units');
        for (const m of modified) {
            lines.push(`### [${m.id}] ${m.isc} / ${m.name}`);
            if (m.points) lines.push(`- **Points:** ${m.points.old} → ${m.points.new}`);
            if (m.profileGroups) lines.push(`- **Profile groups:** ${m.profileGroups.old} → ${m.profileGroups.new}`);
            if (m.weaponDiff.added.length) lines.push(`- **Weapons added:** ${m.weaponDiff.added.join(', ')}`);
            if (m.weaponDiff.removed.length) lines.push(`- **Weapons removed:** ${m.weaponDiff.removed.join(', ')}`);
            if (m.skillDiff.added.length) lines.push(`- **Skills added:** ${m.skillDiff.added.join(', ')}`);
            if (m.skillDiff.removed.length) lines.push(`- **Skills removed:** ${m.skillDiff.removed.join(', ')}`);
            if (m.equipDiff.added.length) lines.push(`- **Equipment added:** ${m.equipDiff.added.join(', ')}`);
            if (m.equipDiff.removed.length) lines.push(`- **Equipment removed:** ${m.equipDiff.removed.join(', ')}`);
            lines.push('');
        }
    }

    fs.writeFileSync(path.join(OUT_DIR, `${slug}.md`), lines.join('\n'));
}

indexLines.push('');
indexLines.push(`**Totals:** added=${grandAdd}, removed=${grandRem}, modified=${grandMod}`);
indexLines.push('');
indexLines.push('## Unresolved IDs');
indexLines.push('');
indexLines.push('These IDs appear in unit data but have no entry in either snapshot or current metadata.');
indexLines.push('`scripts/refresh_data.ts` only refreshes per-faction data, not `data/metadata.json`,');
indexLines.push('so newly-added game elements (e.g. "AP Red Fury" weapon, "Dodge (ARM+3)" mod) lack names.');
indexLines.push('');
indexLines.push(`- Weapons: ${[...unresolvedW].sort((a,b)=>a-b).join(', ') || '(none)'}`);
indexLines.push(`- Skills: ${[...unresolvedS].sort((a,b)=>a-b).join(', ') || '(none)'}`);
indexLines.push(`- Equipment: ${[...unresolvedE].sort((a,b)=>a-b).join(', ') || '(none)'}`);
fs.writeFileSync(path.join(OUT_DIR, 'INDEX.md'), indexLines.join('\n'));

console.log(`Wrote per-faction reports to ${OUT_DIR}`);
console.log(`Totals: +${grandAdd} -${grandRem} ~${grandMod}`);
