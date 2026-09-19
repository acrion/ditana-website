import fs from 'node:fs';
import path from 'node:path';

// Every link within a built site, checked against the build files: the page
// it points to exists, and so does the anchor. A translated page links to
// pages in its own language and to English anchors, so a link that works in
// English may still break in one language.

// Served by the server, not by this site: the package pipeline writes the
// build history, and the images are uploaded beside the site.
const ELSEWHERE = [/^\/build-history\//, /^\/downloads\//, /^\/versions\//, /^\/ditana\//, /^\/ditana-testing\//, /^\/package-resources\//];

const idsOf = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));

export function brokenLinks(outDir) {
    const pages = fs.globSync('**/*.html', { cwd: outDir }).filter((file) => !file.startsWith('pagefind/'));
    const cache = new Map();
    const read = (file) => {
        if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(outDir, file), 'utf8'));
        return cache.get(file);
    };
    const broken = [];
    for (const page of pages) {
        const html = read(page);
        const base = `/${page.replace(/index\.html$/, '')}`;
        for (const [, href] of html.matchAll(/<a\s[^>]*?href="([^"]+)"/g)) {
            if (/^(https?:|mailto:|\/\/)/.test(href)) continue;
            const url = new URL(href.replaceAll('&amp;', '&'), `https://site${base}`);
            if (ELSEWHERE.some((re) => re.test(url.pathname))) continue;
            let target = decodeURIComponent(url.pathname).replace(/^\//, '');
            if (target === '' || target.endsWith('/')) target += 'index.html';
            if (!fs.existsSync(path.join(outDir, target))) {
                // Astro's redirects are pages of their own; a missing file is a missing page.
                broken.push(`${page}: ${href} (no page)`);
                continue;
            }
            const anchor = decodeURIComponent(url.hash.slice(1));
            if (anchor && target.endsWith('.html') && !idsOf(read(target)).has(anchor)) {
                broken.push(`${page}: ${href} (no anchor #${anchor})`);
            }
        }
    }
    return broken;
}
