import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { englishPages } from '../../src/i18n/integration.mjs';
import { literalProblems } from '../../src/i18n/literals.mjs';
import { TRANSLATIONS } from '../../src/i18n/locales.mjs';
import { readPo } from '../../src/i18n/po.mjs';
import { DOCS, PO_DOCS, pageId } from '../../src/i18n/po4a.mjs';
import { updateTranslations } from '../../src/i18n/update.mjs';

// The gates a translation passes before the site is published. They run on
// the translation files in po/, which are all there is of a translation.

const repo = fileURLToPath(new URL('../../', import.meta.url));
const pages = englishPages(path.join(repo, DOCS));
const poFiles = (prefix) => [
    ...pages.map((page) => `${PO_DOCS}/${pageId(page)}/${prefix}.po`),
    `po/ui/${prefix}.po`,
];

describe('the translation files', () => {
    test('exist for every page in every language', () => {
        const missing = TRANSLATIONS.flatMap(({ prefix }) => poFiles(prefix)).filter((file) => !fs.existsSync(path.join(repo, file)));
        assert.deepEqual(missing, [], 'npm run i18n:update creates them');
    });

    // A person who changes an English page and forgets the update would
    // leave the translation at the old text, and no other gate would detect
    // it.
    describe('are up to date with the English text', () => {
        let copy;
        before(() => {
            copy = fs.mkdtempSync(path.join(os.tmpdir(), 'ditana-i18n-current-'));
            fs.cpSync(path.join(repo, DOCS), path.join(copy, DOCS), {
                recursive: true,
                filter: (source) => !TRANSLATIONS.some(({ prefix }) => source === path.join(repo, DOCS, prefix)),
            });
            fs.cpSync(path.join(repo, 'po'), path.join(copy, 'po'), { recursive: true });
            fs.cpSync(path.join(repo, 'src/content/i18n/en-GB.json'), path.join(copy, 'src/content/i18n/en-GB.json'));
            updateTranslations(copy);
        });
        after(() => fs.rmSync(copy, { recursive: true, force: true }));

        const units = (root, file) => readPo(path.join(root, file)).map(({ msgctxt, msgid, msgstr, fuzzy }) => ({ msgctxt, msgid, msgstr, fuzzy }));

        for (const { prefix } of TRANSLATIONS) {
            test(prefix, () => {
                const stale = poFiles(prefix).filter((file) => fs.existsSync(path.join(repo, file))
                    && JSON.stringify(units(repo, file)) !== JSON.stringify(units(copy, file)));
                assert.deepEqual(stale, [], 'run npm run i18n:update after changing an English page or en-GB.json');
            });
        }
    });
});

// An outdated translation is fuzzy; a new English passage is untranslated.
// Either blocks publishing: the site shows no page that says less, or
// something older, than the English one.
describe('nothing is left to translate', () => {
    for (const { prefix } of TRANSLATIONS) {
        test(prefix, () => {
            const open = [];
            for (const file of poFiles(prefix).filter((f) => fs.existsSync(path.join(repo, f)))) {
                for (const unit of readPo(path.join(repo, file))) {
                    if (unit.fuzzy) open.push(`${file}: fuzzy: ${unit.msgid.slice(0, 60)}`);
                    else if (!unit.msgstr) open.push(`${file}: untranslated: ${unit.msgid.slice(0, 60)}`);
                }
            }
            assert.equal(open.length, 0, `${open.length} open units:\n${open.slice(0, 20).join('\n')}`);
        });
    }
});

describe('every translation keeps the literals of its English text', () => {
    for (const { prefix } of TRANSLATIONS) {
        test(prefix, () => {
            const problems = [];
            for (const file of poFiles(prefix).filter((f) => fs.existsSync(path.join(repo, f)))) {
                for (const unit of readPo(path.join(repo, file))) {
                    for (const problem of literalProblems(unit)) problems.push(`${file}: ${unit.msgid.slice(0, 50)}…: ${problem}`);
                }
            }
            assert.deepEqual(problems, []);
        });
    }
});
