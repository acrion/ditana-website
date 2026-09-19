import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitFrontmatter } from '../../src/release/read-release-notes.mjs';
import { englishPages } from '../../src/i18n/integration.mjs';
import { isCodeUnit } from '../../src/i18n/literals.mjs';
import { TRANSLATIONS } from '../../src/i18n/locales.mjs';
import { readPo } from '../../src/i18n/po.mjs';
import { DOCS } from '../../src/i18n/po4a.mjs';
import { languageTool } from '../../src/i18n/languagetool.mjs';
import { DICTIONARIES, englishProseOf, misspelled, misspelledUnits, proseOf, vocabulary } from '../../src/i18n/spelling.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));

describe('the prose of a unit', () => {
    test('leaves out code, link targets, addresses and markup', () => {
        assert.equal(proseOf('Run `pacman -Syu`, see [the notes](/release-notes/) or https://ditana.org, **now**.').replace(/\s+/g, ' ').trim(),
            'Run , see the notes or now .');
    });

    test('leaves out paths, file names, domains and words with digits', () => {
        assert.equal(proseOf('Edit /etc/pacman.conf and *.pacnew on gnulinux.ch for ARM64 and 470xx.').replace(/\s+/g, ' ').trim(),
            'Edit and on for and .');
    });

    test('in English, reads a possessive as its noun', () => {
        assert.equal(englishProseOf('Ditana’s installer and pacman\'s lock'), 'Ditana installer and pacman lock');
    });
});

describe('the spelling check of many units', () => {
    const repo = fileURLToPath(new URL('../../', import.meta.url));

    // One run of hunspell for all units; each word is reported with the
    // units it occurs in, and only as a whole word.
    test('names the unit of each unknown word', () => {
        assert.deepEqual(misspelledUnits(repo, 'de-CH', [
            { where: 'a', text: 'Die Dattei ist da.' },
            { where: 'b', text: 'Alles gut.' },
            { where: 'c', text: 'Noch eine Dattei, nach der Aktualisirung.' },
        ]), [{ where: 'a', word: 'Dattei' }, { where: 'c', word: 'Dattei' }, { where: 'c', word: 'Aktualisirung' }]);
    });
});

describe('the spelling check of a translation', () => {
    const repo = fileURLToPath(new URL('../../', import.meta.url));

    // Technical text keeps English terms and the English labels of the
    // programs it describes.
    test('accepts a word the English dictionary knows', () => {
        assert.deepEqual(misspelled(repo, 'es-419', 'Siga los commits del hook en Advanced Settings.'), []);
    });

    test('still finds a word neither language knows', () => {
        assert.deepEqual(misspelled(repo, 'es-419', 'Siga los comitts del hookk.'), ['comitts', 'hookk']);
    });

    // hunspell's it_CH, from 2007, lacks elided forms.
    test('knows the Italian elisions before an apostrophe', () => {
        assert.deepEqual(misspelled(repo, 'it-CH', 'Al termine dell’installazione, nell’avvio e all’utente.'), []);
    });
});

describe('the English text', () => {
    const texts = [
        ...englishPages(path.join(repo, DOCS)).map((page) => [page, splitFrontmatter(fs.readFileSync(path.join(repo, DOCS, page), 'utf8')).body]),
        ['en-GB.json', Object.values(JSON.parse(fs.readFileSync(path.join(repo, 'src/content/i18n/en-GB.json'), 'utf8'))).join('\n')],
    ].filter(([page]) => !page.endsWith('.mdx'));

    test('is spelt as en_GB and the project vocabulary have it', () => {
        const unknown = texts.flatMap(([page, text]) => misspelled(repo, 'en-GB', englishProseOf(text)).map((word) => `${page}: ${word}`));
        assert.deepEqual(unknown, [], 'correct the word, or add it to i18n/vocabulary/ once you have looked at it');
    });

    // British spelling with -ize where the ending comes from Greek -izein:
    // organize, but analyse. hunspell's en_GB accepts both, and lacks some
    // -ize forms entirely; LanguageTool has a rule for exactly this.
    test('uses Oxford spelling', () => {
        const matches = languageTool(texts.map(([where, text]) => ({ where, text: proseOf(text) })), 'en-GB', { only: ['OXFORD_SPELLING_Z_NOT_S'] });
        assert.deepEqual(matches.map(({ where, found, replacements }) => `${where}: ${found} → ${replacements[0]}`), []);
    });
});

describe('the spelling of each translation', () => {
    const poFiles = fs.globSync('po/**/*.po', { cwd: repo }).toSorted();
    for (const { prefix, lang } of TRANSLATIONS.filter(({ lang }) => DICTIONARIES[lang])) {
        test(prefix, () => {
            const units = poFiles.filter((f) => path.basename(f) === `${prefix}.po`).flatMap((file) => readPo(path.join(repo, file))
                .filter((unit) => unit.msgstr && !unit.fuzzy && !isCodeUnit(unit))
                .map((unit) => ({ where: `${file}: ${unit.msgstr.slice(0, 60)}…`, text: proseOf(unit.msgstr) })));
            const unknown = misspelledUnits(repo, lang, units).map(({ where, word }) => `${where}: ${word}`);
            assert.deepEqual(unknown, [], 'correct the word, or add it to i18n/vocabulary/ once you have looked at it');
        });
    }
});

// There is no Ukrainian hunspell dictionary available on Arch; LanguageTool's
// internal speller for Ukrainian is thorough, and the vocabulary is applied
// to what it reports.
describe('the spelling of the Ukrainian translation', () => {
    test('uk', () => {
        const known = new Set(vocabulary(repo, 'uk'));
        const units = fs.globSync('po/**/uk.po', { cwd: repo }).toSorted().flatMap((file) => readPo(path.join(repo, file))
            .filter((unit) => unit.msgstr && !unit.fuzzy && !isCodeUnit(unit))
            .map((unit) => ({ where: file, text: proseOf(unit.msgstr) })));
        const unknown = languageTool(units, 'uk', { only: ['MORFOLOGIK_RULE_UK_UA'] })
            .filter(({ found }) => !known.has(found))
            .map(({ where, found }) => `${where}: ${found}`);
        assert.deepEqual(unknown, [], 'correct the word, or add it to i18n/vocabulary/ once you have looked at it');
    });
});
