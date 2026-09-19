import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownToHtml, mdxToHast } from 'satteri';
import { splitFrontmatter } from '../../src/release/read-release-notes.mjs';
import { englishPages } from '../../src/i18n/integration.mjs';
import { DOCS, runPo4a } from '../../src/i18n/po4a.mjs';

// po4a cuts each page into units and puts the translations back together.
// Reassembled from no translations at all, every English page must render
// exactly as it does by itself: otherwise the manner in which po4a reads Markdown has changed
// something that no translator can see, in every language simultaneously.
// This was true for po4a 0.74 with --width -1; at its default width it
// re-wraps paragraphs, and a wrapped line may begin with "- " or "1. ".

const repo = fileURLToPath(new URL('../../', import.meta.url));
const pages = englishPages(path.join(repo, DOCS));

describe('an English page taken apart by po4a and put back together', () => {
    let copy;
    before(() => {
        copy = fs.mkdtempSync(path.join(os.tmpdir(), 'ditana-roundtrip-'));
        for (const page of pages) {
            fs.mkdirSync(path.dirname(path.join(copy, DOCS, page)), { recursive: true });
            fs.copyFileSync(path.join(repo, DOCS, page), path.join(copy, DOCS, page));
        }
        runPo4a(copy, pages, { update: true, prefixes: ['xx'] });
        runPo4a(copy, pages, { prefixes: ['xx'] });
    });
    after(() => fs.rmSync(copy, { recursive: true, force: true }));

    const html = async (file, mdx) => {
        const { body } = splitFrontmatter(fs.readFileSync(file, 'utf8'));
        const out = mdx ? JSON.stringify(mdxToHast(body), (key, value) => (key === 'position' ? undefined : value))
            : (await markdownToHtml(body)).html;
        return out.replace(/\s+/g, ' ');
    };

    for (const page of pages) {
        test(`renders as before: ${page}`, async () => {
            const mdx = page.endsWith('.mdx');
            const english = await html(path.join(copy, DOCS, page), mdx);
            const back = await html(path.join(copy, DOCS, 'xx', page), mdx);
            // po4a joins the lines within the import block into one line.
            const normal = (text) => text.replace(/;\s*import /g, ';\nimport ').replace(/\\n/g, ' ').replace(/\s+/g, ' ');
            assert.equal(mdx ? normal(back) : back, mdx ? normal(english) : english);
        });
    }
});
