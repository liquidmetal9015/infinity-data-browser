#!/usr/bin/env node
// Render the markdown diff reports in by-faction/ and by-profile/ to static HTML
// pages with shared CSS and a sidebar nav. No JS dependencies.
//
// Usage: node update_diffs/render-html.mjs
//
// Reads:  update_diffs/by-faction/*.md, update_diffs/by-profile/*.md
// Writes: update_diffs/html/by-faction/*.html, update_diffs/html/by-profile/*.html,
//         update_diffs/html/index.html, update_diffs/html/style.css

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = __dirname;
const OUT = path.join(__dirname, 'html');

function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Inline markdown: **bold**, *italic*, `code`, [text](url)
function renderInline(s) {
    let out = esc(s);
    out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    out = out.replace(/\*\*([^*]+)\*\*/g, (_, c) => `<strong>${c}</strong>`);
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, (_, pre, c) => `${pre}<em>${c}</em>`);
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
    return out;
}

// Categorize list-item lines and strip any leading +/−/~ marker (so it doesn't
// double up with the CSS ::before marker).
function classifyAndStripListItem(content) {
    let cls = '';
    let text = content;
    const m = text.match(/^([+−~-])\s+(.*)$/);
    if (m) {
        const marker = m[1];
        text = m[2];
        if (marker === '+') cls = 'add';
        else if (marker === '−' || marker === '-') cls = 'rem';
        else if (marker === '~') cls = 'mod';
    }
    if (!cls) {
        // Sub-line patterns like "weapons + Heavy Pistol", "skills − Foo"
        if (/^(weapons|skills|equipment)\s+\+\s/.test(text)) cls = 'add';
        else if (/^(weapons|skills|equipment)\s+[−-]\s/.test(text)) cls = 'rem';
        else if (/added\b/i.test(text) && !/removed/i.test(text)) cls = 'add';
        else if (/removed\b/i.test(text) && !/added/i.test(text)) cls = 'rem';
        else if (/^(Points|Profile groups|points|SWC|swc):/i.test(text)) cls = 'mod';
        else if (/^\w+:\s.*→/.test(text)) cls = 'mod'; // stat changes like "bts: 0 → 3"
    }
    return { cls, text };
}

function renderMarkdown(md, opts = {}) {
    const lines = md.split('\n');
    const out = [];
    let inList = false;
    let inTable = false;
    let tableHeader = false;

    function closeList() { if (inList) { out.push('</ul>'); inList = false; } }
    function closeTable() { if (inTable) { out.push('</tbody></table>'); inTable = false; tableHeader = false; } }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('# ')) {
            closeList(); closeTable();
            out.push(`<h1>${renderInline(line.slice(2))}</h1>`);
            continue;
        }
        if (line.startsWith('## ')) {
            closeList(); closeTable();
            const text = line.slice(3);
            // Unit anchor: extract [id] if present
            const m = text.match(/^\[(\d+)\]/);
            const id = m ? `id="u${m[1]}"` : '';
            out.push(`<h2 ${id}>${renderInline(text)}</h2>`);
            continue;
        }
        if (line.startsWith('### ')) {
            closeList(); closeTable();
            out.push(`<h3>${renderInline(line.slice(4))}</h3>`);
            continue;
        }

        // Tables (pipe syntax)
        if (line.startsWith('|')) {
            const cells = line.slice(1, line.endsWith('|') ? -1 : undefined).split('|').map(c => c.trim());
            // Separator row: |---|---|
            if (cells.every(c => /^:?-+:?$/.test(c))) { tableHeader = false; continue; }
            if (!inTable) {
                closeList();
                out.push('<table>');
                out.push('<thead><tr>' + cells.map(c => `<th>${renderInline(c)}</th>`).join('') + '</tr></thead><tbody>');
                inTable = true; tableHeader = true;
            } else {
                out.push('<tr>' + cells.map(c => `<td>${renderInline(c)}</td>`).join('') + '</tr>');
            }
            continue;
        } else if (inTable) {
            closeTable();
        }

        // List items — support nested indent
        const liMatch = line.match(/^(\s*)-\s+(.*)$/);
        if (liMatch) {
            const content = liMatch[2];
            if (!inList) { out.push('<ul>'); inList = true; }
            const { cls, text } = classifyAndStripListItem(content);
            out.push(`<li class="${cls}">${renderInline(text)}</li>`);
            continue;
        }
        if (inList && line.match(/^\s{4,}·/)) {
            // continuation lines with bullet "    · foo" — attach as sub-item
            const sub = line.replace(/^\s+·\s*/, '');
            const { cls, text } = classifyAndStripListItem(sub);
            out.push(`<li class="sub ${cls}">${renderInline(text)}</li>`);
            continue;
        }

        if (line.trim() === '') {
            closeList();
            continue;
        }
        // Italic-only line like `*Unit name*`
        if (/^\*[^*]+\*$/.test(line.trim())) {
            closeList();
            out.push(`<p class="subtitle">${renderInline(line.trim())}</p>`);
            continue;
        }
        closeList();
        out.push(`<p>${renderInline(line)}</p>`);
    }
    closeList(); closeTable();
    return out.join('\n');
}

const CSS = `
:root {
    --bg: #fafaf7;
    --bg-card: #fff;
    --fg: #222;
    --fg-muted: #666;
    --border: #ddd;
    --accent: #2c5282;
    --add-bg: #e6ffed;
    --add-fg: #22863a;
    --rem-bg: #ffeef0;
    --rem-fg: #b31d28;
    --mod-bg: #fffbdd;
    --mod-fg: #735c0f;
    --code-bg: #f1efe9;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg);
    color: var(--fg);
    line-height: 1.5;
    font-size: 14px;
}
.layout { display: flex; min-height: 100vh; }
nav.sidebar {
    width: 240px;
    background: var(--bg-card);
    border-right: 1px solid var(--border);
    padding: 16px 12px;
    position: sticky; top: 0; align-self: flex-start;
    height: 100vh; overflow-y: auto;
    font-size: 13px;
}
nav.sidebar h2 { font-size: 12px; text-transform: uppercase; color: var(--fg-muted); margin: 16px 0 6px; letter-spacing: 0.5px; }
nav.sidebar h2:first-child { margin-top: 0; }
nav.sidebar a { display: block; padding: 3px 6px; color: var(--fg); text-decoration: none; border-radius: 3px; }
nav.sidebar a:hover { background: var(--bg); }
nav.sidebar a.active { background: var(--accent); color: white; }
nav.sidebar .home { font-weight: 600; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
main {
    flex: 1;
    padding: 24px 32px;
    max-width: 1100px;
}
h1 { font-size: 24px; margin: 0 0 12px; border-bottom: 2px solid var(--border); padding-bottom: 8px; }
h2 { font-size: 18px; margin: 24px 0 8px; color: var(--accent); }
h3 { font-size: 15px; margin: 14px 0 6px; color: var(--fg-muted); }
p { margin: 6px 0; }
p.subtitle { color: var(--fg-muted); font-style: italic; margin-top: -4px; }
code { background: var(--code-bg); padding: 1px 5px; border-radius: 3px; font-size: 0.92em; }
strong { font-weight: 600; }
ul { list-style: none; padding-left: 0; margin: 6px 0 14px; }
li {
    padding: 3px 8px 3px 24px;
    border-radius: 3px;
    position: relative;
    margin: 1px 0;
}
li::before { position: absolute; left: 6px; top: 3px; font-weight: 700; }
li.sub { padding-left: 36px; font-size: 0.92em; color: var(--fg-muted); }
li.sub::before { left: 18px; }
li.add { background: var(--add-bg); color: var(--add-fg); }
li.add::before { content: "+"; }
li.rem { background: var(--rem-bg); color: var(--rem-fg); }
li.rem::before { content: "−"; }
li.mod { background: var(--mod-bg); color: var(--mod-fg); }
li.mod::before { content: "~"; }
li:not(.add):not(.rem):not(.mod)::before { content: "·"; color: var(--fg-muted); }
table { border-collapse: collapse; width: 100%; margin: 12px 0; background: var(--bg-card); }
th, td { padding: 6px 10px; border: 1px solid var(--border); text-align: left; font-size: 13px; }
th { background: var(--bg); font-weight: 600; }
td:nth-child(n+2):nth-last-child(n+2) { text-align: right; font-variant-numeric: tabular-nums; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tabs a {
    padding: 6px 12px; border: 1px solid var(--border); border-radius: 4px;
    background: var(--bg-card); color: var(--fg);
}
.tabs a.active { background: var(--accent); color: white; border-color: var(--accent); }
`;

function renderPage({ title, body, sidebar, activeReport, activePage }) {
    const tabs = `
<div class="tabs">
    <a href="../by-faction/index.html" class="${activeReport === 'by-faction' ? 'active' : ''}">By Faction (unit-level)</a>
    <a href="../by-profile/index.html" class="${activeReport === 'by-profile' ? 'active' : ''}">By Profile (mod-level)</a>
</div>`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<link rel="stylesheet" href="../style.css">
</head>
<body>
<div class="layout">
<nav class="sidebar">
<a class="home" href="../index.html">← Overview</a>
${sidebar}
</nav>
<main>
${tabs}
${body}
</main>
</div>
</body>
</html>
`;
}

function buildSidebar(slugs, activePage) {
    const items = slugs.map(s => `<a href="${s}.html" class="${s === activePage ? 'active' : ''}">${s}</a>`).join('\n');
    return `<h2>Factions</h2>\n<a href="index.html" class="${activePage === 'index' ? 'active' : ''}">Overview</a>\n${items}`;
}

function processReport(reportName, reportTitle) {
    const srcDir = path.join(SRC, reportName);
    const outDir = path.join(OUT, reportName);
    if (!fs.existsSync(srcDir)) {
        console.warn(`Skipping ${reportName}: ${srcDir} not found`);
        return [];
    }
    fs.mkdirSync(outDir, { recursive: true });

    const allFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.md'));
    const factionFiles = allFiles.filter(f => f !== 'INDEX.md').sort();
    const slugs = factionFiles.map(f => f.replace(/\.md$/, ''));
    const indexExists = allFiles.includes('INDEX.md');

    // INDEX page
    if (indexExists) {
        const md = fs.readFileSync(path.join(srcDir, 'INDEX.md'), 'utf8');
        // Rewrite intra-report links: faction.md → faction.html
        const rewritten = md.replace(/\]\(([a-z0-9-]+)\.md\)/g, '](.$1.html)').replace(/\]\(\.([^)]+)\)/g, '](./$1)');
        const html = renderPage({
            title: `${reportTitle} — Overview`,
            body: renderMarkdown(rewritten),
            sidebar: buildSidebar(slugs, 'index'),
            activeReport: reportName, activePage: 'index',
        });
        fs.writeFileSync(path.join(outDir, 'index.html'), html);
    }

    for (const file of factionFiles) {
        const slug = file.replace(/\.md$/, '');
        const md = fs.readFileSync(path.join(srcDir, file), 'utf8');
        const html = renderPage({
            title: `${slug} — ${reportTitle}`,
            body: renderMarkdown(md),
            sidebar: buildSidebar(slugs, slug),
            activeReport: reportName, activePage: slug,
        });
        fs.writeFileSync(path.join(outDir, `${slug}.html`), html);
    }
    return slugs;
}

// --- main ---

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'style.css'), CSS.trim());

const factionSlugs = processReport('by-faction', 'By-Faction Report');
const profileSlugs = processReport('by-profile', 'By-Profile Report');

// Top-level landing page
const landing = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Infinity Data Update Diff</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="layout">
<nav class="sidebar">
<a class="home active" href="index.html">Overview</a>
<h2>Reports</h2>
<a href="by-faction/index.html">By Faction (unit-level)</a>
<a href="by-profile/index.html">By Profile (mod-level)</a>
</nav>
<main>
<h1>Infinity Data Update Diff</h1>
<p>Generated ${new Date().toISOString()}</p>

<h2>Reports</h2>
<ul>
    <li><a href="by-faction/index.html"><strong>By Faction</strong></a> — unit-level adds / removes / modifications.
        Each modified unit lists the aggregate skill/weapon/equipment changes across all its profiles &amp; options,
        reported by mod-aware <code>displayName</code> (e.g. <code>Mimetism(-6)</code>, <code>Thunderbolt(+2B)</code>).</li>
    <li><a href="by-profile/index.html"><strong>By Profile</strong></a> — profile-level diff.
        Walks <code>profileGroups → profiles + options</code>, matches by name, and reports stat changes plus
        skill/weapon/equipment changes per profile. This is the report that lines up best with the official CB changelog.</li>
</ul>

<h2>Legend</h2>
<ul>
    <li class="add">Added items / new options / new profiles</li>
    <li class="rem">Removed items / dropped options</li>
    <li class="mod">Modified items (points, stats, swapped options)</li>
</ul>
</main>
</div>
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), landing);

// ---------------------------------------------------------------------------
// Single-file combined HTML — everything bundled, sticky sidebar nav,
// per-faction collapsible sections, inlined CSS. No external assets.
// ---------------------------------------------------------------------------

function buildCombinedSection(reportName, reportTitle, slugs) {
    const srcDir = path.join(SRC, reportName);
    const parts = [];
    parts.push(`<section id="${reportName}" class="report">`);
    parts.push(`<h1>${esc(reportTitle)}</h1>`);
    const indexPath = path.join(srcDir, 'INDEX.md');
    if (fs.existsSync(indexPath)) {
        const md = fs.readFileSync(indexPath, 'utf8');
        // Rewrite faction.md links to #faction-faction-{reportName} anchors
        const rewritten = md.replace(/\[([a-z0-9-]+)\]\(([a-z0-9-]+)\.md\)/g,
            (_, label, slug) => `[${label}](#${reportName}-${slug})`);
        parts.push('<div class="overview">');
        parts.push(renderMarkdown(rewritten));
        parts.push('</div>');
    }
    for (const slug of slugs) {
        const md = fs.readFileSync(path.join(srcDir, `${slug}.md`), 'utf8');
        parts.push(`<details id="${reportName}-${slug}" class="faction-section">`);
        parts.push(`<summary><strong>${esc(slug)}</strong></summary>`);
        parts.push('<div class="faction-body">');
        parts.push(renderMarkdown(md));
        parts.push('</div>');
        parts.push('</details>');
    }
    parts.push('</section>');
    return parts.join('\n');
}

function buildCombinedNav(factionSlugs, profileSlugs) {
    const sectionLink = (id, label) =>
        `<a href="#${id}" class="section-link">${esc(label)}</a>`;
    const factionLinks = factionSlugs
        .map(s => `<a href="#by-faction-${s}">${esc(s)}</a>`).join('\n');
    const profileLinks = profileSlugs
        .map(s => `<a href="#by-profile-${s}">${esc(s)}</a>`).join('\n');
    return `
<a class="home" href="#top">▲ Top</a>
<h2>Sections</h2>
${sectionLink('by-faction', 'By Faction (unit-level)')}
${sectionLink('by-profile', 'By Profile (mod-level)')}
<h2>By Faction</h2>
${factionLinks}
<h2>By Profile</h2>
${profileLinks}
`;
}

const COMBINED_EXTRA_CSS = `
section.report { margin: 32px 0; padding-top: 16px; border-top: 3px solid var(--accent); }
section.report:first-of-type { border-top: none; }
.overview { margin-bottom: 24px; }
details.faction-section {
    margin: 8px 0;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-card);
}
details.faction-section[open] { padding-bottom: 8px; }
details.faction-section > summary {
    padding: 10px 14px;
    cursor: pointer;
    user-select: none;
    background: var(--bg);
    border-radius: 4px;
    list-style: none;
    font-size: 15px;
}
details.faction-section[open] > summary {
    border-bottom: 1px solid var(--border);
    border-radius: 4px 4px 0 0;
}
details.faction-section > summary::before { content: '▶ '; color: var(--fg-muted); font-size: 11px; }
details.faction-section[open] > summary::before { content: '▼ '; }
.faction-body { padding: 8px 16px; }
.faction-body h1 { font-size: 18px; }
.faction-body h2 { font-size: 16px; }
.faction-body h3 { font-size: 14px; }
nav.sidebar .section-link {
    font-weight: 600;
    color: var(--accent);
    padding: 4px 6px;
    margin-bottom: 4px;
}
.toolbar {
    position: sticky; top: 0;
    background: var(--bg);
    padding: 8px 0 4px;
    z-index: 5;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
}
.toolbar a {
    padding: 6px 12px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg);
    margin-right: 8px;
}
.toolbar a:hover { background: var(--accent); color: white; border-color: var(--accent); }
`;

function renderCombined(factionSlugs, profileSlugs) {
    const factionSection = buildCombinedSection('by-faction', 'By Faction — unit-level diff', factionSlugs);
    const profileSection = buildCombinedSection('by-profile', 'By Profile — mod-level diff', profileSlugs);
    const nav = buildCombinedNav(factionSlugs, profileSlugs);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Infinity Data Update Diff — combined report</title>
<style>
${CSS.trim()}
${COMBINED_EXTRA_CSS.trim()}
</style>
</head>
<body>
<div class="layout">
<nav class="sidebar">
${nav}
</nav>
<main id="top">
<div class="toolbar">
    <a href="#by-faction">By Faction</a>
    <a href="#by-profile">By Profile</a>
    <span style="color: var(--fg-muted); font-size: 12px; margin-left: 16px;">
        Generated ${new Date().toISOString()}
    </span>
</div>
<h1>Infinity Data Update Diff</h1>
<p>Single-file combined report. Click a faction in the sidebar to jump, or expand sections inline.
Skill/weapon/equipment changes show mod-aware <code>displayName</code>
(e.g. <code>Mimetism(-6)</code>, <code>Thunderbolt(+2B)</code>).
Universal mercenaries (units with empty <code>factionIds</code>) are filtered.</p>
<h2>Legend</h2>
<ul>
<li class="add">Added items / new options / new profiles</li>
<li class="rem">Removed items / dropped options</li>
<li class="mod">Modified items (points, stats, swapped options)</li>
</ul>
${factionSection}
${profileSection}
</main>
</div>
<script>
// Auto-expand the <details> targeted by the URL hash (initial load + each
// hashchange from sidebar clicks). Pure navigation, no other behavior.
function openTarget() {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el && el.tagName === 'DETAILS') {
        el.open = true;
        el.scrollIntoView({ block: 'start' });
    }
}
window.addEventListener('hashchange', openTarget);
window.addEventListener('DOMContentLoaded', openTarget);
</script>
</body>
</html>
`;
}

const combinedHtml = renderCombined(factionSlugs, profileSlugs);
const combinedPath = path.join(OUT, 'combined.html');
fs.writeFileSync(combinedPath, combinedHtml);

console.log(`Wrote HTML to ${OUT}`);
console.log(`  by-faction: ${factionSlugs.length} faction pages + index`);
console.log(`  by-profile: ${profileSlugs.length} faction pages + index`);
console.log(`  combined.html: single self-contained file (${Math.round(combinedHtml.length / 1024)} KB)`);
console.log(`Open: file://${path.join(OUT, 'index.html')}`);
console.log(`Combined: file://${combinedPath}`);
