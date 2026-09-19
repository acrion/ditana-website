import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTranslations, withEnglishFrontmatter } from '../../src/i18n/generate.mjs';
import { checkTranslation } from '../../src/i18n/check.mjs';
import { exportUnits, importUnits } from '../../src/i18n/units.mjs';
import { openUnits, updateTranslations } from '../../src/i18n/update.mjs';

// The translation files of a small site, taken through what a maintainer and
// a translator perform: the update following an English change, a translation,
// and the generation that each build runs. po4a, msgmerge and po2json are the
// actual tools; the site consists of two pages and the interface strings.

const repo = fileURLToPath(new URL('../../', import.meta.url));

const PAGE = `---
title: Updating
description: Why and how.
---

Update everything or nothing. See [the keyring](/troubleshooting/signature-errors/#the-repair).

## The \`pacman\` way

\`\`\`sh
sudo pacman -Syu
\`\`\`

## After the update

Reboot.
`;

const MDX = `---
title: Who we are
---

import { Image } from 'astro:assets';
import stefan from '~/assets/people/stefan.png';

## Stefan

<Image src={stefan} alt="Stefan" width={150} />

The lead developer.
`;

const NOTES = `---
title: 0.9 Beta release notes
release:
  version: '0.9'
  label: Beta
  date: 2024-12-31
---

The first release.
`;

function site() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ditana-i18n-pipeline-'));
    const write = (file, text) => {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), text);
    };
    write('src/content/docs/troubleshooting/updating.md', PAGE);
    write('src/content/docs/who-we-are.mdx', MDX);
    write('src/content/docs/release-notes/0-9-0-beta.md', NOTES);
    fs.cpSync(path.join(repo, 'src/content/i18n/en-GB.json'), path.join(root, 'src/content/i18n/en-GB.json'));
    return { root, write, read: (file) => fs.readFileSync(path.join(root, file), 'utf8'), exists: (file) => fs.existsSync(path.join(root, file)) };
}

/** A PO file featuring every string on one line, as msgcat writes it. */
const unwrapped = (s, file) => spawnSync('msgcat', ['--no-wrap', path.join(s.root, file)], { encoding: 'utf8' }).stdout;

/** Sets the translation of the unit whose msgid is `msgid`, as a translator would. */
function translate(file, msgid, msgstr) {
    const text = fs.readFileSync(file, 'utf8');
    const quoted = (value) => JSON.stringify(value);
    const entry = new RegExp(`(msgid ${quoted(msgid).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\nmsgstr )""`);
    assert.match(text, entry, `${msgid} in ${file}`);
    fs.writeFileSync(file, text.replace(entry, `$1${quoted(msgstr)}`));
}

describe('the update after an English change', () => {
    let s;
    before(() => {
        s = site();
        updateTranslations(s.root);
    });
    after(() => fs.rmSync(s.root, { recursive: true, force: true }));

    test('writes a POT per page and a PO per page and language', () => {
        assert.ok(s.exists('po/docs/troubleshooting-updating/troubleshooting-updating.pot'));
        for (const prefix of ['de-ch', 'fr-ch', 'it-ch', 'rm', 'es-419', 'uk']) {
            assert.ok(s.exists(`po/docs/troubleshooting-updating/${prefix}.po`), prefix);
            assert.ok(s.exists(`po/ui/${prefix}.po`), prefix);
        }
        assert.ok(s.exists('po/ui/ui.pot'));
    });

    // With line numbers, each English edit would touch each PO file.
    test('references pages by file, not by line', () => {
        assert.match(s.read('po/docs/troubleshooting-updating/de-ch.po'), /^#: src\/content\/docs\/troubleshooting\/updating\.md$/m);
    });

    test('names no path of the machine it ran on', () => {
        for (const file of fs.globSync('po/**/*.{po,pot}', { cwd: s.root })) {
            assert.doesNotMatch(s.read(file), new RegExp(os.tmpdir().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), file);
        }
    });

    test('translates code as itself', () => {
        assert.match(unwrapped(s, 'po/docs/troubleshooting-updating/de-ch.po'), /msgid "sudo pacman -Syu\\n"\nmsgstr "sudo pacman -Syu\\n"/);
        const mdx = unwrapped(s, 'po/docs/who-we-are/rm.po');
        assert.match(mdx, /msgid "<Image src=\{stefan\} alt=\\"Stefan\\" width=\{150\} \/>\\n"\nmsgstr "<Image src/);
        assert.match(mdx, /msgid "import \{ Image \} from 'astro:assets'; import stefan from '~\/assets\/people\/stefan\.png';"\nmsgstr "import \{ Image/);
    });

    test('leaves the prose to translate', () => {
        const open = openUnits(s.root).find(({ po }) => po === 'po/docs/troubleshooting-updating/de-ch.po');
        // title, description, a paragraph, two headings, a paragraph
        assert.deepEqual(open, { po: 'po/docs/troubleshooting-updating/de-ch.po', fuzzy: 0, untranslated: 6 });
    });

    test('marks a translated unit whose English changed as fuzzy, keeping the old translation', () => {
        const po = path.join(s.root, 'po/docs/troubleshooting-updating/de-ch.po');
        translate(po, 'Reboot.', 'Neu starten.');
        s.write('src/content/docs/troubleshooting/updating.md', PAGE.replace('Reboot.', 'Reboot now.'));
        updateTranslations(s.root);
        assert.match(s.read('po/docs/troubleshooting-updating/de-ch.po'), /#, fuzzy\n#\| msgid "Reboot\."\nmsgid "Reboot now\."\nmsgstr "Neu starten\."/);
    });

    test('removes the translations of a page that no longer exists', () => {
        fs.rmSync(path.join(s.root, 'src/content/docs/who-we-are.mdx'));
        const { removed } = updateTranslations(s.root);
        assert.deepEqual(removed, ['who-we-are']);
        assert.ok(!s.exists('po/docs/who-we-are'));
    });

    test('leaves the interface template alone when no string changed', () => {
        const before = s.read('po/ui/ui.pot');
        updateTranslations(s.root);
        assert.equal(s.read('po/ui/ui.pot'), before);
    });
});

describe('the generation before every build', () => {
    let s;
    before(() => {
        s = site();
        updateTranslations(s.root);
        const po = path.join(s.root, 'po/docs/troubleshooting-updating/de-ch.po');
        translate(po, 'Updating', 'Aktualisieren');
        translate(po, 'The `pacman` way', 'Der `pacman`-Weg');
        translate(po, 'After the update', 'Nach dem Update');
        translate(path.join(s.root, 'po/docs/release-notes-0-9-0-beta/de-ch.po'), '0.9 Beta release notes', 'Versionshinweise zu 0.9 Beta');
        translate(path.join(s.root, 'po/ui/de-ch.po'), 'Search', 'Suchen');
        generateTranslations(s.root);
    });
    after(() => fs.rmSync(s.root, { recursive: true, force: true }));

    test('writes each page in each language', () => {
        for (const prefix of ['de-ch', 'fr-ch', 'it-ch', 'rm', 'es-419', 'uk']) {
            assert.ok(s.exists(`src/content/docs/${prefix}/troubleshooting/updating.md`), prefix);
            assert.ok(s.exists(`src/content/docs/${prefix}/who-we-are.mdx`), prefix);
        }
    });

    test('puts the translation in', () => {
        const page = s.read('src/content/docs/de-ch/troubleshooting/updating.md');
        assert.match(page, /^title: "Aktualisieren"$/m);
        assert.match(page, /^## Der `pacman`-Weg \{#the-pacman-way\}$/m);
    });

    // An untranslated unit shows the English text; the completeness gate
    // keeps such a page from being published.
    test('shows English where a unit is not translated', () => {
        assert.match(s.read('src/content/docs/fr-ch/troubleshooting/updating.md'), /^## The `pacman` way \{#the-pacman-way\}$/m);
    });

    test('keeps the English frontmatter apart from what is translated', () => {
        const notes = s.read('src/content/docs/de-ch/release-notes/0-9-0-beta.md');
        assert.match(notes, /^title: "Versionshinweise zu 0\.9 Beta"$/m);
        assert.match(notes, /^ {2}version: '0\.9'$/m);
        assert.match(notes, /^ {2}date: 2024-12-31$/m);
    });

    test('writes the interface strings of each language', () => {
        const strings = JSON.parse(s.read('src/content/i18n/de-CH.json'));
        assert.equal(strings['search.label'], 'Suchen');
    });

    test('writes nothing again while nothing changed', () => {
        assert.deepEqual(generateTranslations(s.root), { written: false });
    });

    test('writes again once a translation changed', () => {
        translate(path.join(s.root, 'po/docs/troubleshooting-updating/de-ch.po'), 'Reboot.', 'Neu starten.');
        assert.deepEqual(generateTranslations(s.root), { written: true });
        assert.match(s.read('src/content/docs/de-ch/troubleshooting/updating.md'), /^Neu starten\.$/m);
    });

    // Written by hand into a generated directory, a page would be deleted
    // with the next change; the PO files are the only place for it.
    test('leaves nothing in a language directory that the PO files do not say', () => {
        s.write('src/content/docs/de-ch/stray.md', '---\ntitle: Stray\n---\n');
        s.write('src/content/docs/troubleshooting/updating.md', PAGE.replace('Reboot.', 'Reboot now.'));
        generateTranslations(s.root);
        assert.ok(!s.exists('src/content/docs/de-ch/stray.md'));
    });
});

describe('translations put back into the PO files', () => {
    let s;
    const po = 'po/docs/troubleshooting-updating/de-ch.po';
    before(() => {
        s = site();
        updateTranslations(s.root);
        translate(path.join(s.root, po), 'Reboot.', 'Neu starten.');
        s.write('src/content/docs/troubleshooting/updating.md', PAGE.replace('Reboot.', 'Reboot now.'));
        updateTranslations(s.root);
    });
    after(() => fs.rmSync(s.root, { recursive: true, force: true }));

    test('are listed with what changed, code left out', () => {
        const open = exportUnits(s.root, 'de-ch', { open: true }).filter(({ file }) => file === po);
        // po4a lists the frontmatter keys in alphabetical
        // order.
        assert.deepEqual(open.map(({ msgid }) => msgid), ['Why and how.', 'Updating',
            'Update everything or nothing. See [the keyring](/troubleshooting/signature-errors/#the-repair).',
            'The `pacman` way', 'After the update', 'Reboot now.']);
        assert.deepEqual(open.at(-1), { file: po, type: 'Plain text', msgid: 'Reboot now.', msgstr: 'Neu starten.', fuzzy: true, previous: 'Reboot.' });
    });

    test('fill a unit, replace an outdated one, and correct a translated one', () => {
        importUnits(s.root, [
            { file: po, msgid: 'Updating', msgstr: 'Aktualisieren' },
            { file: po, msgid: 'Reboot now.', msgstr: 'Jetzt neu starten.' },
        ]);
        importUnits(s.root, [{ file: po, msgid: 'Updating', msgstr: 'Aktualisierung' }]);
        const units = exportUnits(s.root, 'de-ch').filter(({ file }) => file === po);
        assert.equal(units.find(({ msgid }) => msgid === 'Updating').msgstr, 'Aktualisierung');
        assert.deepEqual(units.find(({ msgid }) => msgid === 'Reboot now.'), { file: po, type: 'Plain text', msgid: 'Reboot now.', msgstr: 'Jetzt neu starten.' });
    });

    test('keep the header, the order of the units, and the code', () => {
        const text = s.read(po);
        assert.match(text, /^# Language de-ch translations for Ditana website package/);
        assert.match(text, /"Language: de-ch\\n"/);
        const ids = [...text.matchAll(/^msgid "(.*)"$/gm)].map((match) => match[1]).filter(Boolean);
        assert.deepEqual(ids.slice(0, 3), ['Why and how.', 'Updating', 'Update everything or nothing. See [the keyring](/troubleshooting/signature-errors/#the-repair).']);
        assert.match(unwrapped(s, po), /msgid "sudo pacman -Syu\\n"\nmsgstr "sudo pacman -Syu\\n"/);
    });

    // gettext and po4a refuse such a file, and with it the build.
    test('refuse a translation that ends differently from the English', () => {
        assert.throws(() => importUnits(s.root, [{ file: po, msgid: 'sudo pacman -Syu\n', msgstr: 'sudo pacman -Syu' }]), /must end with a line break/);
        assert.throws(() => importUnits(s.root, [{ file: po, msgid: 'Reboot now.', msgstr: 'Jetzt neu starten.\n' }]), /must not end with a line break/);
    });

    test('refuse a unit the file does not have', () => {
        assert.throws(() => importUnits(s.root, [{ file: po, msgid: 'No such text.', msgstr: 'X' }]), /has no unit "No such text\."/);
    });
});

describe('the check of a translation', () => {
    // A file gettext refuses stops po4a, and every build with it; written by
    // hand or by a tool other than i18n:units, one can still arrive.
    test('reports a PO file gettext refuses', () => {
        const s = site();
        try {
            updateTranslations(s.root);
            const po = path.join(s.root, 'po/docs/troubleshooting-updating/rm.po');
            fs.writeFileSync(po, fs.readFileSync(po, 'utf8').replace('msgid "sudo pacman -Syu\\n"\nmsgstr "sudo pacman -Syu\\n"', 'msgid "sudo pacman -Syu\\n"\nmsgstr "sudo pacman -Syu"'));
            assert.ok(checkTranslation(s.root, 'rm').some((problem) => /troubleshooting-updating\/rm\.po: invalid: .*end with/.test(problem)));
        } finally {
            fs.rmSync(s.root, { recursive: true, force: true });
        }
    });
});

describe('the frontmatter of a translated page', () => {
    test('is the English one with the translated title and description', () => {
        const english = '---\ntitle: \'Updating\'\ndescription: Why.\nrelease:\n  version: \'0.9\'\n---\n\nBody.\n';
        const po4a = '---\ndescription: Warum.\nrelease:\n  version: 0.9\ntitle: Aktualisieren\n---\n\nText.\n';
        assert.equal(withEnglishFrontmatter(po4a, english),
            '---\ntitle: "Aktualisieren"\ndescription: "Warum."\nrelease:\n  version: \'0.9\'\n---\n\nText.\n');
    });

    test('refuses an English title written over several lines', () => {
        assert.throws(() => withEnglishFrontmatter('---\ntitle: X\n---\n', '---\ntitle: >\n  Long\n---\n', 'x.md'), /x\.md: the English title spans several lines/);
    });
});

describe('po4a itself', () => {
    test('is installed with what its Markdown support needs', () => {
        // Arch's po4a 0.74 does not depend on perl-syntax-keyword-try, which
        // Locale::Po4a::Text loads; without it, po4a reports only "Unknown
        // format type: text".
        const result = spawnSync('perl', ['-MLocale::Po4a::Text', '-e', '1'], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
    });
});
