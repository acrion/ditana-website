import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownToHtml } from 'satteri';
import { localizedLinksPlugin, localizeHref, pageRoutes } from '../../src/i18n/links.mjs';

const routes = pageRoutes(['index.mdx', 'download.md', 'troubleshooting/index.md', 'troubleshooting/updating.md']);

describe('the routes of the English pages', () => {
    test('are the addresses Starlight serves them at', () => {
        assert.deepEqual([...routes], ['/', '/download/', '/troubleshooting/', '/troubleshooting/updating/']);
    });
});

describe('a link on a translated page', () => {
    test('to a page of the site gets the prefix of the language', () => {
        assert.equal(localizeHref('/download/', 'de-ch', routes), '/de-ch/download/');
        assert.equal(localizeHref('/', 'uk', routes), '/uk/');
    });

    test('keeps its anchor and query', () => {
        assert.equal(localizeHref('/troubleshooting/updating/#after-the-update', 'rm', routes), '/rm/troubleshooting/updating/#after-the-update');
        assert.equal(localizeHref('/download/?x=1', 'rm', routes), '/rm/download/?x=1');
    });

    // These exist once, for every language.
    test('to anything else under / keeps its address', () => {
        assert.equal(localizeHref('/build-history/index.json', 'de-ch', routes), '/build-history/index.json');
        assert.equal(localizeHref('/downloads/Ditana-0.9.4-Beta-x86_64.iso', 'de-ch', routes), '/downloads/Ditana-0.9.4-Beta-x86_64.iso');
        assert.equal(localizeHref('/og-image.png', 'de-ch', routes), '/og-image.png');
    });

    test('elsewhere keeps its address', () => {
        assert.equal(localizeHref('https://github.com/acrion/ditana-config', 'de-ch', routes), 'https://github.com/acrion/ditana-config');
        assert.equal(localizeHref('//example.org/download/', 'de-ch', routes), '//example.org/download/');
        assert.equal(localizeHref('#section', 'de-ch', routes), '#section');
    });
});

describe('a link on an English page', () => {
    test('keeps its address', () => {
        assert.equal(localizeHref('/download/', '', routes), '/download/');
    });
});

describe('the plugin', () => {
    const docs = '/site/src/content/docs';
    const render = async (markdown, file, before = []) => (await markdownToHtml(markdown, {
        mdastPlugins: [...before, localizedLinksPlugin({ docsDir: `${docs}/`, routes })],
        fileURL: new URL(`file://${docs}/${file}`),
    })).html;

    test('localises inline links and reference definitions of a translated page', async () => {
        const html = await render('[a](/download/) and [b][ref]\n\n[ref]: /troubleshooting/\n', 'fr-ch/index.md');
        assert.match(html, /href="\/fr-ch\/download\/"/);
        assert.match(html, /href="\/fr-ch\/troubleshooting\/"/);
    });

    test('leaves an English page alone', async () => {
        assert.match(await render('[a](/download/)', 'download.md'), /href="\/download\/"/);
    });

    // The release placeholders become links before this plugin sees them.
    test('localises what an earlier plugin wrote', async () => {
        const fill = { name: 'fill', link: (node, ctx) => ctx.setProperty(node, 'url', node.url.replace('{{notes}}', '/download/')) };
        assert.match(await render('[n]({{notes}})', 'it-ch/download.md', [fill]), /href="\/it-ch\/download\/"/);
    });
});
