// NodeDatabase - Node.js implementation using fs
// Extends BaseDatabase with file system data loading

import fs from 'fs/promises';
import path from 'path';
import type { DatabaseMetadata, WikiPage, ITSRules } from './types.js';
import { BaseDatabase, type FactionDataFile } from '../shared/BaseDatabase.js';

export class DatabaseAdapter extends BaseDatabase {
    private static instance: DatabaseAdapter;
    private dataDir: string;

    // Wiki Cache
    wikiPages: Map<string, WikiPage> = new Map();
    public wikiLoaded = false;

    // ITS Rules
    public itsRules: ITSRules | null = null;

    constructor() {
        super();
        this.dataDir = path.join(process.cwd(), 'data');
    }

    static getInstance(): DatabaseAdapter {
        if (!DatabaseAdapter.instance) {
            DatabaseAdapter.instance = new DatabaseAdapter();
        }
        return DatabaseAdapter.instance;
    }

    // ========================================================================
    // Platform-specific: Load via fs.readFile
    // ========================================================================

    protected async loadMetadata(): Promise<DatabaseMetadata> {
        const metaPath = path.join(this.dataDir, 'metadata.json');
        const metaContent = await fs.readFile(metaPath, 'utf-8');
        return JSON.parse(metaContent);
    }

    protected async loadFactionData(slug: string): Promise<FactionDataFile | null> {
        const filePath = path.join(this.dataDir, `${slug}.json`);
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    // Override init to use stderr for MCP server
    async init(): Promise<void> {
        if (this.metadata) return;
        console.error("Initializing DatabaseAdapter...");

        await super.init();

        // Load Optional Data
        await Promise.all([
            this.loadWiki(),
            this.loadITSRules(),
            this.loadRuleSummaries()
        ]);

        console.error(`Database loaded. ${this.units.length} units.`);
    }

    // ========================================================================
    // Wiki support - MCP-specific
    // ========================================================================

    async loadWiki(): Promise<void> {
        if (this.wikiLoaded) return;
        try {
            const wikiDir = path.join(this.dataDir, 'wiki');
            const files = await fs.readdir(wikiDir);

            await Promise.all(files.map(async (file) => {
                if (!file.endsWith('.md')) return;
                const content = await fs.readFile(path.join(wikiDir, file), 'utf-8');
                const slug = file.replace('.md', '');

                const titleMatch = content.match(/^# (.*)$/m);
                const title = titleMatch ? titleMatch[1].trim() : slug;

                const sourceMatch = content.match(/^Source: (.*)$/m);
                const url = sourceMatch ? sourceMatch[1].trim() : `https://infinitythewiki.com/${slug}`;

                this.wikiPages.set(slug, { slug, title, content, url });
            }));

            this.wikiLoaded = true;
            console.error(`Loaded ${this.wikiPages.size} wiki pages.`);
        } catch (e) {
            console.error("Failed to load wiki cache:", e);
        }
    }

    getWikiPage(urlOrSlug: string): WikiPage | undefined {
        if (this.wikiPages.has(urlOrSlug)) return this.wikiPages.get(urlOrSlug);

        try {
            const urlObj = new URL(urlOrSlug);
            const pathSlug = urlObj.pathname.split('/').pop() || 'index';
            const safeSlug = pathSlug.replace(/[^a-zA-Z0-9_\-\.\\(\\)%]/g, '_');
            if (this.wikiPages.has(safeSlug)) return this.wikiPages.get(safeSlug);
        } catch {
            const safeSlug = urlOrSlug.replace(/[^a-zA-Z0-9_\-\.\\(\\)%]/g, '_');
            if (this.wikiPages.has(safeSlug)) return this.wikiPages.get(safeSlug);
        }
        return undefined;
    }

    searchWiki(query: string): WikiPage[] {
        const q = query.toLowerCase();
        const results: { page: WikiPage, score: number }[] = [];

        for (const page of this.wikiPages.values()) {
            let score = 0;
            const titleLower = page.title.toLowerCase();

            if (titleLower === q) score += 100;
            else if (titleLower.startsWith(q)) score += 50;
            else if (titleLower.includes(q)) score += 20;

            if (page.content.toLowerCase().includes(q)) score += 5;

            if (score > 0) {
                results.push({ page, score });
            }
        }

        return results.sort((a, b) => b.score - a.score).map(r => r.page).slice(0, 10);
    }

    // ========================================================================
    // ITS Rules support - MCP-specific
    // ========================================================================

    async loadITSRules(): Promise<void> {
        if (this.itsRules) return;
        try {
            const rulesDir = path.join(this.dataDir, 'its_rules_markdown');
            const metaPath = path.join(rulesDir, 'its_rules_meta.json');
            const contentPath = path.join(rulesDir, 'its_rules.md');

            const [metaContent, mdContent] = await Promise.all([
                fs.readFile(metaPath, 'utf-8'),
                fs.readFile(contentPath, 'utf-8')
            ]);

            const meta = JSON.parse(metaContent);

            this.itsRules = {
                toc: meta.table_of_contents,
                content: mdContent
            };
            console.error("Loaded ITS Rules.");
        } catch (e) {
            console.error("Failed to load ITS Rules:", e);
        }
    }

    getITSRuleSection(query: string): { title: string; content: string } | null {
        if (!this.itsRules) return null;

        const q = query.toLowerCase();
        const section = this.itsRules.toc.find(t =>
            t.title.toLowerCase().includes(q) || q.includes(t.title.toLowerCase())
        );

        if (!section) return null;

        const startPage = section.page_id;
        const sectionIndex = this.itsRules.toc.indexOf(section);
        const nextSection = this.itsRules.toc[sectionIndex + 1];

        const startMarker = `<span id="page-${startPage}-0"></span>`;
        let startIndex = this.itsRules.content.indexOf(startMarker);

        if (startIndex === -1) {
            const titleHeader = `# ${section.title}`;
            startIndex = this.itsRules.content.indexOf(titleHeader);
        }
        if (startIndex === -1) startIndex = 0;

        let endIndex = this.itsRules.content.length;

        if (nextSection) {
            const nextMarker = `<span id="page-${nextSection.page_id}-0"></span>`;
            const nextIndex = this.itsRules.content.indexOf(nextMarker);
            if (nextIndex !== -1 && nextIndex > startIndex) {
                endIndex = nextIndex;
            } else {
                const nextTitle = `# ${nextSection.title}`;
                const nextTitleIndex = this.itsRules.content.indexOf(nextTitle);
                if (nextTitleIndex !== -1 && nextTitleIndex > startIndex) {
                    endIndex = nextTitleIndex;
                }
            }
        }

        const content = this.itsRules.content.substring(startIndex, endIndex);
        return { title: section.title, content: content.trim() };
    }

    searchITSRules(query: string): { header: string; snippet: string }[] {
        if (!this.itsRules) return [];

        const lines = this.itsRules.content.split('\n');
        const results: { header: string; snippet: string }[] = [];
        const q = query.toLowerCase();

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(q)) {
                const snippet = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 3)).join('\n');

                let header = "Unknown Section";
                for (let j = i; j >= 0; j--) {
                    if (lines[j].startsWith('#')) {
                        header = lines[j].replace(/#+\s*/, '');
                        break;
                    }
                }

                results.push({ header, snippet });
                i += 3;
            }
            if (results.length >= 5) break;
        }
        return results;
    }

    // ========================================================================
    // Rule Summaries support
    // ========================================================================

    async loadRuleSummaries(): Promise<void> {
        if (this.hasRuleSummaries()) return;
        try {
            const summaryPath = path.join(this.dataDir, 'rule_summaries.json');
            const content = await fs.readFile(summaryPath, 'utf-8');
            this.setRuleSummaries(JSON.parse(content));
            console.error("Loaded Rule Summaries.");
        } catch (e) {
            console.error("Failed to load Rule Summaries (this is optional):", e);
        }
    }
}
