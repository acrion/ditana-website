import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { splitFrontmatter } from '../release/read-release-notes.mjs';
import { headingIds, withEnglishIds } from './headings.mjs';
import { englishPages } from './integration.mjs';
import { TRANSLATIONS } from './locales.mjs';
import { DOCS, PO_DOCS, pageId, runPo4a } from './po4a.mjs';

// The translated pages and interface strings are not kept in the repository:
// the PO files are the sole location where a translation lives, and everything
// a build reads is written from them here, when astro.config.mjs is evaluated.
// An error here therefore stops the build, which an error while a page is
// rendered would not.
//
//   src/content/docs/<prefix>/…   po4a's output, with the English frontmatter
//                                 and the English heading ids put back
//   src/content/i18n/<lang>.json  the interface strings, from po/ui/<prefix>.po
//
// A digest of everything that goes in is kept next to the output, and nothing
// is written again when it matches.

export const UI_TEMPLATE = 'src/content/i18n/en-GB.json';
export const PO_UI = 'po/ui';
const DIGEST = 'src/content/.i18n-digest';

const TRANSLATED_KEYS = ['title', 'description'];

/**
 * The English frontmatter containing the translated title and description.
 * po4a writes the frontmatter from scratch and loses along the way what YAML
 * alone does not keep, such as the quotes that make `version: '0.9'` a
 * string.
 */
export function withEnglishFrontmatter(translated, english, where = 'page') {
    const translatedData = yaml.load(splitFrontmatter(translated).frontmatter) ?? {};
    const { frontmatter } = splitFrontmatter(english);
    if (!frontmatter) return translated;
    const lines = frontmatter.split('\n');
    for (const key of TRANSLATED_KEYS) {
        const index = lines.findIndex((line) => line.startsWith(`${key}:`));
        if (index === -1 || translatedData[key] === undefined) continue;
        if (/^\s/.test(lines[index + 1] ?? '') || /:\s*[|>]/.test(lines[index])) {
            throw new Error(`${where}: the English ${key} spans several lines; write it on one`);
        }
        lines[index] = `${key}: ${JSON.stringify(translatedData[key])}`;
    }
    return `---\n${lines.join('\n')}\n---\n${splitFrontmatter(translated).body}`;
}

function digestOf(root, pages, extra) {
    const hash = createHash('sha256').update(JSON.stringify(extra));
    const add = (file) => hash.update(file).update(fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file)) : '');
    for (const page of pages) add(`${DOCS}/${page}`);
    for (const file of fs.globSync('po/**/*.{po,pot}', { cwd: root }).toSorted()) add(file);
    add(UI_TEMPLATE);
    for (const file of fs.readdirSync(path.dirname(fileURLToPath(import.meta.url))).toSorted()) {
        add(path.relative(root, path.join(path.dirname(fileURLToPath(import.meta.url)), file)));
    }
    return hash.digest('hex');
}

function uiStrings(root) {
    for (const { prefix, lang } of TRANSLATIONS) {
        const out = path.join(root, 'src/content/i18n', `${lang}.json`);
        fs.rmSync(out, { force: true });
        const po = path.join(root, PO_UI, `${prefix}.po`);
        if (!fs.existsSync(po)) continue;
        const result = spawnSync('po2json', ['--progress=none', '-t', path.join(root, UI_TEMPLATE), '-i', po, '-o', out], { encoding: 'utf8' });
        if (result.error) throw new Error(`po2json could not be run: ${result.error.message}`);
        if (result.status !== 0) throw new Error(`po2json failed on ${PO_UI}/${prefix}.po:\n${result.stderr}`);
    }
}

/**
 * Writes the translated pages and interface strings of the site at `rootDir`.
 * `substitute` fills in the release placeholders of a heading, as the page
 * will show it, so that its id is the one Astro assigns to the English
 * heading.
 */
export function generateTranslations(rootDir, { substitute = (text) => text } = {}) {
    const root = path.resolve(rootDir instanceof URL ? fileURLToPath(rootDir) : rootDir);
    const docs = path.join(root, DOCS);
    const pages = englishPages(docs);
    const idsOf = Object.fromEntries(pages.map((page) => [page, headingIds(fs.readFileSync(path.join(docs, page), 'utf8'), {
        mdx: page.endsWith('.mdx'),
        substitute: (text) => substitute(text, page),
    })]));
    const digest = digestOf(root, pages, idsOf);
    const digestFile = path.join(root, DIGEST);
    if (fs.existsSync(digestFile) && fs.readFileSync(digestFile, 'utf8') === digest) return { written: false };

    fs.rmSync(digestFile, { force: true });
    for (const { prefix } of TRANSLATIONS) fs.rmSync(path.join(docs, prefix), { recursive: true, force: true });

    const withPo = pages.filter((page) => fs.existsSync(path.join(root, PO_DOCS, pageId(page))));
    if (withPo.length > 0) runPo4a(root, withPo);
    for (const { prefix } of TRANSLATIONS) {
        for (const page of withPo) {
            const file = path.join(docs, prefix, page);
            if (!fs.existsSync(file)) continue;
            const where = `${prefix}/${page}`;
            const english = fs.readFileSync(path.join(docs, page), 'utf8');
            let text = withEnglishFrontmatter(fs.readFileSync(file, 'utf8'), english, where);
            text = withEnglishIds(text, idsOf[page], { mdx: page.endsWith('.mdx'), where });
            fs.writeFileSync(file, text);
        }
    }
    uiStrings(root);
    fs.writeFileSync(digestFile, digest);
    return { written: true };
}

