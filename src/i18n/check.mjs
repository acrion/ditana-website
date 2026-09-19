import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { englishPages } from './integration.mjs';
import { languageTool } from './languagetool.mjs';
import { isCodeUnit, literalProblems } from './literals.mjs';
import { TRANSLATIONS } from './locales.mjs';
import { readPo } from './po.mjs';
import { DOCS, PO_DOCS, pageId } from './po4a.mjs';
import { DICTIONARIES, misspelledUnits, proseOf, vocabulary } from './spelling.mjs';
import { typographyProblems } from './typography.mjs';

// Everything a translation must go through before it is published, for
// one language: every unit translated and current, every literal kept,
// the typography of the language variant, and its spelling. The tests
// in test/i18n run the same checks; this is the same verdict as a
// report.

/** The problems of the translation into `prefix`, as lines naming file and unit. */
export function checkTranslation(root, prefix) {
    const { lang } = TRANSLATIONS.find((locale) => locale.prefix === prefix);
    const files = [
        ...englishPages(path.join(root, DOCS)).map((page) => `${PO_DOCS}/${pageId(page)}/${prefix}.po`),
        `po/ui/${prefix}.po`,
    ];
    const problems = [];
    const prose = [];
    for (const file of files) {
        if (!fs.existsSync(path.join(root, file))) {
            problems.push(`${file}: missing; npm run i18n:update creates it`);
            continue;
        }
        // A file gettext refuses stops po4a, and with it every build.
        const valid = spawnSync('msgfmt', ['-c', '-o', '/dev/null', file], { cwd: root, encoding: 'utf8' });
        if (valid.status !== 0) {
            for (const line of valid.stderr.split('\n').filter((l) => /: .*(error|entries|end with)/.test(l) && !/found \d+ fatal/.test(l))) {
                problems.push(`${file}: invalid: ${line.slice(line.indexOf(': ') + 2)}`);
            }
        }
        for (const unit of readPo(path.join(root, file))) {
            const where = `${file}: ${JSON.stringify(unit.msgid.slice(0, 60))}`;
            if (unit.fuzzy) problems.push(`${where}: outdated, the English changed`);
            else if (!unit.msgstr) problems.push(`${where}: not translated`);
            if (!unit.msgstr) continue;
            for (const problem of literalProblems(unit)) problems.push(`${where}: ${problem}`);
            if (isCodeUnit(unit) || unit.fuzzy) continue;
            for (const problem of typographyProblems(unit.msgstr, lang)) problems.push(`${where}: ${problem}`);
            prose.push({ where, text: proseOf(unit.msgstr) });
        }
    }
    if (DICTIONARIES[lang]) {
        for (const { where, word } of misspelledUnits(root, lang, prose)) problems.push(`${where}: unknown word ${JSON.stringify(word)}`);
    } else if (lang === 'uk') {
        const known = new Set(vocabulary(root, lang));
        for (const { where, found } of languageTool(prose, lang, { only: ['MORFOLOGIK_RULE_UK_UA'] })) {
            if (!known.has(found)) problems.push(`${where}: unknown word ${JSON.stringify(found)}`);
        }
    }
    return problems;
}
