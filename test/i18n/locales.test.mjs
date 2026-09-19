import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, localeOfPage, SOURCE, sourcePageOf, starlightLocales } from '../../src/i18n/locales.mjs';

describe('the languages of the site', () => {
    test('are English at the root and six translations under their prefixes', () => {
        assert.deepEqual(Object.entries(starlightLocales()).map(([key, { lang }]) => `${key}=${lang}`), [
            'root=en-GB', 'de-ch=de-CH', 'fr-ch=fr-CH', 'it-ch=it-CH', 'rm=rm', 'es-419=es-419', 'uk=uk',
        ]);
    });

    // An American English page would be a second English; /en-us/ is simply
    // not a page of the site.
    test('have no American English', () => {
        assert.ok(!LOCALES.some(({ lang, prefix }) => /^en-US$/i.test(lang) || prefix.startsWith('en')));
    });

    // A picker entry must name the language in the language itself, so that
    // someone who cannot read the current page still finds their own.
    test('are named in their own language in the picker', () => {
        assert.deepEqual(LOCALES.map(({ label }) => label),
            ['English', 'Deutsch', 'Français', 'Italiano', 'Rumantsch', 'Español', 'Українська']);
    });
});

describe('the language of a page', () => {
    test('is English for a page outside the prefixes', () => {
        assert.equal(localeOfPage('download.md'), SOURCE);
        assert.equal(localeOfPage('troubleshooting/updating.md'), SOURCE);
    });

    test('is the translation whose prefix is the first directory', () => {
        assert.equal(localeOfPage('de-ch/download.md').lang, 'de-CH');
        assert.equal(localeOfPage('es-419/troubleshooting/updating.md').lang, 'es-419');
    });

    // "uk" is a prefix; a page whose name merely begins with it is English.
    test('is not taken from a file name that begins like a prefix', () => {
        assert.equal(localeOfPage('ukraine.md'), SOURCE);
        assert.equal(localeOfPage('rmdir.md'), SOURCE);
    });

    test('leads back to the English page it translates', () => {
        assert.equal(sourcePageOf('de-ch/troubleshooting/updating.md'), 'troubleshooting/updating.md');
        assert.equal(sourcePageOf('troubleshooting/updating.md'), 'troubleshooting/updating.md');
    });
});
