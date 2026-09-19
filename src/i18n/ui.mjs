import fs from 'node:fs';
import { LOCALES, SOURCE, TRANSLATIONS } from './locales.mjs';

// The strings of the interface, as Starlight reads them from
// src/content/i18n/<lang>.json. The English file is written by hand; the
// others are generated from the PO files in po/ui before every build. The
// config needs them too, for the labels of the sidebar and the lines at the
// top of the release notes, and it is evaluated before any collection exists,
// so it reads the files here.

export const i18nDir = (srcDir) => new URL('content/i18n/', srcDir);

export function readUiStrings(srcDir) {
    const dir = i18nDir(srcDir);
    return Object.fromEntries(LOCALES.map(({ lang }) => {
        const file = new URL(`${lang}.json`, dir);
        return [lang, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}];
    }));
}

/** "{{release}} (current)" with { release: '0.9.4 Beta' } → "0.9.4 Beta (current)" */
export const fill = (template, values = {}) =>
    template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, name) => (Object.hasOwn(values, name) ? values[name] : whole));

/**
 * A translator for one language that falls back to English only for a key
 * the language lacks; the completeness gate keeps that from being published.
 */
export function translator(strings, lang) {
    const own = strings[lang] ?? {};
    const english = strings[SOURCE.lang] ?? {};
    return (key, values) => {
        const template = own[key] ?? english[key];
        if (template === undefined) throw new Error(`No interface string ${key}`);
        return fill(template, values);
    };
}

/**
 * A sidebar entry whose label is drawn from the interface strings: the
 * English label, and a translation for each language, which Starlight picks
 * by the page's language.
 */
export function labelled(strings, key, values) {
    const label = translator(strings, SOURCE.lang)(key, values);
    const translations = Object.fromEntries(TRANSLATIONS.map(({ lang }) => [lang, translator(strings, lang)(key, values)]));
    return { label, translations };
}
