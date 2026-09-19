#!/usr/bin/env node
// The units of one language in JSON, for translating outside Weblate, and the
// translated JSON put back into the PO files:
//
//   npm run -s i18n:units -- export de-ch --open > de-ch.json
//   npm run -s i18n:units -- export de-ch --open --only ui,download > part.json
//   npm run -s i18n:units -- import de-ch.json
//
// An exported unit is { file, msgctxt?, type, msgid, msgstr, fuzzy?, previous? };
// complete msgstr and import the list, or any part of it.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../src/i18n/locales.mjs';
import { exportUnits, importUnits } from '../src/i18n/units.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [command, argument, ...options] = process.argv.slice(2);
// --only names the translation files by their directory: ui, download, …
const onlyAt = options.indexOf('--only');
const only = onlyAt === -1 ? null : new Set(options[onlyAt + 1].split(','));
const wanted = (file) => !only || only.has(file.split('/').at(-2));
if (command === 'export' && TRANSLATIONS.some(({ prefix }) => prefix === argument)) {
    const units = exportUnits(root, argument, { open: options.includes('--open') }).filter(({ file }) => wanted(file));
    console.log(JSON.stringify(units, null, 2));
} else if (command === 'import' && argument) {
    const units = JSON.parse(fs.readFileSync(argument, 'utf8')).filter(({ msgstr }) => msgstr);
    importUnits(root, units);
    console.log(`${units.length} units written.`);
} else {
    console.error('usage: i18n:units -- export <prefix> [--open] [--only <dir>,…] | import <file.json>');
    process.exit(2);
}
