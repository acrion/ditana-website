import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { buildSite, copySite, isRedirect, mainContent, metaProperty, removeSite, sidebarReleases } from '../helpers/site.mjs';
import { ogImageSvg, ogImageUrl, renderPng } from '../../src/og-image/render.mjs';
import { readReleaseNotes } from '../../src/release/read-release-notes.mjs';
import { currentReleaseView } from '../../src/release/releases.mjs';

const template = fs.readFileSync(new URL('../../src/og-image/template.svg', import.meta.url), 'utf8');

// What the repository says today. The tests below adhere to it, so that
// adding a release date does not require editing them; next-release.test.mjs
// pins the move from one release to the next with fixed notes.
const releases = readReleaseNotes(new URL('../../src/content/docs/', import.meta.url));
const current = currentReleaseView(releases);
const literal = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Astro does not fail when a file in public/ has the name of an endpoint: it
// warns, skips the endpoint and ships the file. A stale og-image.png there
// would be published in place of the rendered one.
test('no static file stands in for the rendered image', () => {
    assert.equal(fs.existsSync(new URL('../../public/og-image.png', import.meta.url)), false);
});

describe('the site as it is', () => {
    let dir;
    let site;
    before(async () => {
        dir = copySite();
        site = await buildSite(dir);
    });
    after(() => removeSite(dir));

    test('marks the current release in the sidebar, newest first', () => {
        const labels = sidebarReleases(site.page('download'));
        assert.equal(labels[0], `${current.name} (current)`);
        assert.equal(labels.length, releases.filter((release) => release.date).length);
        assert.equal(labels.filter((label) => label.endsWith('(current)')).length, 1);
    });

    test('offers the image of the current release on the download page', () => {
        const html = site.page('download');
        assert.match(html, new RegExp(`<h2 id="[^"]*">Ditana GNU/Linux ${literal(current.name)}</h2>`));
        assert.match(html, new RegExp(`<a href="https://ditana\\.org/downloads/${literal(current.iso)}"><code dir="auto">${literal(current.iso)}</code></a>`));
        assert.match(html, new RegExp(`The installation image \\(~${literal(current.isoSize)}\\)\\.`));
        assert.match(html, new RegExp(`data-code="gpg --verify ${literal(current.iso)}\\.sig ${literal(current.iso)}"`));
    });

    test('names the current release on the landing page', () => {
        const html = site.page('');
        assert.match(html, new RegExp(`ditana-hero__eyebrow">Arch Linux · Configuration as data · ${literal(current.name)}<`));
        assert.match(html, new RegExp(`Ditana ${literal(current.name)} is a ${literal(current.isoSize)} ISO with`));
        assert.match(html, new RegExp(`href="${literal(current.notesHref)}">What’s new in ${literal(current.name)}<`));
    });

    test('leaves no placeholder unfilled', () => {
        for (const file of site.pages()) assert.doesNotMatch(site.read(file), /\{\{/, file);
    });

    // An error while a Markdown page is rendered results in its
    // body being blank without failing the build. Starlight's
    // intrinsic 404 page contains no body.
    test('publishes every page with its content', () => {
        for (const file of site.pages().filter((page) => page !== '404.html' && !isRedirect(site.read(page)))) {
            assert.doesNotMatch(mainContent(site.read(file)), /<div class="sl-markdown-content[^"]*">\s*<\/div>/, file);
        }
    });

    // The 0.9.3 notes said only "May 2026" until the day was added.
    test('dates the 0.9.3 release to the day', () => {
        assert.match(site.page('release-notes/0-9-3-beta'), /<strong>Release date:<\/strong> 21 May 2026<br>/);
    });

    test('names the next release, not the newest, as the successor of 0.9', () => {
        assert.match(site.page('release-notes/0-9-0-beta'),
            /<strong>Successor:<\/strong> <a href="\/release-notes\/0-9-3-beta\/">0\.9\.3 Beta<\/a> \(21 May 2026\)/);
    });

    test('gives every page one og:image, addressed by what the image shows', () => {
        const expected = ogImageUrl('https://ditana.org', ogImageSvg(template, current.name));
        const pages = site.pages().filter((file) => !isRedirect(site.read(file)));
        assert.ok(pages.length > 10, `only ${pages.length} pages`);
        for (const file of pages) assert.deepEqual(metaProperty(site.read(file), 'og:image'), [expected], file);
    });

    test('announces the size the image has', async () => {
        const { width, height } = await sharp(`${site.outDir}/og-image.png`).metadata();
        const html = site.page('download');
        assert.deepEqual(metaProperty(html, 'og:image:width'), [String(width)]);
        assert.deepEqual(metaProperty(html, 'og:image:height'), [String(height)]);
    });

    test('publishes the image rendered for the current release', () => {
        assert.ok(fs.readFileSync(`${site.outDir}/og-image.png`).equals(renderPng(ogImageSvg(template, current.name))));
    });
});
