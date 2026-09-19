#!/usr/bin/env node
// Grammar and style as LanguageTool sees them, for one language:
//
// npm run i18n:lint -- de-ch
//
// A report for anyone who translates or reviews, not a gate: LanguageTool
// is right often enough to be worth reading and wrong often enough that
// publishing cannot wait for it. Spelling is left to the gates.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { languageTool } from '../src/i18n/languagetool.mjs';
import { isCodeUnit } from '../src/i18n/literals.mjs';
import { TRANSLATIONS } from '../src/i18n/locales.mjs';
import { readPo } from '../src/i18n/po.mjs';
import { proseOf } from '../src/i18n/spelling.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const prefix = process.argv[2];
const locale = TRANSLATIONS.find((candidate) => candidate.prefix === prefix);
if (!locale) {
    console.error(`usage: npm run i18n:lint -- <${TRANSLATIONS.map(({ prefix: p }) => p).join('|')}>`);
    process.exit(2);
}
if (locale.lang === 'rm') {
    console.log('LanguageTool has no Romansh; the spelling gate is all there is.');
    process.exit(0);
}
const units = fs.globSync(`po/**/${prefix}.po`, { cwd: root }).toSorted().flatMap((file) => readPo(path.join(root, file))
    .filter((unit) => unit.msgstr && !unit.fuzzy && !isCodeUnit(unit))
    .map((unit) => ({ where: `${file}: ${unit.msgid.slice(0, 50).replace(/\n/g, ' ')}`, text: proseOf(unit.msgstr) })));
const matches = languageTool(units, locale.lang, {
    categories: ['GRAMMAR', 'CONFUSED_WORDS', 'PUNCTUATION'],
    // Spelling is the gates' business; spacing is what taking code out of a
    // unit leaves behind.
    disable: ['MORFOLOGIK_RULE_UK_UA', 'GERMAN_SPELLER_CH', 'FR_SPELLING_RULE', 'MORFOLOGIK_RULE_IT_IT', 'MORFOLOGIK_RULE_ES',
        'WHITESPACE_RULE', 'CONSECUTIVE_SPACES', 'COMMA_PARENTHESIS_WHITESPACE', 'UPPERCASE_SENTENCE_START', 'DOUBLE_PUNCTUATION',
        'FRENCH_WHITESPACE', 'FRENCH_WHITESPACE_STRICT'],
});
for (const { where, rule, message, found, replacements } of matches) {
    console.log(`${where}\n  ${rule}: ${message}\n  «${found}» → ${replacements.join(' | ')}`);
}
console.log(`${matches.length} matches in ${units.length} units.`);
