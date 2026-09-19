import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TRANSLATIONS } from './locales.mjs';

// po4a converts every English page into a POT file and maintains a separate
// PO file for each language adjacent to it; Weblate works on those. The
// configuration is written from the existing pages, so a new page needs no
// entry anywhere.
//
//   po/docs/<page>/<page>.pot      the English units of one page
//   po/docs/<page>/<prefix>.po     their translation into one language
//
// References name the file only, not the line: with line numbers, every
// English edit would touch every PO file of the page in every language. For
// the same reason no tool wraps the strings of a PO file: po4a, msgmerge and
// Weblate each wrap at a column of their own, and every pass would re-wrap
// whole files. Weblate's format for these is "gettext PO file (unwrapped)".

export const DOCS = 'src/content/docs';
export const PO_DOCS = 'po/docs';

/** "troubleshooting/updating.md" → "troubleshooting-updating", "index.mdx" → "index" */
export const pageId = (page) => page.replace(/\.mdx?$/, '').replaceAll('/', '-');

export function checkPageIds(pages) {
    const seen = new Map();
    for (const page of pages) {
        const id = pageId(page);
        if (seen.has(id)) throw new Error(`${seen.get(id)} and ${page} would share the translation files po/docs/${id}/`);
        seen.set(id, page);
    }
}

export function po4aConfig(pages, prefixes = TRANSLATIONS.map(({ prefix }) => prefix)) {
    checkPageIds(pages);
    const lines = [
        `[po4a_langs] ${prefixes.join(' ')}`,
        `[po4a_paths] ${PO_DOCS}/$master/$master.pot $lang:${PO_DOCS}/$master/$lang.po`,
        // Every paragraph on one line: wrapped, a translated sentence could put
        // "- " or "1. " at the start of a line and turn itself into a list.
        // po4a 0.74 wraps after every word at --width 0; -1 means never.
        '[options] opt:"--width -1 --wrap-po no --keep 0 --porefs file --master-charset UTF-8 --localized-charset UTF-8'
            + ' --copyright-holder \'acrion innovations GmbH\' --package-name \'Ditana website\'"',
    ];
    for (const page of pages) {
        lines.push(`[type: text] ${DOCS}/${page} $lang:${DOCS}/$lang/${page} pot=${pageId(page)}`
            + ' opt:"-o markdown -o yfm_keys=title,description"');
    }
    return `${lines.join('\n')}\n`;
}

/**
 * Runs po4a in `root` on the given pages. `update` refreshes the POT and PO
 * files from the English pages; omitting it means only the translated pages
 * are written, and the translation files remain unchanged.
 */
export function runPo4a(root, pages, { update = false, prefixes } = {}) {
    for (const page of pages) fs.mkdirSync(path.join(root, PO_DOCS, pageId(page)), { recursive: true });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ditana-po4a-'));
    try {
        const config = path.join(dir, 'po4a.cfg');
        fs.writeFileSync(config, po4aConfig(pages, prefixes));
        const args = update ? ['--no-translations', config] : ['--no-update', config];
        const result = spawnSync('po4a', args, { cwd: root, encoding: 'utf8' });
        if (result.error) throw new Error(`po4a could not be run: ${result.error.message}`);
        if (result.status !== 0) throw new Error(`po4a failed:\n${result.stderr}${result.stdout}`);
        return result;
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
