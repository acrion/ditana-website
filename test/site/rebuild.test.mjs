import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSite, copySite, editFile, removeSite } from '../helpers/site.mjs';

// publish-ditana-website.sh builds in the repository, where Astro keeps the
// rendered Markdown of earlier builds and renders a page again only if its
// own file changed, or the Markdown settings did. The header of a
// release-notes page depends on the other release notes and on the code that
// writes it, so a change to either has to reach the pages on a cached build.
describe('a build on the cache of an earlier one', () => {
    let dir;
    before(async () => {
        dir = copySite();
        await buildSite(dir);
    });
    after(() => removeSite(dir));

    test('shows a corrected date in the notes of the next release', async () => {
        editFile(dir, 'src/content/docs/release-notes/0-9-3-beta.md', (text) => text.replace('date: 2026-05-21', 'date: 2026-05-22'));
        const site = await buildSite(dir);
        assert.match(site.page('release-notes/0-9-4-beta'), /0\.9\.3 Beta<\/a> \(22 May 2026\)/);
    });

    test('shows a changed header in the notes whose files did not change', async () => {
        editFile(dir, 'src/release/releases.mjs', (text) => text.replace('(${formatReleaseDate(older.date, lang)})', '[${formatReleaseDate(older.date, lang)}]'));
        const site = await buildSite(dir);
        assert.match(site.page('release-notes/0-9-4-beta'), /0\.9\.3 Beta<\/a> \[22 May 2026\]/);
    });

    // The header takes its dates from src/i18n/format.mjs.
    test('shows a changed date format in the notes whose files did not change', async () => {
        editFile(dir, 'src/i18n/format.mjs', (text) => text.replace("month: 'long'", "month: 'short'"));
        const site = await buildSite(dir);
        assert.match(site.page('release-notes/0-9-4-beta'), /<strong>Release date:<\/strong> 12 Sept 2026/);
    });

    // The header's labels are interface strings, in every language.
    test('shows a changed label in the notes whose files did not change', async () => {
        editFile(dir, 'src/content/i18n/en-GB.json', (text) => text.replace('"release.previous": "Previous release:"', '"release.previous": "Predecessor:"'));
        const site = await buildSite(dir);
        assert.match(site.page('release-notes/0-9-4-beta'), /<strong>Predecessor:<\/strong>/);
    });
});
