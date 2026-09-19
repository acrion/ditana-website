#!/usr/bin/env node
// Brings the translation files in sync with the English text and lists what
// is left to translate. Run it after every change to an English page or to
// src/content/i18n/en-GB.json, before translating.

import { fileURLToPath } from 'node:url';
import { openUnits, updateTranslations } from '../src/i18n/update.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { pages, removed } = updateTranslations(root);
console.log(`${pages} pages`);
for (const dir of removed) console.log(`removed po/docs/${dir}/: its page no longer exists`);
const open = openUnits(root);
for (const { po, fuzzy, untranslated } of open) console.log(`${po}: ${untranslated} untranslated, ${fuzzy} fuzzy`);
console.log(open.length === 0 ? 'Every unit is translated.' : `${open.length} files have open units.`);
