#!/usr/bin/env node
// Profile-level / Loadout-level mod-aware diff.
// Compares unit base stats/skills and specific playable loadouts (options),
// matching them by option ID/loadout signature and presenting them in the
// format Infinity players and Army users expect.
//
// Usage: node diff-by-profile.mjs <old-root> <new-root> <out-dir>

import fs from 'node:fs';
import path from 'node:path';

const [, , OLD_ROOT, NEW_ROOT, OUT_DIR] = process.argv;
if (!OLD_ROOT || !NEW_ROOT || !OUT_DIR) {
    console.error('Usage: node diff-by-profile.mjs <old-root> <new-root> <out-dir>');
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
    const oldSet = new Set((oldArr || []).map(x => x.displayName || x.name));
    const newSet = new Set((newArr || []).map(x => x.displayName || x.name));
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
        if (o !== n) changes.push({ key: k.toUpperCase(), old: oldP[k], new: newP[k] });
    }
    return changes;
}

function fmtVal(v) {
    if (Array.isArray(v)) return `[${v.join('-')}]`;
    return String(v);
}

function diffChassis(oldP, newP) {
    return {
        stats: diffStats(oldP, newP),
        skills: diffByDisplay(oldP.skills, newP.skills),
        weapons: diffByDisplay(oldP.weapons, newP.weapons),
        equipment: diffByDisplay(oldP.equipment, newP.equipment),
    };
}

function hasChassisChanges(d) {
    return d.stats.length > 0
        || d.skills.added.length || d.skills.removed.length
        || d.weapons.added.length || d.weapons.removed.length
        || d.equipment.added.length || d.equipment.removed.length;
}

function getLoadoutLabel(opt) {
    const optName = opt.name || 'Loadout';
    const specialSkills = (opt.skills || []).map(s => s.displayName || s.name);
    
    // Filter out plain default sidearms if other primary weapons exist
    const rawWeapons = (opt.weapons || []).map(w => w.displayName || w.name);
    let keyWeapons = rawWeapons.filter(w => !['Pistol', 'CC Weapon', 'Knife'].includes(w));
    if (keyWeapons.length === 0) keyWeapons = rawWeapons;

    const keyEquip = (opt.equipment || []).map(e => e.displayName || e.name);

    const parts = [];
    if (keyWeapons.length) parts.push(keyWeapons.join(', '));
    if (specialSkills.length) parts.push(specialSkills.join(', '));
    if (keyEquip.length) parts.push(keyEquip.join(', '));

    const extra = parts.join(' | ');
    if (!extra) return optName;
    return `${optName} (${extra})`;
}

function diffOption(oldO, newO) {
    return {
        points: oldO.points !== newO.points ? { old: oldO.points, new: newO.points } : null,
        swc: String(oldO.swc ?? 0) !== String(newO.swc ?? 0) ? { old: oldO.swc ?? 0, new: newO.swc ?? 0 } : null,
        weapons: diffByDisplay(oldO.weapons, newO.weapons),
        skills: diffByDisplay(oldO.skills, newO.skills),
        equipment: diffByDisplay(oldO.equipment, newO.equipment),
    };
}

function hasOptionChanges(d) {
    return d.points || d.swc
        || d.weapons.added.length || d.weapons.removed.length
        || d.skills.added.length || d.skills.removed.length
        || d.equipment.added.length || d.equipment.removed.length;
}

function diffUnit(oldU, newU) {
    const oldGroups = oldU.profileGroups || [];
    const newGroups = newU.profileGroups || [];
    const isMultiGroup = oldGroups.length > 1 || newGroups.length > 1;

    const chassisChanges = [];
    const addedLoadouts = [];
    const removedLoadouts = [];
    const modifiedLoadouts = [];

    const groupCount = Math.max(oldGroups.length, newGroups.length);

    for (let gi = 0; gi < groupCount; gi++) {
        const og = oldGroups[gi];
        const ng = newGroups[gi];

        // Group added/removed entirely
        if (!og && ng) {
            const formName = ng.profiles?.[0]?.name || ng.isc || `Form ${gi + 1}`;
            for (const opt of (ng.options || [])) {
                addedLoadouts.push({ formName: isMultiGroup ? formName : null, option: opt, label: getLoadoutLabel(opt) });
            }
            continue;
        }
        if (og && !ng) {
            const formName = og.profiles?.[0]?.name || og.isc || `Form ${gi + 1}`;
            for (const opt of (og.options || [])) {
                removedLoadouts.push({ formName: isMultiGroup ? formName : null, option: opt, label: getLoadoutLabel(opt) });
            }
            continue;
        }

        const formName = ng.profiles?.[0]?.name || og.profiles?.[0]?.name || (isMultiGroup ? `Form ${gi + 1}` : null);

        // 1. Chassis / Base Profile Diffs
        const oldProfiles = og.profiles || [];
        const newProfiles = ng.profiles || [];
        const maxProfiles = Math.max(oldProfiles.length, newProfiles.length);

        for (let pi = 0; pi < maxProfiles; pi++) {
            const op = oldProfiles[pi];
            const np = newProfiles[pi];
            const profileName = np?.name || op?.name || formName || `Chassis ${pi + 1}`;

            if (!op && np) {
                chassisChanges.push({ name: profileName, formName: isMultiGroup ? formName : null, added: true, profile: np });
            } else if (op && !np) {
                chassisChanges.push({ name: profileName, formName: isMultiGroup ? formName : null, removed: true, profile: op });
            } else if (op && np) {
                const cd = diffChassis(op, np);
                if (hasChassisChanges(cd)) {
                    chassisChanges.push({ name: profileName, formName: isMultiGroup ? formName : null, modified: true, ...cd });
                }
            }
        }

        // 2. Loadout (Option) Diffs — Match by option ID primarily
        const oldOptions = og.options || [];
        const newOptions = ng.options || [];

        const oldById = new Map(oldOptions.map(o => [o.id, o]));
        const newById = new Map(newOptions.map(o => [o.id, o]));

        const matchedOldIds = new Set();
        const matchedNewIds = new Set();

        // Match by ID
        for (const [id, no] of newById.entries()) {
            if (oldById.has(id)) {
                const oo = oldById.get(id);
                matchedOldIds.add(id);
                matchedNewIds.add(id);
                const od = diffOption(oo, no);
                if (hasOptionChanges(od)) {
                    modifiedLoadouts.push({
                        formName: isMultiGroup ? formName : null,
                        label: getLoadoutLabel(no),
                        oldLabel: getLoadoutLabel(oo),
                        oldOption: oo,
                        newOption: no,
                        ...od,
                    });
                }
            }
        }

        // Remaining unmatched
        for (const [id, no] of newById.entries()) {
            if (!matchedNewIds.has(id)) {
                addedLoadouts.push({
                    formName: isMultiGroup ? formName : null,
                    option: no,
                    label: getLoadoutLabel(no),
                });
            }
        }
        for (const [id, oo] of oldById.entries()) {
            if (!matchedOldIds.has(id)) {
                removedLoadouts.push({
                    formName: isMultiGroup ? formName : null,
                    option: oo,
                    label: getLoadoutLabel(oo),
                });
            }
        }
    }

    return {
        hasChanges: chassisChanges.length > 0 || addedLoadouts.length > 0 || removedLoadouts.length > 0 || modifiedLoadouts.length > 0,
        chassisChanges,
        addedLoadouts,
        removedLoadouts,
        modifiedLoadouts,
    };
}

function pointsStr(r) {
    if (!r) return '?';
    if (Array.isArray(r)) return r[0] === r[1] ? String(r[0]) : `${r[0]}-${r[1]}`;
    return String(r);
}

function renderAddedUnitMarkdown(unit) {
    const lines = [];
    lines.push(`## [${unit.id}] ${unit.isc}`);
    const pts = pointsStr(unit.pointsRange);
    const sub = unit.name && unit.name !== unit.isc ? `*${unit.name}* — **NEW UNIT** (${pts} pts)` : `*NEW UNIT* (${pts} pts)`;
    lines.push(sub);
    lines.push('');

    lines.push('### Base Statline & Skills');
    for (const pg of (unit.profileGroups || [])) {
        for (const p of (pg.profiles || [])) {
            const stats = STAT_KEYS.filter(k => p[k] != null && !(Array.isArray(p[k]) && p[k].length === 0))
                .map(k => `${k.toUpperCase()}=${fmtVal(p[k])}`).join(', ');
            lines.push(`- + **${p.name || unit.isc}** (${stats})`);
            const sk = (p.skills || []).map(x => x.displayName || x.name).join(', ');
            const eq = (p.equipment || []).map(x => x.displayName || x.name).join(', ');
            const ws = (p.weapons || []).map(x => x.displayName || x.name).join(', ');
            if (sk) lines.push(`    · skills: ${sk}`);
            if (eq) lines.push(`    · equipment: ${eq}`);
            if (ws) lines.push(`    · weapons: ${ws}`);
        }
    }
    lines.push('');

    const options = (unit.profileGroups || []).flatMap(pg => pg.options || []);
    if (options.length > 0) {
        lines.push('### Available Loadouts');
        for (const o of options) {
            const label = getLoadoutLabel(o);
            const swcStr = o.swc ? `, SWC ${o.swc}` : '';
            lines.push(`- + **${label}** (${o.points ?? 0} pts${swcStr})`);
            const ws = (o.weapons || []).map(x => x.displayName || x.name).join(', ');
            const sk = (o.skills || []).map(x => x.displayName || x.name).join(', ');
            const eq = (o.equipment || []).map(x => x.displayName || x.name).join(', ');
            if (ws) lines.push(`    · weapons: ${ws}`);
            if (sk) lines.push(`    · skills: ${sk}`);
            if (eq) lines.push(`    · equipment: ${eq}`);
        }
        lines.push('');
    }
    return lines;
}

function renderRemovedUnitMarkdown(unit) {
    const lines = [];
    lines.push(`## [${unit.id}] ${unit.isc}`);
    const pts = pointsStr(unit.pointsRange);
    const sub = unit.name && unit.name !== unit.isc ? `*${unit.name}* — **REMOVED UNIT** (was ${pts} pts)` : `*REMOVED UNIT* (was ${pts} pts)`;
    lines.push(sub);
    lines.push('');
    lines.push('### Removed Unit');
    lines.push(`- − **Unit removed from faction roster** (was ${pts} pts)`);
    lines.push('');
    return lines;
}

function renderUnitMarkdown(unit, diff) {
    const lines = [];
    lines.push(`## [${unit.id}] ${unit.isc}`);
    if (unit.name && unit.name !== unit.isc) {
        lines.push(`*${unit.name}*`);
    }
    lines.push('');

    // 1. Base Statline & Skills
    if (diff.chassisChanges.length > 0) {
        lines.push('### Base Statline & Skills');
        for (const c of diff.chassisChanges) {
            const prefix = c.formName ? `**[${c.formName}]** ` : '';
            if (c.added) {
                lines.push(`- + ${prefix}**Chassis Added**: ${c.name}`);
                const stats = STAT_KEYS.filter(k => c.profile[k] != null && !(Array.isArray(c.profile[k]) && c.profile[k].length === 0))
                    .map(k => `${k.toUpperCase()}=${fmtVal(c.profile[k])}`).join(', ');
                if (stats) lines.push(`    · ${stats}`);
            } else if (c.removed) {
                lines.push(`- − ${prefix}**Chassis Removed**: ${c.name}`);
            } else {
                lines.push(`- ~ ${prefix}**Stat / Skill Update** (${c.name})`);
                for (const s of c.stats) {
                    lines.push(`    · ${s.key}: ${fmtVal(s.old)} → ${fmtVal(s.new)}`);
                }
                if (c.skills.added.length) lines.push(`    · skills + ${c.skills.added.join(', ')}`);
                if (c.skills.removed.length) lines.push(`    · skills − ${c.skills.removed.join(', ')}`);
                if (c.equipment.added.length) lines.push(`    · equipment + ${c.equipment.added.join(', ')}`);
                if (c.equipment.removed.length) lines.push(`    · equipment − ${c.equipment.removed.join(', ')}`);
                if (c.weapons.added.length) lines.push(`    · weapons + ${c.weapons.added.join(', ')}`);
                if (c.weapons.removed.length) lines.push(`    · weapons − ${c.weapons.removed.join(', ')}`);
            }
        }
        lines.push('');
    }

    // 2. Modified Loadouts
    if (diff.modifiedLoadouts.length > 0) {
        lines.push('### Modified Loadouts');
        for (const m of diff.modifiedLoadouts) {
            const formPrefix = m.formName ? `[${m.formName}] ` : '';
            lines.push(`- ~ **${formPrefix}${m.label}**`);
            if (m.points) lines.push(`    · Points: ${m.points.old} → ${m.points.new}`);
            if (m.swc) lines.push(`    · SWC: ${m.swc.old} → ${m.swc.new}`);
            if (m.weapons.added.length) lines.push(`    · weapons + ${m.weapons.added.join(', ')}`);
            if (m.weapons.removed.length) lines.push(`    · weapons − ${m.weapons.removed.join(', ')}`);
            if (m.skills.added.length) lines.push(`    · skills + ${m.skills.added.join(', ')}`);
            if (m.skills.removed.length) lines.push(`    · skills − ${m.skills.removed.join(', ')}`);
            if (m.equipment.added.length) lines.push(`    · equipment + ${m.equipment.added.join(', ')}`);
            if (m.equipment.removed.length) lines.push(`    · equipment − ${m.equipment.removed.join(', ')}`);
        }
        lines.push('');
    }

    // 3. Added Loadouts
    if (diff.addedLoadouts.length > 0) {
        lines.push('### Added Loadouts');
        for (const a of diff.addedLoadouts) {
            const formPrefix = a.formName ? `[${a.formName}] ` : '';
            const o = a.option;
            const swcStr = o.swc ? `, SWC ${o.swc}` : '';
            lines.push(`- + **${formPrefix}${a.label}** (${o.points ?? 0} pts${swcStr})`);
            const ws = (o.weapons || []).map(x => x.displayName || x.name).join(', ');
            const sk = (o.skills || []).map(x => x.displayName || x.name).join(', ');
            const eq = (o.equipment || []).map(x => x.displayName || x.name).join(', ');
            if (ws) lines.push(`    · weapons: ${ws}`);
            if (sk) lines.push(`    · skills: ${sk}`);
            if (eq) lines.push(`    · equipment: ${eq}`);
        }
        lines.push('');
    }

    // 4. Removed Loadouts
    if (diff.removedLoadouts.length > 0) {
        lines.push('### Removed Loadouts');
        for (const r of diff.removedLoadouts) {
            const formPrefix = r.formName ? `[${r.formName}] ` : '';
            const o = r.option;
            lines.push(`- − **${formPrefix}${r.label}** (was ${o.points ?? 0} pts)`);
        }
        lines.push('');
    }

    return lines;
}

function formatFtUnit(u) {
    const parts = [];
    if (u.min != null && u.max != null) {
        if (u.min === u.max) parts.push(`qty: ${u.min}`);
        else if (u.min > 0) parts.push(`min: ${u.min}, max: ${u.max}`);
        else parts.push(`max: ${u.max}`);
    } else if (u.max != null) {
        parts.push(`max: ${u.max}`);
    }
    if (u.required) parts.push('REQUIRED');
    if (u.comment && u.comment.trim()) parts.push(u.comment.trim());
    return parts.length ? `(${parts.join(', ')})` : '';
}

function diffFireteams(oldData, newData) {
    const of = oldData?.faction?.fireteams;
    const nf = newData?.faction?.fireteams;

    if (!of && !nf) return { hasChanges: false, specChanges: [], addedTeams: [], removedTeams: [], modifiedTeams: [] };

    const specChanges = [];
    if (of?.spec && nf?.spec) {
        for (const k of ['CORE', 'HARIS', 'DUO']) {
            const ov = of.spec[k] ?? 0;
            const nv = nf.spec[k] ?? 0;
            if (ov !== nv) {
                specChanges.push({ type: k, old: ov, new: nv });
            }
        }
    }

    const oComps = of?.compositions || [];
    const nComps = nf?.compositions || [];

    const oCompMap = new Map(oComps.map(c => [c.name, c]));
    const nCompMap = new Map(nComps.map(c => [c.name, c]));

    const addedTeams = [];
    const removedTeams = [];
    const modifiedTeams = [];

    for (const [name, nc] of nCompMap.entries()) {
        if (!oCompMap.has(name)) {
            addedTeams.push(nc);
        } else {
            const oc = oCompMap.get(name);
            const typeChanged = JSON.stringify(oc.type || []) !== JSON.stringify(nc.type || []);

            const oUnits = oc.units || [];
            const nUnits = nc.units || [];

            const getUnitKey = u => u.slug || u.name;
            const oUnitMap = new Map(oUnits.map(u => [getUnitKey(u), u]));
            const nUnitMap = new Map(nUnits.map(u => [getUnitKey(u), u]));

            const addedUnits = [];
            const removedUnits = [];
            const modifiedUnits = [];

            for (const [key, nu] of nUnitMap.entries()) {
                if (!oUnitMap.has(key)) {
                    addedUnits.push(nu);
                } else {
                    const ou = oUnitMap.get(key);
                    const changes = [];
                    if (ou.min !== nu.min) changes.push(`min: ${ou.min} → ${nu.min}`);
                    if (ou.max !== nu.max) changes.push(`max: ${ou.max} → ${nu.max}`);
                    if (ou.required !== nu.required) changes.push(`required: ${ou.required} → ${nu.required}`);
                    if ((ou.comment || '').trim() !== (nu.comment || '').trim()) {
                        changes.push(`comment: "${ou.comment || ''}" → "${nu.comment || ''}"`);
                    }
                    if (changes.length > 0) {
                        modifiedUnits.push({ unit: nu, changes });
                    }
                }
            }

            for (const [key, ou] of oUnitMap.entries()) {
                if (!nUnitMap.has(key)) {
                    removedUnits.push(ou);
                }
            }

            if (typeChanged || addedUnits.length > 0 || removedUnits.length > 0 || modifiedUnits.length > 0) {
                modifiedTeams.push({
                    name,
                    oldType: oc.type,
                    newType: nc.type,
                    typeChanged,
                    addedUnits,
                    removedUnits,
                    modifiedUnits,
                });
            }
        }
    }

    for (const [name, oc] of oCompMap.entries()) {
        if (!nCompMap.has(name)) {
            removedTeams.push(oc);
        }
    }

    const hasChanges = specChanges.length > 0 || addedTeams.length > 0 || removedTeams.length > 0 || modifiedTeams.length > 0;

    return {
        hasChanges,
        specChanges,
        addedTeams,
        removedTeams,
        modifiedTeams,
    };
}

function renderFireteamMarkdown(ftDiff) {
    if (!ftDiff || !ftDiff.hasChanges) return [];

    const lines = [];
    lines.push('## Fireteam Chart Updates');
    lines.push('');

    if (ftDiff.specChanges.length > 0) {
        lines.push('### Fireteam Limits');
        for (const s of ftDiff.specChanges) {
            lines.push(`- ~ **${s.type} Limit**: ${s.old} → ${s.new}`);
        }
        lines.push('');
    }

    if (ftDiff.addedTeams.length > 0) {
        lines.push('### Added Fireteams');
        for (const t of ftDiff.addedTeams) {
            const types = (t.type || []).join(', ');
            lines.push(`- + **${t.name}** (${types})`);
            for (const u of (t.units || [])) {
                const desc = formatFtUnit(u);
                lines.push(`    · + ${u.name || u.slug} ${desc}`.trimEnd());
            }
        }
        lines.push('');
    }

    if (ftDiff.removedTeams.length > 0) {
        lines.push('### Removed Fireteams');
        for (const t of ftDiff.removedTeams) {
            lines.push(`- − **${t.name}**`);
        }
        lines.push('');
    }

    if (ftDiff.modifiedTeams.length > 0) {
        lines.push('### Modified Fireteams');
        for (const t of ftDiff.modifiedTeams) {
            lines.push(`- ~ **${t.name}**`);
            if (t.typeChanged) {
                lines.push(`    · Types: [${(t.oldType || []).join(', ')}] → [${(t.newType || []).join(', ')}]`);
            }
            for (const u of t.addedUnits) {
                const desc = formatFtUnit(u);
                lines.push(`    · + ${u.name || u.slug} ${desc}`.trimEnd());
            }
            for (const u of t.removedUnits) {
                lines.push(`    · − ${u.name || u.slug}`);
            }
            for (const m of t.modifiedUnits) {
                lines.push(`    · ~ ${m.unit.name || m.unit.slug} (${m.changes.join(', ')})`);
            }
        }
        lines.push('');
    }

    return lines;
}

// --- Main ---

const oldFiles = new Set(listFactionFiles(oldProc));
const newFiles = new Set(listFactionFiles(newProc));
const allFiles = new Set([...oldFiles, ...newFiles]);

fs.mkdirSync(OUT_DIR, { recursive: true });

const indexLines = [
    '# Per-Faction Profile & Loadout Changes',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'Mod-aware profile, loadout, and fireteam chart changes across all factions.',
    'Differentiates added/removed units, fireteam compositions, skill/weapon modifiers, stat changes, and point/SWC adjustments.',
    '',
    '| Faction | Units Changed | Added Units | Removed Units | Modified Units | Fireteam Changes | Stat Updates | Modified Loadouts | Added Loadouts | Removed Loadouts |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|'
];

let totalUnitsChangedCount = 0;
let totalAddedUnitsCount = 0;
let totalRemovedUnitsCount = 0;
let totalModifiedUnitsCount = 0;
let totalFireteamChangesCount = 0;
let totalChassis = 0;
let totalModified = 0;
let totalAdded = 0;
let totalRemoved = 0;

for (const file of [...allFiles].sort()) {
    const slug = file.replace(/\.json$/, '');
    const o = oldFiles.has(file) ? load(path.join(oldProc, file)) : null;
    const n = newFiles.has(file) ? load(path.join(newProc, file)) : null;

    const oUnits = (o?.units || []).filter(u => !isUniversalMerc(u));
    const nUnits = (n?.units || []).filter(u => !isUniversalMerc(u));
    const oMap = new Map(oUnits.map(u => [u.id, u]));
    const nMap = new Map(nUnits.map(u => [u.id, u]));

    const addedUnitIds = [...nMap.keys()].filter(id => !oMap.has(id)).sort((a, b) => a - b);
    const removedUnitIds = [...oMap.keys()].filter(id => !nMap.has(id)).sort((a, b) => a - b);
    const commonIds = [...nMap.keys()].filter(id => oMap.has(id)).sort((a, b) => a - b);

    const unitDiffs = [];
    let fChassis = 0, fMod = 0, fAdd = 0, fRem = 0;

    for (const id of commonIds) {
        const ou = oMap.get(id);
        const nu = nMap.get(id);
        const diff = diffUnit(ou, nu);
        if (!diff.hasChanges) continue;

        fChassis += diff.chassisChanges.length;
        fMod += diff.modifiedLoadouts.length;
        fAdd += diff.addedLoadouts.length;
        fRem += diff.removedLoadouts.length;

        unitDiffs.push({ unit: nu, diff });
    }

    const ftDiff = diffFireteams(o, n);
    const fFtChanges = ftDiff.specChanges.length + ftDiff.addedTeams.length + ftDiff.removedTeams.length + ftDiff.modifiedTeams.length;

    const factionUnitsChanged = addedUnitIds.length + removedUnitIds.length + unitDiffs.length;
    if (factionUnitsChanged === 0 && !ftDiff.hasChanges) continue;

    totalUnitsChangedCount += factionUnitsChanged;
    totalAddedUnitsCount += addedUnitIds.length;
    totalRemovedUnitsCount += removedUnitIds.length;
    totalModifiedUnitsCount += unitDiffs.length;
    totalFireteamChangesCount += fFtChanges;
    totalChassis += fChassis;
    totalModified += fMod;
    totalAdded += fAdd;
    totalRemoved += fRem;

    indexLines.push(`| [${slug}](${slug}.md) | ${factionUnitsChanged} | ${addedUnitIds.length} | ${removedUnitIds.length} | ${unitDiffs.length} | ${fFtChanges} | ${fChassis} | ${fMod} | ${fAdd} | ${fRem} |`);

    const reportLines = [
        `# ${slug} — Profile & Loadout Changes`,
        '',
        `Units changed: **${factionUnitsChanged}** (Added: **${addedUnitIds.length}**, Removed: **${removedUnitIds.length}**, Modified: **${unitDiffs.length}**) · Fireteam updates: **${fFtChanges}** · Stat updates: **${fChassis}** · Modified loadouts: **${fMod}** · Added loadouts: **${fAdd}** · Removed loadouts: **${fRem}**`,
        '',
    ];

    if (ftDiff.hasChanges) {
        reportLines.push(...renderFireteamMarkdown(ftDiff));
    }

    if (addedUnitIds.length > 0) {
        for (const id of addedUnitIds) {
            reportLines.push(...renderAddedUnitMarkdown(nMap.get(id)));
        }
    }

    if (removedUnitIds.length > 0) {
        for (const id of removedUnitIds) {
            reportLines.push(...renderRemovedUnitMarkdown(oMap.get(id)));
        }
    }

    for (const { unit, diff } of unitDiffs) {
        reportLines.push(...renderUnitMarkdown(unit, diff));
    }

    fs.writeFileSync(path.join(OUT_DIR, `${slug}.md`), reportLines.join('\n'));
}

indexLines.push('');
indexLines.push(`**Totals:** Units Changed: ${totalUnitsChangedCount} (Added: ${totalAddedUnitsCount}, Removed: ${totalRemovedUnitsCount}, Modified: ${totalModifiedUnitsCount}) | Fireteam Updates: ${totalFireteamChangesCount} | Stat Updates: ${totalChassis} | Modified Loadouts: ${totalModified} | Added Loadouts: ${totalAdded} | Removed Loadouts: ${totalRemoved}`);

fs.writeFileSync(path.join(OUT_DIR, 'INDEX.md'), indexLines.join('\n'));

console.log(`Wrote profile reports to ${OUT_DIR}`);
console.log(`Units Changed: ${totalUnitsChangedCount} (+${totalAddedUnitsCount} -${totalRemovedUnitsCount} ~${totalModifiedUnitsCount}), Fireteam Updates: ${totalFireteamChangesCount}, Stat Updates: ${totalChassis}, Modified Loadouts: ${totalModified}, Added Loadouts: ${totalAdded}, Removed Loadouts: ${totalRemoved}`);
