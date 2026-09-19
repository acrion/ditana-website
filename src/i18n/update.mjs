import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { englishPages } from './integration.mjs';
import { TRANSLATIONS } from './locales.mjs';
import { DOCS, PO_DOCS, pageId, runPo4a } from './po4a.mjs';
import { PO_UI, UI_TEMPLATE } from './generate.mjs';

// After a change to the English text: brings every POT and PO file up to date,
// so that a changed unit is marked fuzzy and a new one is empty in every
// language. Both block publishing until someone has translated them.
//
// Units that are code, and stay code in every language, are filled in here
// with the English text: the fenced code blocks, and the imports and component
// tags of an MDX page. Nobody has to copy them by hand, and the literal guard
// insists that they stay as they are.

function run(command, args, options = {}) {
    const result = spawnSync(command, args, { encoding: 'utf8', ...options });
    if (result.error) throw new Error(`${command} could not be run: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr}${result.stdout}`);
    return result.stdout;
}

const HEADER_DATE = /^"POT-Creation-Date: .*\\n"$/m;

/** The POT of the interface strings, rewritten only when a string is changed. */
function updateUiTemplate(root) {
    const pot = path.join(root, PO_UI, 'ui.pot');
    fs.mkdirSync(path.dirname(pot), { recursive: true });
    const fresh = path.join(os.tmpdir(), `ditana-ui-${process.pid}.pot`);
    // Relative, so that the POT names the template and not this machine.
    run('json2po', ['--progress=none', '-P', '-i', UI_TEMPLATE, '-o', fresh], { cwd: root });
    run('msgcat', ['--no-wrap', '-o', fresh, fresh]);
    const text = fs.readFileSync(fresh, 'utf8');
    fs.rmSync(fresh);
    const old = fs.existsSync(pot) ? fs.readFileSync(pot, 'utf8') : '';
    if (old.replace(HEADER_DATE, '') !== text.replace(HEADER_DATE, '')) fs.writeFileSync(pot, text);
    return pot;
}

/** The locale msginit understands for a prefix: "de-ch" → "de_CH". */
const msginitLocale = (lang) => lang.replace('-', '_');

function updateUiTranslations(root, pot) {
    for (const { prefix, lang } of TRANSLATIONS) {
        const po = path.join(root, PO_UI, `${prefix}.po`);
        if (fs.existsSync(po)) run('msgmerge', ['--quiet', '--no-wrap', '--previous', '--backup=none', '-U', po, pot]);
        else run('msginit', ['--no-translator', '--no-wrap', '-l', msginitLocale(lang), '-i', pot, '-o', po]);
    }
}

/**
 * Every code unit of every POT, translated as itself: a compendium msgmerge
 * takes the translation of an untranslated unit from.
 */
function codeCompendium(root, dir) {
    const pots = fs.globSync(`${PO_DOCS}/*/*.pot`, { cwd: root }).toSorted();
    const out = path.join(dir, 'code.po');
    if (pots.length === 0) return null;
    const everything = path.join(dir, 'everything.pot');
    run('msgcat', ['--use-first', '-o', everything, ...pots], { cwd: root });
    const blocks = run('msggrep', ['-X', '-e', '^type: Fenced code block', everything]);
    const mdx = run('msggrep', ['-K', '-E', '-e', '^(import |export |<[A-Z])', everything]);
    fs.writeFileSync(path.join(dir, 'blocks.pot'), blocks);
    fs.writeFileSync(path.join(dir, 'mdx.pot'), mdx);
    run('msgcat', ['--use-first', '-o', path.join(dir, 'all.pot'), path.join(dir, 'blocks.pot'), path.join(dir, 'mdx.pot')]);
    run('msgen', ['-o', out, path.join(dir, 'all.pot')]);
    return out;
}

/** Brings the POT and PO files of the site at `root` up to date. */
export function updateTranslations(root) {
    const pages = englishPages(path.join(root, DOCS));
    runPo4a(root, pages, { update: true });

    // A page that has ceased to exist takes its translations with
    // it.
    const ids = new Set(pages.map(pageId));
    const removed = [];
    for (const dir of fs.existsSync(path.join(root, PO_DOCS)) ? fs.readdirSync(path.join(root, PO_DOCS)) : []) {
        if (!ids.has(dir)) {
            fs.rmSync(path.join(root, PO_DOCS, dir), { recursive: true });
            removed.push(dir);
        }
    }

    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ditana-i18n-'));
    try {
        const compendium = codeCompendium(root, work);
        if (compendium) {
            for (const id of ids) {
                const pot = path.join(root, PO_DOCS, id, `${id}.pot`);
                for (const { prefix } of TRANSLATIONS) {
                    const po = path.join(root, PO_DOCS, id, `${prefix}.po`);
                    // Exact matches only: po4a has already offered each changed
                    // unit its old translation, and a unit that merely resembles
                    // a code block must not receive one.
                    run('msgmerge', ['--quiet', '--no-wrap', '--previous', '--no-fuzzy-matching', '--backup=none', `--compendium=${compendium}`, '-U', po, pot]);
                }
            }
        }
    } finally {
        fs.rmSync(work, { recursive: true, force: true });
    }

    updateUiTranslations(root, updateUiTemplate(root));
    return { pages: pages.length, removed };
}

/** Untranslated and fuzzy units per PO file, for everything that is not done. */
export function openUnits(root) {
    const open = [];
    for (const po of fs.globSync('po/**/*.po', { cwd: root }).toSorted()) {
        const stats = spawnSync('msgfmt', ['--statistics', '-o', '/dev/null', po], { cwd: root, encoding: 'utf8' }).stderr;
        const fuzzy = Number(/(\d+) fuzzy/.exec(stats)?.[1] ?? 0);
        const untranslated = Number(/(\d+) untranslated/.exec(stats)?.[1] ?? 0);
        if (fuzzy || untranslated) open.push({ po, fuzzy, untranslated });
    }
    return open;
}
