import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSite, copySite, editFile, removeSite } from '../helpers/site.mjs';

// Astro only logs an exception thrown during the rendering of a Markdown
// page, and publishes the page without its body; a second build on the same
// cache does not even log it. publish-ditana-website.sh would then upload an
// empty download page. These mistakes must stop the build instead, every
// time.
describe('a misspelt placeholder on the download page', () => {
    let dir;
    before(() => {
        dir = copySite();
        editFile(dir, 'src/content/docs/download.md', (text) => text.replace('{{iso-size}}', '{{iso-sise}}'));
    });
    after(() => removeSite(dir));

    test('fails the build and names the page', async () => {
        await assert.rejects(buildSite(dir), /download\.md: unknown placeholder \{\{iso-sise\}\}/);
    });

    test('fails the next build as well', async () => {
        await assert.rejects(buildSite(dir), /download\.md: unknown placeholder \{\{iso-sise\}\}/);
    });
});

describe('a placeholder in release notes', () => {
    let dir;
    before(() => {
        dir = copySite();
        editFile(dir, 'src/content/docs/release-notes/0-9-4-beta.md', (text) => `${text}\nSince {{release}}.\n`);
    });
    after(() => removeSite(dir));

    test('fails the build and names the page', async () => {
        await assert.rejects(buildSite(dir), /release-notes\/0-9-4-beta\.md: release notes are history/);
    });
});

// Inkscape wrote a PNG and exited with 0 when a font was missing; the image
// would have been published in the fallback font.
describe('a font of the preview image that is not installed', () => {
    let dir;
    before(() => {
        dir = copySite();
        editFile(dir, 'src/og-image/template.svg', (text) => text.replaceAll('JetBrains Mono', 'No Such Mono'));
    });
    after(() => removeSite(dir));

    test('fails the build and names the font', async () => {
        await assert.rejects(buildSite(dir), /the font No Such Mono is not installed/);
    });
});
