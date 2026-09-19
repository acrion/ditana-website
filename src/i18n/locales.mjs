// The languages of the site. English is the source and lives at the root;
// every other language is a translation of it under its own prefix, which is
// also the name of its directory in src/content/docs and of its PO files.
//
// `lang` is the variant the text is written in, and what the page declares.
// `hreflang` is whom search engines should offer the page to: everyone who
// reads the language, since the site has one variant of each.

export const SOURCE = { prefix: '', lang: 'en-GB', hreflang: 'en', label: 'English' };

export const TRANSLATIONS = [
    { prefix: 'de-ch', lang: 'de-CH', hreflang: 'de', label: 'Deutsch' },
    { prefix: 'fr-ch', lang: 'fr-CH', hreflang: 'fr', label: 'Français' },
    { prefix: 'it-ch', lang: 'it-CH', hreflang: 'it', label: 'Italiano' },
    { prefix: 'rm', lang: 'rm', hreflang: 'rm', label: 'Rumantsch' },
    { prefix: 'es-419', lang: 'es-419', hreflang: 'es', label: 'Español' },
    { prefix: 'uk', lang: 'uk', hreflang: 'uk', label: 'Українська' },
];

export const LOCALES = [SOURCE, ...TRANSLATIONS];

/** The `locales` option of Starlight. */
export function starlightLocales() {
    return Object.fromEntries(LOCALES.map(({ prefix, lang, label }) => [prefix || 'root', { label, lang }]));
}

/** The `i18n` option of @astrojs/sitemap: prefix → hreflang. */
export function sitemapI18n() {
    return {
        defaultLocale: 'root',
        locales: Object.fromEntries(LOCALES.map(({ prefix, hreflang }) => [prefix || 'root', hreflang])),
    };
}

const byPrefix = new Map(TRANSLATIONS.map((locale) => [locale.prefix, locale]));

/**
 * The locale a page belongs to, derived from its path relative to
 * src/content/docs: "de-ch/download.md" is German, "download.md" English.
 */
export function localeOfPage(relativePath) {
    const first = relativePath.split(/[\\/]/, 1)[0];
    return byPrefix.get(first) ?? SOURCE;
}

/** "de-ch/download.md" → "download.md" */
export function sourcePageOf(relativePath) {
    const locale = localeOfPage(relativePath);
    return locale === SOURCE ? relativePath : relativePath.slice(locale.prefix.length + 1);
}

/** Where readers correct the translations. */
export const WEBLATE_PROJECT = 'https://hosted.weblate.org/projects/ditana/';
