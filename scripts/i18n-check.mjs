#!/usr/bin/env node
// The gates a translation goes through before the site is published, as a
// report:
//
//   npm run i18n:check            every language
//   npm run i18n:check -- de-ch   one language
//   npm run i18n:check -- de-ch --only ui,download
//                                 some of its translation files
//
// Exits with 1 while anything is left; publish-ditana-website.sh publishes
// nothing then.

import { fileURLToPath } from 'node:url';
import { checkTranslation } from '../src/i18n/check.mjs';
import { TRANSLATIONS } from '../src/i18n/locales.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [wanted, ...options] = process.argv.slice(2);
const onlyAt = options.indexOf('--only');
const only = onlyAt === -1 ? null : new Set(options[onlyAt + 1].split(','));
const prefixes = wanted ? [wanted] : TRANSLATIONS.map(({ prefix }) => prefix);
if (wanted && !TRANSLATIONS.some(({ prefix }) => prefix === wanted)) {
    console.error(`usage: npm run i18n:check [-- <${TRANSLATIONS.map(({ prefix }) => prefix).join('|')}>]`);
    process.exit(2);
}
let failed = false;
for (const prefix of prefixes) {
    const problems = checkTranslation(root, prefix)
        .filter((problem) => !only || only.has(problem.slice(0, problem.indexOf('.po: ')).split('/').at(-2)));
    const open = problems.filter((problem) => /: (not translated|outdated, the English changed)$/.test(problem)).length;
    console.log(`${prefix}: ${problems.length === 0 ? 'ready' : `${problems.length} problems, ${open} of them untranslated or outdated units`}`);
    for (const problem of problems.filter((p) => !/: (not translated|outdated, the English changed)$/.test(p))) console.log(`  ${problem}`);
    if (problems.length) failed = true;
}
process.exit(failed ? 1 : 0);
