#!/usr/bin/env node
// Render the profile-level markdown diff reports in update_diffs/by-profile/
// into a unified static HTML site with sidebar navigation and single-page view.
//
// Usage: node update_diffs/render-html.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(__dirname, 'by-profile');
const OUT_DIR = path.join(__dirname, 'html');

function loadJson(p) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return null; }
}

const metadata = loadJson(path.join(ROOT, 'data/metadata.json')) || {};
const factionNameMap = new Map((metadata.factions || []).map(f => [f.slug, f.name]));

function getFactionDisplayName(slug) {
    if (factionNameMap.has(slug)) return factionNameMap.get(slug);
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Inline markdown formatting
function renderInline(s) {
    let out = esc(s);
    out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    out = out.replace(/\*\*([^*]+)\*\*/g, (_, c) => `<strong>${c}</strong>`);
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, (_, pre, c) => `${pre}<em>${c}</em>`);
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
    return out;
}

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
        if (/^(weapons|skills|equipment)\s+\+\s/.test(text)) cls = 'add';
        else if (/^(weapons|skills|equipment)\s+[−-]\s/.test(text)) cls = 'rem';
        else if (/added\b/i.test(text) && !/removed/i.test(text)) cls = 'add';
        else if (/removed\b/i.test(text) && !/added/i.test(text)) cls = 'rem';
        else if (/^(Points|SWC|points|swc):/i.test(text)) cls = 'mod';
        else if (/^\w+:\s.*→/.test(text)) cls = 'mod';
    }
    return { cls, text };
}

function renderMarkdown(md) {
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
            const m = text.match(/^\[(\d+)\]/);
            const id = m ? `id="u${m[1]}"` : '';
            out.push(`<h2 ${id} class="unit-title">${renderInline(text)}</h2>`);
            continue;
        }
        if (line.startsWith('### ')) {
            closeList(); closeTable();
            const heading = line.slice(4);
            let hClass = 'section-header';
            if (heading.includes('Added')) hClass += ' add-hdr';
            else if (heading.includes('Removed')) hClass += ' rem-hdr';
            else if (heading.includes('Modified')) hClass += ' mod-hdr';
            out.push(`<h3 class="${hClass}">${renderInline(heading)}</h3>`);
            continue;
        }

        if (line.startsWith('|')) {
            const cells = line.slice(1, line.endsWith('|') ? -1 : undefined).split('|').map(c => c.trim());
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

        const liMatch = line.match(/^(\s*)-\s+(.*)$/);
        if (liMatch) {
            const content = liMatch[2];
            if (!inList) { out.push('<ul>'); inList = true; }
            const { cls, text } = classifyAndStripListItem(content);
            out.push(`<li class="${cls}">${renderInline(text)}</li>`);
            continue;
        }
        if (inList && line.match(/^\s{4,}·/)) {
            const sub = line.replace(/^\s+·\s*/, '');
            const { cls, text } = classifyAndStripListItem(sub);
            out.push(`<li class="sub ${cls}">${renderInline(text)}</li>`);
            continue;
        }

        if (line.trim() === '') {
            closeList();
            continue;
        }
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
    --bg: #0f172a;
    --bg-card: #1e293b;
    --bg-card-hover: #334155;
    --fg: #f8fafc;
    --fg-muted: #94a3b8;
    --border: #334155;
    --accent: #38bdf8;
    --accent-bg: rgba(56, 189, 248, 0.12);
    --add-bg: rgba(34, 197, 94, 0.15);
    --add-fg: #4ade80;
    --add-border: rgba(34, 197, 94, 0.3);
    --rem-bg: rgba(239, 68, 68, 0.15);
    --rem-fg: #f87171;
    --rem-border: rgba(239, 68, 68, 0.3);
    --mod-bg: rgba(234, 179, 8, 0.12);
    --mod-fg: #fde047;
    --mod-border: rgba(234, 179, 8, 0.25);
    --code-bg: #0f172a;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg);
    color: var(--fg);
    line-height: 1.6;
    font-size: 14px;
}
.layout { display: flex; min-height: 100vh; }
nav.sidebar {
    width: 260px;
    background: var(--bg-card);
    border-right: 1px solid var(--border);
    padding: 16px 12px;
    position: sticky; top: 0; align-self: flex-start;
    height: 100vh; overflow-y: auto;
    font-size: 13px;
    flex-shrink: 0;
}
nav.sidebar h2 {
    font-size: 11px; text-transform: uppercase; color: var(--fg-muted);
    margin: 16px 0 8px; letter-spacing: 0.8px; font-weight: 700;
}
nav.sidebar a {
    display: block; padding: 5px 8px; color: var(--fg-muted);
    text-decoration: none; border-radius: 4px; transition: all 0.15s ease;
    margin-bottom: 2px;
}
nav.sidebar a:hover { background: var(--bg-card-hover); color: var(--fg); }
nav.sidebar a.active { background: var(--accent-bg); color: var(--accent); font-weight: 600; }
nav.sidebar .home {
    font-weight: 600; margin-bottom: 12px; padding-bottom: 10px;
    border-bottom: 1px solid var(--border); color: var(--fg);
}
main {
    flex: 1;
    padding: 32px 40px;
    max-width: 1000px;
}
h1 {
    font-size: 26px; margin: 0 0 12px;
    border-bottom: 1px solid var(--border); padding-bottom: 12px;
    color: #fff; font-weight: 700;
}
h2.unit-title {
    font-size: 18px; margin: 28px 0 4px;
    color: var(--accent); display: flex; align-items: center; gap: 8px;
}
h3.section-header {
    font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;
    margin: 16px 0 8px; color: var(--fg-muted); font-weight: 700;
}
h3.add-hdr { color: var(--add-fg); }
h3.rem-hdr { color: var(--rem-fg); }
h3.mod-hdr { color: var(--mod-fg); }
p { margin: 6px 0; }
p.subtitle { color: var(--fg-muted); font-style: italic; margin-top: -2px; margin-bottom: 12px; }
code {
    background: var(--code-bg); padding: 2px 6px; border-radius: 4px;
    font-size: 0.9em; border: 1px solid rgba(255,255,255,0.08);
}
strong { font-weight: 600; }
ul { list-style: none; padding-left: 0; margin: 6px 0 16px; }
li {
    padding: 6px 12px 6px 28px;
    border-radius: 6px;
    position: relative;
    margin: 3px 0;
    background: var(--bg-card);
    border: 1px solid rgba(255,255,255,0.05);
}
li::before { position: absolute; left: 10px; top: 6px; font-weight: 700; font-family: monospace; }
li.sub {
    padding-left: 36px; font-size: 0.93em; color: var(--fg-muted);
    background: transparent; border: none; margin: 0; padding-top: 2px; padding-bottom: 2px;
}
li.sub::before { left: 20px; top: 2px; }
li.add { background: var(--add-bg); color: var(--add-fg); border: 1px solid var(--add-border); }
li.add::before { content: "+"; color: var(--add-fg); }
li.rem { background: var(--rem-bg); color: var(--rem-fg); border: 1px solid var(--rem-border); }
li.rem::before { content: "−"; color: var(--rem-fg); }
li.mod { background: var(--mod-bg); color: var(--mod-fg); border: 1px solid var(--mod-border); }
li.mod::before { content: "~"; color: var(--mod-fg); }
li:not(.add):not(.rem):not(.mod)::before { content: "·"; color: var(--fg-muted); }
table {
    border-collapse: collapse; width: 100%; margin: 16px 0;
    background: var(--bg-card); border-radius: 8px; overflow: hidden;
    border: 1px solid var(--border);
}
th, td { padding: 8px 12px; border-bottom: 1px solid var(--border); text-align: left; font-size: 13px; }
th { background: rgba(255,255,255,0.03); font-weight: 600; color: var(--accent); }
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(255,255,255,0.02); }
td:nth-child(n+2) { text-align: right; font-variant-numeric: tabular-nums; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.top-bar {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border);
}
.view-all-link {
    font-size: 13px; padding: 6px 12px; background: var(--bg-card);
    border: 1px solid var(--border); border-radius: 6px;
}
@media (max-width: 768px) {
    .layout { flex-direction: column; }
    nav.sidebar { width: 100%; height: auto; position: static; }
    main { padding: 20px 16px; }
}
`;

function buildSidebar(slugs, activeSlug) {
    const items = slugs.map(s => {
        const name = getFactionDisplayName(s);
        const active = s === activeSlug ? 'class="active"' : '';
        return `<a href="${s}.html" ${active}>${esc(name)}</a>`;
    }).join('\n');

    return `
<a class="home" href="index.html">📊 Overview & Summary</a>
<a class="home" href="combined.html">📜 View All Factions</a>
<h2>Factions</h2>
${items}
`;
}

function renderHtmlPage({ title, body, sidebar }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="layout">
<nav class="sidebar">
${sidebar}
</nav>
<main>
${body}
</main>
</div>
</body>
</html>`;
}

// Clean and create OUT_DIR
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'style.css'), CSS);

const allMdFiles = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.md') && f !== 'INDEX.md').sort();
const slugs = allMdFiles.map(f => f.replace(/\.md$/, ''));

// 1. Index Page
if (fs.existsSync(path.join(SRC_DIR, 'INDEX.md'))) {
    let indexMd = fs.readFileSync(path.join(SRC_DIR, 'INDEX.md'), 'utf8');
    // Replace markdown table links [slug](slug.md) with [DisplayName](slug.html)
    indexMd = indexMd.replace(/\[([a-z0-9-]+)\]\(\1\.md\)/g, (_, slug) => {
        const name = getFactionDisplayName(slug);
        return `[${name}](${slug}.html)`;
    });

    const indexBody = renderMarkdown(indexMd);
    const indexHtml = renderHtmlPage({
        title: 'Infinity Data Changelog & Patch Notes',
        body: indexBody,
        sidebar: buildSidebar(slugs, 'index'),
    });
    fs.writeFileSync(path.join(OUT_DIR, 'index.html'), indexHtml);
}

// 2. Per-Faction Pages & Combined Page
const combinedSections = [];

for (const slug of slugs) {
    const filePath = path.join(SRC_DIR, `${slug}.md`);
    let md = fs.readFileSync(filePath, 'utf8');

    // Replace internal anchor links if any
    const body = renderMarkdown(md);
    combinedSections.push(`<section id="${slug}">\n${body}\n</section><hr style="border:0;border-top:1px solid var(--border);margin:40px 0;">`);

    const html = renderHtmlPage({
        title: `${getFactionDisplayName(slug)} — Infinity Changelog`,
        body: body,
        sidebar: buildSidebar(slugs, slug),
    });
    fs.writeFileSync(path.join(OUT_DIR, `${slug}.html`), html);
}

// 3. Combined Page (All in one)
const combinedBody = `
<h1>All Factions — Infinity Patch Notes</h1>
<p style="color:var(--fg-muted);">Single-page view of all faction profile and loadout changes. Use browser search (Ctrl+F) to find any unit or weapon.</p>
${combinedSections.join('\n')}
`;
const combinedHtml = renderHtmlPage({
    title: 'All Factions — Infinity Patch Notes',
    body: combinedBody,
    sidebar: buildSidebar(slugs, 'combined'),
});
fs.writeFileSync(path.join(OUT_DIR, 'combined.html'), combinedHtml);

console.log(`Rendered clean static site to ${OUT_DIR}`);
console.log(`Factions: ${slugs.length}, Index: index.html, Combined: combined.html`);
