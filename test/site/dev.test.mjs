import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { copySite, removeSite, startDev, waitFor, writeFile } from '../helpers/site.mjs';
import { ogImageSvg, renderPng } from '../../src/og-image/render.mjs';
import { readReleaseNotes } from '../../src/release/read-release-notes.mjs';
import { currentReleaseView } from '../../src/release/releases.mjs';

const template = fs.readFileSync(new URL('../../src/og-image/template.svg', import.meta.url), 'utf8');
const current = currentReleaseView(readReleaseNotes(new URL('../../src/content/docs/', import.meta.url)));

describe('the dev server', () => {
    let dir;
    let server;
    before(async () => {
        dir = copySite();
        server = await startDev(dir);
    });
    after(async () => {
        await server?.stop();
        removeSite(dir);
    });

    // The dev server answers from the endpoint as well, so a preview shows the
    // image that a build would publish.
    test('serves the rendered image', async () => {
        const response = await server.get('/og-image.png');
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('content-type'), 'image/png');
        assert.ok(Buffer.from(await response.arrayBuffer()).equals(renderPng(ogImageSvg(template, current.name))));
    });

    // It reads the releases once, and a restart would not render Markdown
    // anew. Notes written while it runs are shown, but the rest of the site
    // stays at the releases it started with, and it says so.
    test('shows release notes written while it runs', async () => {
        const notes = (text) => `---\ntitle: 9.9.9 release notes\ndescription: Later.\nrelease:\n  version: '9.9.9'\n  date: 2030-01-01\n  isoSize: 2.0 GB\n---\n\n${text}\n`;
        let saves = 0;
        let saved = 0;
        const html = await waitFor(async () => {
            // Astro's dev server loads a page that appears while it is busy
            // and may still answer 404 for it until the content changes
            // again; saving the same text again changes nothing it notices.
            if (Date.now() - saved > 2000) {
                writeFile(dir, 'src/content/docs/release-notes/9-9-9.md', notes(`Later, draft ${++saves}.`));
                saved = Date.now();
            }
            const response = await server.get('/release-notes/9-9-9/');
            const text = response.ok ? await response.text() : '';
            return text.includes('Release date:') && text;
        }, 20_000, server.output);
        assert.match(html, new RegExp(`<strong>Previous release:</strong> <a href="${current.notesHref}">`));
    });

    test('asks to be restarted once the releases changed', async () => {
        await waitFor(() => server.output().includes('describe other releases than when the dev server started'), 20_000, server.output);
    });
});
