import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { languageChoiceScript, STORAGE_KEY } from '../../src/i18n/choose-language.mjs';

// The script operates on a stand-in for the browser: a location that
// records where it is sent, the languages the browser asks for, a storage
// that may hold an earlier choice or refuse access, and a document that can
// dispatch a change of the language picker.
function visit({ path = '/', languages = ['en-GB'], stored = null, referrer = '', storageThrows = false, hash = '', search = '' } = {}) {
    const storage = new Map(stored === null ? [] : [[STORAGE_KEY, stored]]);
    const listeners = [];
    const sent = [];
    class Element {
        constructor(value) { this.value = value; }
        closest(selector) { return selector === 'starlight-lang-select select' ? this : null; }
    }
    const context = {
        URL,
        Element,
        location: { pathname: path, origin: 'https://ditana.org', hash, search, replace: (to) => sent.push(to) },
        navigator: { languages, language: languages[0] },
        document: { referrer, addEventListener: (type, listener) => listeners.push([type, listener]) },
        localStorage: {
            getItem: (key) => { if (storageThrows) throw new Error('denied'); return storage.get(key) ?? null; },
            setItem: (key, value) => { if (storageThrows) throw new Error('denied'); storage.set(key, value); },
        },
    };
    vm.runInNewContext(languageChoiceScript(), context);
    const pick = (value) => listeners.filter(([type]) => type === 'change').forEach(([, listener]) => listener({ target: new Element(value) }));
    return { sent, stored: () => storage.get(STORAGE_KEY) ?? null, pick };
}

describe('someone arriving at / from elsewhere', () => {
    test('is sent to the first language of their browser that the site has', () => {
        assert.deepEqual(visit({ languages: ['de-CH', 'en'] }).sent, ['/de-ch/']);
        assert.deepEqual(visit({ languages: ['ja', 'uk-UA', 'en'] }).sent, ['/uk/']);
    });

    // There is one German, one French, one Italian and one Spanish.
    test('reads the language, not the region', () => {
        assert.deepEqual(visit({ languages: ['de-DE'] }).sent, ['/de-ch/']);
        assert.deepEqual(visit({ languages: ['fr-FR'] }).sent, ['/fr-ch/']);
        assert.deepEqual(visit({ languages: ['it'] }).sent, ['/it-ch/']);
        assert.deepEqual(visit({ languages: ['es-ES'] }).sent, ['/es-419/']);
        assert.deepEqual(visit({ languages: ['rm-CH'] }).sent, ['/rm/']);
    });

    test('stays in English when English comes first, American English included', () => {
        assert.deepEqual(visit({ languages: ['en-US', 'de'] }).sent, []);
        assert.deepEqual(visit({ languages: ['en-GB'] }).sent, []);
    });

    test('stays in English when the site has none of their languages', () => {
        assert.deepEqual(visit({ languages: ['ja', 'ko'] }).sent, []);
    });

    test('keeps the query and the anchor', () => {
        assert.deepEqual(visit({ languages: ['de'], search: '?ref=x', hash: '#top' }).sent, ['/de-ch/?ref=x#top']);
    });

    test('is sent to the language they chose before, over the browser’s', () => {
        assert.deepEqual(visit({ languages: ['de'], stored: 'fr-ch' }).sent, ['/fr-ch/']);
        assert.deepEqual(visit({ languages: ['de'], stored: '' }).sent, []);
    });

    // A private window or blocked site data must not break the page.
    test('without access to storage, is still sent by their browser’s language', () => {
        assert.deepEqual(visit({ languages: ['it-CH'], storageThrows: true }).sent, ['/it-ch/']);
    });

    // A stored value that is no longer a language of the site.
    test('with a choice the site no longer has, stays in English', () => {
        assert.deepEqual(visit({ languages: ['de'], stored: 'en-us' }).sent, []);
    });
});

describe('nobody else is redirected', () => {
    test('a page other than / opens in its own language', () => {
        assert.deepEqual(visit({ path: '/download/', languages: ['de'] }).sent, []);
        assert.deepEqual(visit({ path: '/fr-ch/download/', languages: ['de'], stored: 'uk' }).sent, []);
    });

    // The logo of an English page points at /.
    test('someone following a link to / from within the site stays in English', () => {
        assert.deepEqual(visit({ languages: ['de'], referrer: 'https://ditana.org/download/' }).sent, []);
        assert.deepEqual(visit({ languages: ['de'], referrer: 'https://www.google.com/' }).sent, ['/de-ch/']);
    });
});

describe('the language picker', () => {
    test('remembers the language chosen', () => {
        const page = visit({ path: '/download/' });
        page.pick('/rm/download/');
        assert.equal(page.stored(), 'rm');
    });

    test('remembers English as a choice of its own', () => {
        const page = visit({ path: '/de-ch/download/' });
        page.pick('/download/');
        assert.equal(page.stored(), '');
    });
});
