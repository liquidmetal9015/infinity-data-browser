#!/usr/bin/env node
// Profile-level diff. Walks each unit's profileGroups → profiles and options,
// comparing skill/weapon/equipment lists by their mod-aware `displayName`
// (e.g. "Mimetism(-6)" vs "Mimetism(-3)", "Thunderbolt(+2B)" vs "Thunderbolt").
// Also diffs stat changes per profile.
//
// Usage: node diff-by-profile.mjs <old-root> <new-root> <out-dir>

import fs from 'node:fs';
import path from 'node:path';

const [, , OLD_ROOT, NEW_ROOT, OUT_DIR] = process.argv;
if (!OLD_ROOT || !NEW_ROOT || !OUT_DIR) {
    console.error('Usage: node diff-by-profile.mjs <old-root> <new-root> <out-dir>');
    process.exit(1);
}

const oldProc = path.join(OLD_ROOT, 'data/processed');
const newProc = path.join(NEW_ROOT, 'data/processed');

function load(p) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return null; }
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

// Compare two arrays of objects by their displayName field (set semantics).
function diffByDisplay(oldArr, newArr) {
    const oldSet = new Set((oldArr || []).map(x => x.displayName));
    const newSet = new Set((newArr || []).map(x => x.displayName));
    const added = [...newSet].filter(x => !oldSet.has(x)).sort();
    const removed = [...oldSet].filter(x => !newSet.has(x)).sort();
    return { added, removed };
}

const STAT_KEYS = ['unitType', 'move', 'cc', 'bs', 'ph', 'wip', 'arm', 'bts', 'w', 's', 'ava'];

function diffStats(oldP, newP) {
    const changes = [];
    for (const k of STAT_KEYS) {
        const o = JSON.stringify(oldP[k]);
        const n = JSON.stringify(newP[k]);
        if (o !== n) changes.push({ key: k, old: oldP[k], new: newP[k] });
    }
    return changes;
}

function fmtVal(v) {
    if (Array.isArray(v)) return `[${v.join(',')}]`;
    return String(v);
}

function diffProfile(oldP, newP) {
    return {
        stats: diffStats(oldP, newP),
        skills: diffByDisplay(oldP.skills, newP.skills),
        weapons: diffByDisplay(oldP.weapons, newP.weapons),
        equipment: diffByDisplay(oldP.equipment, newP.equipment),
    };
}

function hasChanges(d) {
    return d.stats.length > 0
        || d.skills.added.length || d.skills.removed.length
        || d.weapons.added.length || d.weapons.removed.length
        || d.equipment.added.length || d.equipment.removed.length;
}

function diffOption(oldO, newO) {
    const changes = {
        points: oldO.points !== newO.points ? { old: oldO.points, new: newO.points } : null,
        swc: oldO.swc !== newO.swc ? { old: oldO.swc, new: newO.swc } : null,
        skills: diffByDisplay(oldO.skills, newO.skills),
        weapons: diffByDisplay(oldO.weapons, newO.weapons),
        equipment: diffByDisplay(oldO.equipment, newO.equipment),
    };
    return changes;
}

function hasOptionChanges(d) {
    return d.points || d.swc
        || d.skills.added.length || d.skills.removed.length
        || d.weapons.added.length || d.weapons.removed.length
        || d.equipment.added.length || d.equipment.removed.length;
}

// Match profile groups by index (they're typically ordered). Within a group,
// match profiles by id (then fall back to name), options by name (then id).
function matchByKey(arr, keyFn) {
    const m = new Map();
    for (const item of (arr || [])) {
        const k = keyFn(item);
        if (k != null && !m.has(k)) m.set(k, item);
    }
    return m;
}

function diffUnit(oldU, newU) {
    const oldGroups = oldU.profileGroups || [];
    const newGroups = newU.profileGroups || [];
    const groupCount = Math.max(oldGroups.length, newGroups.length);
    const groupDiffs = [];

    for (let i = 0; i < groupCount; i++) {
        const og = oldGroups[i];
        const ng = newGroups[i];
        if (!og && ng) { groupDiffs.push({ index: i, added: true, group: ng }); continue; }
        if (og && !ng) { groupDiffs.push({ index: i, removed: true, group: og }); continue; }

        const oldProfilesByName = matchByKey(og.profiles, p => p.name);
        const newProfilesByName = matchByKey(ng.profiles, p => p.name);
        const allProfileNames = new Set([...oldProfilesByName.keys(), ...newProfilesByName.keys()]);
        const profileChanges = [];
        for (const name of allProfileNames) {
            const op = oldProfilesByName.get(name);
            const np = newProfilesByName.get(name);
            if (!op) { profileChanges.push({ name, added: true, profile: np }); continue; }
            if (!np) { profileChanges.push({ name, removed: true, profile: op }); continue; }
            const d = diffProfile(op, np);
            if (hasChanges(d)) profileChanges.push({ name, modified: true, ...d });
        }

        const oldOptionsByName = matchByKey(og.options, o => o.name);
        const newOptionsByName = matchByKey(ng.options, o => o.name);
        const allOptionNames = new Set([...oldOptionsByName.keys(), ...newOptionsByName.keys()]);
        const optionChanges = [];
        for (const name of allOptionNames) {
            const oo = oldOptionsByName.get(name);
            const no = newOptionsByName.get(name);
            if (!oo) { optionChanges.push({ name, added: true, option: no }); continue; }
            if (!no) { optionChanges.push({ name, removed: true, option: oo }); continue; }
            const d = diffOption(oo, no);
            if (hasOptionChanges(d)) optionChanges.push({ name, modified: true, ...d });
        }

        if (profileChanges.length || optionChanges.length) {
            groupDiffs.push({ index: i, profileChanges, optionChanges });
        }
    }
    return groupDiffs;
}

function renderProfileChange(c, depth = 0) {
    const pad = '  '.repeat(depth);
    const lines = [];
    if (c.added) {
        lines.push(`${pad}- + **Profile added:** ${c.name}`);
        const p = c.profile;
        const stats = STAT_KEYS.filter(k => p[k] !== undefined && p[k] !== null && !(Array.isArray(p[k]) && p[k].length === 0))
            .map(k => `${k}=${fmtVal(p[k])}`).join(', ');
        if (stats) lines.push(`${pad}    · ${stats}`);
        const skills = (p.skills || []).map(s => s.displayName).join(', ');
        const weapons = (p.weapons || []).map(s => s.displayName).join(', ');
        const equip = (p.equipment || []).map(s => s.displayName).join(', ');
        if (skills) lines.push(`${pad}    · skills: ${skills}`);
        if (weapons) lines.push(`${pad}    · weapons: ${weapons}`);
        if (equip) lines.push(`${pad}    · equipment: ${equip}`);
    } else if (c.removed) {
        lines.push(`${pad}- − **Profile removed:** ${c.name}`);
    } else {
        lines.push(`${pad}- ~ **Profile modified:** ${c.name}`);
        for (const s of c.stats) lines.push(`${pad}    · ${s.key}: ${fmtVal(s.old)} → ${fmtVal(s.new)}`);
        if (c.skills.added.length) lines.push(`${pad}    · skills + ${c.skills.added.join(', ')}`);
        if (c.skills.removed.length) lines.push(`${pad}    · skills − ${c.skills.removed.join(', ')}`);
        if (c.weapons.added.length) lines.push(`${pad}    · weapons + ${c.weapons.added.join(', ')}`);
        if (c.weapons.removed.length) lines.push(`${pad}    · weapons − ${c.weapons.removed.join(', ')}`);
        if (c.equipment.added.length) lines.push(`${pad}    · equipment + ${c.equipment.added.join(', ')}`);
        if (c.equipment.removed.length) lines.push(`${pad}    · equipment − ${c.equipment.removed.join(', ')}`);
    }
    return lines;
}

function renderOptionChange(c, depth = 0) {
    const pad = '  '.repeat(depth);
    const lines = [];
    if (c.added) {
        const o = c.option;
        lines.push(`${pad}- + **Option added:** ${c.name} (${o.points} pts${o.swc !== '0' ? `, SWC ${o.swc}` : ''})`);
        const ws = (o.weapons || []).map(x => x.displayName).join(', ');
        const sk = (o.skills || []).map(x => x.displayName).join(', ');
        const eq = (o.equipment || []).map(x => x.displayName).join(', ');
        if (ws) lines.push(`${pad}    · weapons: ${ws}`);
        if (sk) lines.push(`${pad}    · skills: ${sk}`);
        if (eq) lines.push(`${pad}    · equipment: ${eq}`);
    } else if (c.removed) {
        lines.push(`${pad}- − **Option removed:** ${c.name} (was ${c.option.points} pts)`);
    } else {
        lines.push(`${pad}- ~ **Option modified:** ${c.name}`);
        if (c.points) lines.push(`${pad}    · points: ${c.points.old} → ${c.points.new}`);
        if (c.swc) lines.push(`${pad}    · SWC: ${c.swc.old} → ${c.swc.new}`);
        if (c.weapons.added.length) lines.push(`${pad}    · weapons + ${c.weapons.added.join(', ')}`);
        if (c.weapons.removed.length) lines.push(`${pad}    · weapons − ${c.weapons.removed.join(', ')}`);
        if (c.skills.added.length) lines.push(`${pad}    · skills + ${c.skills.added.join(', ')}`);
        if (c.skills.removed.length) lines.push(`${pad}    · skills − ${c.skills.removed.join(', ')}`);
        if (c.equipment.added.length) lines.push(`${pad}    · equipment + ${c.equipment.added.join(', ')}`);
        if (c.equipment.removed.length) lines.push(`${pad}    · equipment − ${c.equipment.removed.join(', ')}`);
    }
    return lines;
}

// --- main ---

const oldFiles = new Set(listFactionFiles(oldProc));
const newFiles = new Set(listFactionFiles(newProc));
const allFiles = new Set([...oldFiles, ...newFiles]);

fs.mkdirSync(OUT_DIR, { recursive: true });

const indexLines = ['# Per-Faction Profile-Level Change Report', '',
    `Old: ${OLD_ROOT}`, `New: ${NEW_ROOT}`, `Generated: ${new Date().toISOString()}`, '',
    'Mod-aware diff: weapon/skill/equipment changes are reported by their `displayName`,',
    'so e.g. `Mimetism(-6)` is distinguished from `Mimetism(-3)` and `Thunderbolt(+2B)` from `Thunderbolt`.',
    '',
    '| Faction | Units w/ profile changes | Profiles changed | Options changed |',
    '|---|---:|---:|---:|'];

let grandUnits = 0, grandProfiles = 0, grandOptions = 0;

for (const file of [...allFiles].sort()) {
    const slug = file.replace(/\.json$/, '');
    const o = oldFiles.has(file) ? load(path.join(oldProc, file)) : null;
    const n = newFiles.has(file) ? load(path.join(newProc, file)) : null;

    const oUnits = (o?.units || []).filter(u => !isUniversalMerc(u));
    const nUnits = (n?.units || []).filter(u => !isUniversalMerc(u));
    const oMap = new Map(oUnits.map(u => [u.id, u]));
    const nMap = new Map(nUnits.map(u => [u.id, u]));

    const unitReports = [];
    let factionProfileChanges = 0;
    let factionOptionChanges = 0;

    for (const id of nMap.keys()) {
        if (!oMap.has(id)) continue;
        const ou = oMap.get(id);
        const nu = nMap.get(id);
        const groupDiffs = diffUnit(ou, nu);
        if (groupDiffs.length === 0) continue;

        let pc = 0, oc = 0;
        for (const g of groupDiffs) {
            pc += (g.profileChanges || []).length;
            oc += (g.optionChanges || []).length;
        }
        if (pc === 0 && oc === 0) continue;
        factionProfileChanges += pc;
        factionOptionChanges += oc;
        unitReports.push({ unit: nu, groupDiffs, pc, oc });
    }

    grandUnits += unitReports.length;
    grandProfiles += factionProfileChanges;
    grandOptions += factionOptionChanges;
    indexLines.push(`| [${slug}](${slug}.md) | ${unitReports.length} | ${factionProfileChanges} | ${factionOptionChanges} |`);

    if (unitReports.length === 0) continue;

    const lines = [];
    lines.push(`# ${slug} — profile-level changes`);
    lines.push('');
    lines.push(`Units with profile/option changes: **${unitReports.length}**`);
    lines.push(`Profile-level changes: **${factionProfileChanges}** · Option-level changes: **${factionOptionChanges}**`);
    lines.push('');
    for (const r of unitReports) {
        lines.push(`## [${r.unit.id}] ${r.unit.isc}`);
        lines.push(`*${r.unit.name}*`);
        lines.push('');
        for (const g of r.groupDiffs) {
            if (g.added) { lines.push(`- + **Profile group ${g.index} added** (${(g.group.profiles || []).length} profiles, ${(g.group.options || []).length} options)`); continue; }
            if (g.removed) { lines.push(`- − **Profile group ${g.index} removed** (was ${(g.group.profiles || []).length} profiles, ${(g.group.options || []).length} options)`); continue; }
            const hasGroup = (g.profileChanges?.length || 0) + (g.optionChanges?.length || 0) > 0;
            if (!hasGroup) continue;
            lines.push(`### Profile group ${g.index}`);
            for (const c of (g.profileChanges || [])) lines.push(...renderProfileChange(c));
            for (const c of (g.optionChanges || [])) lines.push(...renderOptionChange(c));
            lines.push('');
        }
        lines.push('');
    }

    fs.writeFileSync(path.join(OUT_DIR, `${slug}.md`), lines.join('\n'));
}

indexLines.push('');
indexLines.push(`**Totals:** units=${grandUnits}, profile changes=${grandProfiles}, option changes=${grandOptions}`);
fs.writeFileSync(path.join(OUT_DIR, 'INDEX.md'), indexLines.join('\n'));

console.log(`Wrote per-faction profile reports to ${OUT_DIR}`);
console.log(`Units: ${grandUnits}, profile changes: ${grandProfiles}, option changes: ${grandOptions}`);
