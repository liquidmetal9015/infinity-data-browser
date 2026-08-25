#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const SNAP = process.argv[2];
const NEW = process.argv[3];
const MODE = process.argv[4] || 'raw'; // raw | processed

function listFactionFiles(dir) {
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .filter(f => !['metadata.json', 'classifieds.json', 'factions.json'].includes(f));
}

function load(p) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return null; }
}

function unitSummary(u, mode) {
    // Return a comparable signature for a unit
    if (mode === 'raw') {
        // raw: options have points
        const optPts = (u.options || []).map(o => `${o.id ?? o.code ?? '?'}:${o.points ?? '?'}`);
        const pgCount = (u.profileGroups || []).length;
        return {
            isc: u.isc,
            name: u.name,
            optionCount: (u.options || []).length,
            profileGroups: pgCount,
            optPts: optPts.sort(),
        };
    } else {
        return {
            isc: u.isc,
            name: u.name,
            pointsRange: u.pointsRange,
            profileGroups: (u.profileGroups || []).length,
            skills: (u.allSkillIds || []).slice().sort().join(','),
            equipment: (u.allEquipmentIds || []).slice().sort().join(','),
            weapons: (u.allWeaponIds || []).slice().sort().join(','),
        };
    }
}

function diffUnit(oldU, newU, mode) {
    const o = unitSummary(oldU, mode);
    const n = unitSummary(newU, mode);
    const changes = [];
    for (const k of Object.keys(n)) {
        const ov = Array.isArray(o[k]) ? JSON.stringify(o[k]) : String(o[k]);
        const nv = Array.isArray(n[k]) ? JSON.stringify(n[k]) : String(n[k]);
        if (ov !== nv) changes.push(`${k}: ${ov} -> ${nv}`);
    }
    return changes;
}

const oldDir = MODE === 'processed' ? path.join(SNAP, 'data/processed') : path.join(SNAP, 'data');
const newDir = MODE === 'processed' ? path.join(NEW, 'data/processed') : path.join(NEW, 'data');

const oldFiles = new Set(listFactionFiles(oldDir));
const newFiles = new Set(listFactionFiles(newDir));

const addedFiles = [...newFiles].filter(f => !oldFiles.has(f));
const removedFiles = [...oldFiles].filter(f => !newFiles.has(f));
const commonFiles = [...newFiles].filter(f => oldFiles.has(f)).sort();

console.log(`=== ${MODE.toUpperCase()} DIFF ===`);
console.log(`Files: old=${oldFiles.size}, new=${newFiles.size}, added=${addedFiles.length}, removed=${removedFiles.length}`);
if (addedFiles.length) console.log(`  + added: ${addedFiles.join(', ')}`);
if (removedFiles.length) console.log(`  - removed: ${removedFiles.join(', ')}`);
console.log();

let totalAdded = 0, totalRemoved = 0, totalModified = 0;
const perFaction = [];

for (const f of commonFiles) {
    const o = load(path.join(oldDir, f));
    const n = load(path.join(newDir, f));
    if (!o || !n) continue;
    const oUnits = o.units || [];
    const nUnits = n.units || [];
    const oMap = new Map(oUnits.map(u => [u.id, u]));
    const nMap = new Map(nUnits.map(u => [u.id, u]));

    const added = [...nMap.keys()].filter(id => !oMap.has(id));
    const removed = [...oMap.keys()].filter(id => !nMap.has(id));
    const modified = [];
    for (const id of nMap.keys()) {
        if (!oMap.has(id)) continue;
        const changes = diffUnit(oMap.get(id), nMap.get(id), MODE);
        if (changes.length) modified.push({ id, isc: nMap.get(id).isc, name: nMap.get(id).name, changes });
    }

    const versionChanged = o.version !== n.version ? ` v:${o.version} -> ${n.version}` : '';

    if (added.length || removed.length || modified.length || versionChanged) {
        perFaction.push({
            file: f, versionChanged,
            added: added.map(id => ({ id, isc: nMap.get(id).isc, name: nMap.get(id).name })),
            removed: removed.map(id => ({ id, isc: oMap.get(id).isc, name: oMap.get(id).name })),
            modified,
            oldCount: oUnits.length, newCount: nUnits.length,
        });
        totalAdded += added.length;
        totalRemoved += removed.length;
        totalModified += modified.length;
    }
}

console.log(`TOTALS — added units: ${totalAdded}, removed units: ${totalRemoved}, modified units: ${totalModified}`);
console.log(`Factions with changes: ${perFaction.length}`);
console.log();

for (const p of perFaction) {
    console.log(`-- ${p.file} (${p.oldCount} -> ${p.newCount} units)${p.versionChanged}`);
    for (const u of p.added) console.log(`   + ADD  [${u.id}] ${u.isc} / ${u.name}`);
    for (const u of p.removed) console.log(`   - DEL  [${u.id}] ${u.isc} / ${u.name}`);
    for (const u of p.modified) {
        console.log(`   ~ MOD  [${u.id}] ${u.isc} / ${u.name}`);
        for (const c of u.changes) console.log(`         · ${c}`);
    }
}
