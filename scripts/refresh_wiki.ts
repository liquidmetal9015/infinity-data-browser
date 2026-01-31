import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
// import fetch from 'node-fetch'; // Use native fetch
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data/wiki');
const BASE_URL = 'https://infinitythewiki.com';
const INDEX_URL = `${BASE_URL}/Special:AllPages`;

// Ensure data directory exists
await fs.mkdir(DATA_DIR, { recursive: true });

const turndownService = new TurndownService();

async function fetchPage(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    return await res.text();
}

async function processArticle(url: string, title: string) {
    // Derive slug from URL (e.g. https://infinitythewiki.com/Camouflage -> Camouflage)
    const urlObj = new URL(url);
    const urlSlug = urlObj.pathname.split('/').pop() || 'index';

    // Sanitize filename safe
    const safeFilename = urlSlug.replace(/[^a-zA-Z0-9_\-\.\(\)%]/g, '_');
    const filename = path.join(DATA_DIR, `${safeFilename}.md`);

    // Skip if recently cached? For now, overwrite to refresh.
    console.log(`Processing: ${title}`);

    try {
        const html = await fetchPage(url);
        const $ = cheerio.load(html);

        // Cleanup
        $('script').remove();
        $('style').remove();
        $('nav').remove();
        $('footer').remove();
        $('.mw-jump-link').remove();
        $('.printfooter').remove();
        $('#mw-navigation').remove();
        $('#mw-page-base').remove();
        $('#mw-head-base').remove();
        $('#siteNotice').remove();

        // Content
        const content = $('#mw-content-text').html() || $('body').html() || "";
        const markdown = turndownService.turndown(content);

        // Prepend metadata
        const fileContent = `# ${title}\n\nSource: ${url}\n\n${markdown}`;

        await fs.writeFile(filename, fileContent);
    } catch (e) {
        console.error(`Error processing ${title}:`, e);
    }
}

async function crawl() {
    console.log("Starting Wiki Crawl...");
    let nextUrl: string | null = INDEX_URL;
    const articles: { url: string, title: string }[] = [];

    // 1. Gather all links
    while (nextUrl) {
        console.log(`Scanning index: ${nextUrl}`);
        const html = await fetchPage(nextUrl);
        const $ = cheerio.load(html);

        // Find article links in the index list
        $('.mw-allpages-chunk a').each((_, el) => {
            const href = $(el).attr('href');
            const title = $(el).text();
            if (href && title) {
                articles.push({
                    url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
                    title
                });
            }
        });

        // Find Next Page link
        // Usually in .mw-allpages-nav a:contains("Next page")
        const nextLink = $('.mw-allpages-nav a').filter((_, el) => $(el).text().includes("Next page")).attr('href');

        if (nextLink) {
            nextUrl = nextLink.startsWith('http') ? nextLink : `${BASE_URL}${nextLink}`;
        } else {
            nextUrl = null;
        }
    }

    console.log(`Found ${articles.length} articles. Downloading contents...`);

    // 2. Download contents (seq or parallel chunks)
    // Be nice to the server, do strictly sequential with small delay?
    // Or small batches.
    for (const article of articles) {
        await processArticle(article.url, article.title);
        // await new Promise(r => setTimeout(r, 100)); // 100ms delay
    }

    console.log("Crawl complete.");
}

crawl().catch(console.error);
