import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildSite, copySite, mainContent, metaProperty, removeSite, sidebarReleases, writeFile } from '../helpers/site.mjs';
import { ogImageSvg, ogImageUrl, renderPng } from '../../src/og-image/render.mjs';

const template = fs.readFileSync(new URL('../../src/og-image/template.svg', import.meta.url), 'utf8');
const downloadSource = fs.readFileSync(new URL('../../src/content/docs/download.md', import.meta.url), 'utf8');

// 0.9.5 is the first release without the Beta label. Its notes are composed
// prior to the release, without a date, and the date is added on the day it
// is issued. Both states are built here, in copies of the site whose release
// notes are these two pages alone, so that the tests remain valid after
// later releases too.
const notes094 = `---
title: 0.9.4 Beta release notes
description: The last release with the Beta label.
release:
  version: '0.9.4'
  label: Beta
  date: 2026-09-12
  isoSize: 1.9 GB
---

## What changed

A good deal.
`;

const notes095 = (date) => `---
title: 0.9.5 release notes
description: The first release without the Beta label.
release:
  version: '0.9.5'${date ? `\n  date: ${date}` : ''}
  isoSize: 2.0 GB
---

## What changed

Everything that 0.9.4 Beta did not.
`;

function siteWithNotes(date) {
    const dir = copySite();
    const notesDir = path.join(dir, 'src/content/docs/release-notes');
    fs.rmSync(notesDir, { recursive: true });
    fs.mkdirSync(notesDir);
    writeFile(dir, 'src/content/docs/release-notes/0-9-4-beta.md', notes094);
    writeFile(dir, 'src/content/docs/release-notes/0-9-5.md', notes095(date));
    return dir;
}

describe('notes written ahead of a release', () => {
    let dir;
    let site;
    before(async () => {
        dir = siteWithNotes();
        site = await buildSite(dir);
    });
    after(() => removeSite(dir));

    test('are not published', () => {
        assert.equal(site.exists('release-notes/0-9-5/index.html'), false);
    });

    test('are not in the sitemap', () => {
        assert.doesNotMatch(site.read('sitemap-0.xml'), /0-9-5/);
    });

    test('do not appear in the sidebar', () => {
        assert.deepEqual(sidebarReleases(site.page('download')), ['0.9.4 Beta (current)']);
    });

    test('leave the download page at the current release', () => {
        assert.match(site.page('download'), /Ditana GNU\/Linux 0\.9\.4 Beta<\/h2>/);
    });

    test('are not announced as the successor of the current release', () => {
        assert.doesNotMatch(site.page('release-notes/0-9-4-beta'), /Successor/);
    });

    test('leave the image at the current release', () => {
        assert.deepEqual(metaProperty(site.page(''), 'og:image'), [ogImageUrl('https://ditana.org', ogImageSvg(template, '0.9.4 Beta'))]);
    });
});

describe('adding the release date', () => {
    let dir;
    let site;
    before(async () => {
        dir = siteWithNotes('2026-12-01');
        site = await buildSite(dir);
    });
    after(() => removeSite(dir));

    test('publishes the notes', () => {
        assert.match(site.page('release-notes/0-9-5'), /<strong>Release date:<\/strong> 1 December 2026<br>\n<strong>Previous release:<\/strong> <a href="\/release-notes\/0-9-4-beta\/">0\.9\.4 Beta<\/a>/);
    });

    test('makes it the current release in the sidebar', () => {
        assert.deepEqual(sidebarReleases(site.page('download')), ['0.9.5 (current)', '0.9.4 Beta']);
    });

    test('announces it as the successor in the notes of 0.9.4', () => {
        assert.match(site.page('release-notes/0-9-4-beta'), /<strong>Successor:<\/strong> <a href="\/release-notes\/0-9-5\/">0\.9\.5<\/a> \(1 December 2026\)/);
    });

    test('offers its image, named without a label, on the download page', () => {
        const html = site.page('download');
        assert.match(html, /<h2 id="ditana-gnulinux-095">Ditana GNU\/Linux 0\.9\.5<\/h2>/);
        assert.match(html, /href="https:\/\/ditana\.org\/downloads\/Ditana-0\.9\.5-x86_64\.iso"/);
        assert.match(html, /href="https:\/\/ditana\.org\/downloads\/Ditana-0\.9\.5-x86_64\.iso\.sha256"/);
        assert.match(html, /href="https:\/\/ditana\.org\/downloads\/Ditana-0\.9\.5-x86_64\.iso\.sig"/);
        assert.match(html, /The installation image \(~2\.0 GB\)\./);
        // Expressive Code joins the lines of a block using U+007F in
        // data-code.
        assert.match(html, /data-code="cd \/path\/to\/your\/downloads\x7Fsha256sum -c Ditana-0\.9\.5-x86_64\.iso\.sha256"/);
        assert.match(html, /data-code="gpg --verify Ditana-0\.9\.5-x86_64\.iso\.sig Ditana-0\.9\.5-x86_64\.iso"/);
        assert.match(html, /<code dir="auto">\.\/Ditana-0\.9\.5-x86_64\.iso: OK<\/code>/);
        assert.match(html, /href="\/release-notes\/0-9-5\/">0\.9\.5 release notes<\/a>/);
    });

    test('leaves no mention of the previous image on the download page', () => {
        assert.doesNotMatch(mainContent(site.page('download')), /Ditana-0\.9\.4/);
    });

    // A version spelled out in download.md, such as "Media predating 0.9.4",
    // is a statement about history and stays. Any other version on the page
    // must be the new release.
    test('names on the download page no version but the new one and those written out', () => {
        const written = new Set(downloadSource.match(/\b\d+\.\d+\.\d+\b/g) ?? []);
        const shown = new Set(mainContent(site.page('download')).match(/\b\d+\.\d+\.\d+\b/g));
        assert.deepEqual([...shown].filter((version) => version !== '0.9.5' && !written.has(version)), []);
    });

    test('names it on the landing page', () => {
        const html = site.page('');
        assert.match(html, /ditana-hero__eyebrow">Arch Linux · Configuration as data · 0\.9\.5</);
        assert.match(html, /Ditana 0\.9\.5 is a 2\.0 GB ISO with/);
        assert.match(html, /href="\/release-notes\/0-9-5\/">What’s new in 0\.9\.5</);
        assert.doesNotMatch(mainContent(html), /0\.9\.4/);
    });

    test('gives the image a new address and draws the new release', () => {
        const svg = ogImageSvg(template, '0.9.5');
        assert.deepEqual(metaProperty(site.page('download'), 'og:image'), [ogImageUrl('https://ditana.org', svg)]);
        assert.ok(fs.readFileSync(`${site.outDir}/og-image.png`).equals(renderPng(svg)));
    });
});
