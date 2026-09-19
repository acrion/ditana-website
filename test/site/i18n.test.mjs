import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { headingIds } from '../../src/i18n/headings.mjs';
import { englishPages } from '../../src/i18n/integration.mjs';
import { fillKnownPlaceholders } from '../../src/release/markdown.mjs';
import { readReleaseNotes } from '../../src/release/read-release-notes.mjs';
import { currentRelease, placeholderValues } from '../../src/release/releases.mjs';
import { brokenLinks } from '../helpers/links.mjs';
import { importUnits } from '../../src/i18n/units.mjs';
import { buildSite, copySite, removeSite } from '../helpers/site.mjs';

// The site built with a few units translated into German, the way a
// translator leaves them in the PO files: the page, the sidebar, the lines at
// the top of the release notes and the footer have to come out in German, and
// everything a link needs has to stay English.
describe('a translated site', () => {
    let dir;
    let site;
    before(async () => {
        dir = copySite();
        // Laid over whatever the PO files hold, so that the test does not
        // depend on how far the translation has got.
        const page = 'po/docs/troubleshooting-updating/de-ch.po';
        const ui = 'po/ui/de-ch.po';
        importUnits(dir, [
            { file: page, msgid: 'Updating is not optional', msgstr: 'Aktualisieren ist nicht optional' },
            { file: page, msgid: 'The graphical way', msgstr: 'Der grafische Weg' },
            {
                file: page,
                msgid: '  (The one deliberate exception is the [keyring repair](/troubleshooting/signature-errors/#the-repair), and it is safe for a specific reason that is explained there.)\n',
                msgstr: '  (Die einzige bewusste Ausnahme ist die [Reparatur des Schlüsselbunds](/troubleshooting/signature-errors/#the-repair); weshalb sie sicher ist, steht dort.)\n',
            },
            { file: ui, msgid: 'Troubleshooting', msgstr: 'Fehlerbehebung' },
            { file: ui, msgid: 'Previous release:', msgstr: 'Vorherige Version:' },
            {
                file: ui,
                msgid: 'This translation was made by machine. Readers improve it on {{weblate}}.',
                msgstr: 'Diese Übersetzung ist maschinell erstellt. Leserinnen und Leser verbessern sie auf {{weblate}}.',
            },
            { file: ui, msgid: 'Download ISO', msgstr: 'ISO herunterladen' },
            { file: ui, msgid: 'What’s new in {{release}}', msgstr: 'Neu in {{release}}' },
        ]);
        site = await buildSite(dir);
    });
    after(() => removeSite(dir));

    test('declares the variant of the language it is written in', () => {
        assert.match(site.page('de-ch/troubleshooting/updating'), /<html lang="de-CH"/);
        assert.match(site.page('troubleshooting/updating'), /<html lang="en-GB"/);
    });

    test('shows the translation', () => {
        assert.match(site.page('de-ch/troubleshooting/updating'), /<h1[^>]*>Aktualisieren ist nicht optional<\/h1>/);
    });

    // A link to a section, from another page or from outside, has to work in
    // every language.
    test('gives a translated heading the id of the English one', () => {
        assert.match(site.page('de-ch/troubleshooting/updating'), /<h2 id="the-graphical-way">Der grafische Weg/);
    });

    test('links to the page in its own language, at the English anchor', () => {
        assert.match(site.page('de-ch/troubleshooting/updating'), /href="\/de-ch\/troubleshooting\/signature-errors\/#the-repair">Reparatur des Schlüsselbunds</);
        assert.match(site.page('troubleshooting/updating'), /href="\/troubleshooting\/signature-errors\/#the-repair">keyring repair</);
    });

    // The landing page is a component whose texts are interface strings.
    test('shows the landing page in its language, with links into it', () => {
        const landing = site.page('de-ch');
        assert.match(landing, /<a class="ditana-btn ditana-btn--primary" href="\/de-ch\/download\/">ISO herunterladen<\/a>/);
        assert.match(landing, /href="\/de-ch\/release-notes\/[^"]+\/">Neu in /);
        assert.match(landing, /href="\/de-ch\/under-the-hood\/mitigations\/"/);
        assert.match(site.page(''), /<a class="ditana-btn ditana-btn--primary" href="\/download\/">Download ISO<\/a>/);
    });

    test('labels the sidebar in its language', () => {
        assert.match(site.page('de-ch/download'), />\s*Fehlerbehebung\s*</);
        assert.doesNotMatch(site.page('download'), /Fehlerbehebung/);
    });

    test('writes the top of the release notes in its language, dates included', () => {
        const notes = site.page('de-ch/release-notes/0-9-4-beta');
        assert.match(notes, /<strong>Vorherige Version:<\/strong> <a href="\/de-ch\/release-notes\/0-9-3-beta\/">0\.9\.3 Beta<\/a> \(21\. Mai 2026\)/);
    });

    test('says on a translated page, and only there, that the translation is made by machine', () => {
        assert.match(site.page('de-ch/download'), /Diese Übersetzung ist maschinell erstellt\. Leserinnen und Leser verbessern sie auf <a href="https:\/\/hosted\.weblate\.org\/projects\/ditana\/"[^>]*>Weblate<\/a>\./);
        assert.doesNotMatch(site.page('download'), /ditana-machine-translation|hosted\.weblate/);
    });

    // There is one variant per language, so it is offered to every reader
    // of the language.
    test('offers each page to search engines by language', () => {
        const html = site.page('download');
        assert.match(html, /<link rel="alternate" hreflang="de" href="https:\/\/ditana\.org\/de-ch\/download\/"\/>/);
        assert.match(html, /<link rel="alternate" hreflang="es" href="https:\/\/ditana\.org\/es-419\/download\/"\/>/);
        assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/ditana\.org\/download\/"\/>/);
        assert.doesNotMatch(html, /hreflang="(de-CH|es-419|en-GB)"/);
    });

    test('lists every language in the sitemap', () => {
        const sitemap = site.read('sitemap-0.xml');
        assert.match(sitemap, /<loc>https:\/\/ditana\.org\/es-419\/download\/<\/loc>/);
        assert.match(sitemap, /hreflang="es" href="https:\/\/ditana\.org\/es-419\/download\/"/);
    });

    test('picks the language of a visitor on every page', () => {
        assert.match(site.page(''), /const KEY = "ditana-language";/);
    });

    test('has no link to a page or an anchor that does not exist, in any language', () => {
        assert.deepEqual(brokenLinks(site.outDir), []);
    });

    // The ids the translations carry are computed, not read from Astro, so
    // they must be the ids Astro assigns to the English pages.
    test('carries the heading ids of the built English pages', () => {
        const docs = path.join(dir, 'src/content/docs');
        const values = placeholderValues(currentRelease(readReleaseNotes(docs)));
        for (const page of englishPages(docs)) {
            const route = page.replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '');
            if (!site.exists(path.join(route, 'index.html'))) continue;
            const built = [...site.page(route).matchAll(/<h[1-6] id="([^"]+)"/g)].map((match) => match[1])
                .filter((id) => !id.startsWith('starlight__') && id !== '_top');
            const computed = headingIds(fs.readFileSync(path.join(docs, page), 'utf8'), {
                mdx: page.endsWith('.mdx'),
                substitute: (text) => fillKnownPlaceholders(text, values),
            }).map(({ id }) => id);
            assert.deepEqual(computed, built, page);
        }
    });
});
