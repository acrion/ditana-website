import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { markdownToHtml, mdxToJs } from 'satteri';
import { checkMarkdownPages, releaseMarkdownPlugin, substitutePlaceholders } from '../../src/release/markdown.mjs';

const docs = '/site/src/content/docs';
const record = (name, fields) => ({ slug: `release-notes/${name}`, file: `${docs}/release-notes/${name}.md`, ...fields });

const releases = [
    record('0-9-3-beta', { version: '0.9.3', label: 'Beta', date: new Date('2026-05-21'), isoSize: '2.6 GB' }),
    record('0-9-4-beta', { version: '0.9.4', label: 'Beta', date: new Date('2026-09-12'), isoSize: '1.9 GB' }),
    record('0-9-5', { version: '0.9.5', isoSize: '2.0 GB' }),
];

// Astro hands Satteri the frontmatter in this data bag.
async function render(markdown, { frontmatter = {}, file = 'download.md', records = releases, after: later = [] } = {}) {
    const { html } = await markdownToHtml(markdown, {
        mdastPlugins: [releaseMarkdownPlugin(records), ...later],
        data: { astro: { frontmatter } },
        fileURL: new URL(`file://${docs}/${file}`),
    });
    return html;
}

const notes = (name, release) => ({ frontmatter: { release }, file: `release-notes/${name}.md` });
const notes093 = notes('0-9-3-beta', { version: '0.9.3' });

describe('substituting placeholders', () => {
    test('replaces every occurrence', () => {
        assert.equal(substitutePlaceholders('{{a}} and {{ a }}', { a: 'x' }, 'f'), 'x and x');
    });

    test('names the file and the known placeholders when one is unknown', () => {
        assert.throws(
            () => substitutePlaceholders('{{isos}}', { iso: 'x', release: 'y' }, 'download.md'),
            /download\.md: unknown placeholder \{\{isos\}\}; known are \{\{iso\}\}, \{\{release\}\}/,
        );
    });
});

describe('placeholders on a Markdown page', () => {
    test('are replaced in a heading', async () => {
        assert.match(await render('## Ditana GNU/Linux {{release}}'), /<h2>Ditana GNU\/Linux 0\.9\.4 Beta<\/h2>/);
    });

    // The download table: the placeholder is in the link target and in the
    // inline code that forms the link text.
    test('are replaced in a link target and in inline code', async () => {
        assert.match(
            await render('[`{{iso}}.sig`](https://ditana.org/downloads/{{iso}}.sig)'),
            /<a href="https:\/\/ditana\.org\/downloads\/Ditana-0\.9\.4-Beta-x86_64\.iso\.sig"><code>Ditana-0\.9\.4-Beta-x86_64\.iso\.sig<\/code><\/a>/,
        );
    });

    test('are replaced in a fenced command', async () => {
        assert.match(
            await render('```bash\ngpg --verify {{iso}}.sig {{iso}}\n```'),
            /gpg --verify Ditana-0\.9\.4-Beta-x86_64\.iso\.sig Ditana-0\.9\.4-Beta-x86_64\.iso/,
        );
    });

    // Satteri drops the meta line from its own HTML; on the site, Expressive
    // Code reads it for the title of a block.
    test('are replaced in the meta line of a fenced block', async () => {
        const meta = [];
        await render('```bash title="{{iso}}"\nls\n```', { after: [{ name: 'spy', code: (node) => { meta.push(node.meta); } }] });
        assert.deepEqual(meta, ['title="Ditana-0.9.4-Beta-x86_64.iso"']);
    });

    test('are replaced in running text', async () => {
        assert.match(await render('The image (~{{iso-size}}) and [the notes]({{notes}}).'),
            /The image \(~1\.9 GB\) and <a href="\/release-notes\/0-9-4-beta\/">the notes<\/a>\./);
    });

    test('are replaced in a link title', async () => {
        assert.match(await render('[notes](/x "{{release}}")'), /<a href="\/x" title="0\.9\.4 Beta">notes<\/a>/);
    });

    test('are replaced in raw HTML', async () => {
        assert.match(await render('<a href="/downloads/{{iso}}">image</a>'), /<a href="\/downloads\/Ditana-0\.9\.4-Beta-x86_64\.iso">/);
    });

    test('are replaced in an image', async () => {
        assert.match(await render('![{{release}}](/shots/{{iso}}.png "{{release}}")'),
            /<img src="\/shots\/Ditana-0\.9\.4-Beta-x86_64\.iso\.png" alt="0\.9\.4 Beta" title="0\.9\.4 Beta">/);
    });

    test('are replaced in a link definition', async () => {
        assert.match(await render('[the image][iso]\n\n[iso]: /downloads/{{iso}} "{{release}}"'),
            /<a href="\/downloads\/Ditana-0\.9\.4-Beta-x86_64\.iso" title="0\.9\.4 Beta">the image<\/a>/);
    });

    // 0.9.5 has notes already, but no date: it is not out yet.
    test('stand for the current release, not for the newest notes', async () => {
        assert.doesNotMatch(await render('{{release}}'), /0\.9\.5/);
    });

    // "Media predating 0.9.4 can no longer install" remains valid at
    // 0.9.5.
    test('leave a version written out untouched', async () => {
        assert.match(await render('Media predating 0.9.4 can no longer install.'), /Media predating 0\.9\.4/);
    });

    test('that are unknown are refused, naming the file', async () => {
        await assert.rejects(render('{{isos}}'), /download\.md: unknown placeholder \{\{isos\}\}/);
    });

    // In MDX, braces are expressions; such a page imports the release instead.
    test('are left to MDX on an MDX page', async () => {
        const { code } = await mdxToJs('Plain \\{\\{release\\}\\} text.', {
            mdastPlugins: [releaseMarkdownPlugin(releases)],
            data: { astro: { frontmatter: {} } },
            fileURL: new URL(`file://${docs}/index.mdx`),
        });
        assert.match(code, /\{\{release\}\}/);
    });
});

describe('a release-notes page', () => {
    // A placeholder would rewrite an old release's notes at the next release.
    test('refuses placeholders', async () => {
        await assert.rejects(render('Since {{release}}', notes093), /release notes are history/);
    });

    test('keeps versions written out', async () => {
        assert.match(await render('Upgrading from 0.9.2', notes093), /Upgrading from 0\.9\.2/);
    });

    test('keeps double braces that are not a placeholder', async () => {
        assert.match(await render("```bash\ndocker ps --format '{{.Names}}'\n```", notes093), /\{\{\.Names\}\}/);
    });

    test('starts with its date and its neighbours, one per line', async () => {
        const html = await render('Text.', notes093);
        assert.match(html, /^<p><strong>Release date:<\/strong> 21 May 2026<br>\n<strong>Successor:<\/strong> <a href="\/release-notes\/0-9-4-beta\/">0\.9\.4 Beta<\/a> \(12 September 2026\)<\/p>\n<p>Text\.<\/p>/);
    });

    // A rework of published notes, not yet dated, claims the same version.
    test('keeps its header when notes in the making claim its version', async () => {
        const rework = record('0-9-3-beta-draft', { version: '0.9.3', label: 'Beta' });
        const html = await render('Text.', { ...notes093, records: [rework, ...releases] });
        assert.match(html, /<strong>Release date:<\/strong> 21 May 2026/);
    });

    // Notes composed while the dev server runs are not included in the
    // records read at startup.
    test('without a record takes its header from its own frontmatter', async () => {
        const html = await render('Text.', notes('0-9-6', { version: '0.9.6' }));
        assert.match(html, /^<p><strong>Previous release:<\/strong> <a href="\/release-notes\/0-9-4-beta\/">0\.9\.4 Beta<\/a>/);
    });
});

// Astro renders a Markdown page again only when the digest of its processor
// options changes. Without this key, a corrected date would never reach the
// release notes of the neighbouring releases, whose files did not change.
test('the cache key changes when a date is corrected', () => {
    const corrected = releases.map((release) =>
        (release.version === '0.9.3' ? { ...release, date: new Date('2026-05-22') } : release));
    const key = releaseMarkdownPlugin(releases).cacheKey;
    assert.equal(typeof key, 'string');
    assert.notEqual(releaseMarkdownPlugin(corrected).cacheKey, key);
});

// An exception while Astro renders a page is only logged, and the page is
// published without its body. These checks run when the config is loaded,
// where an exception stops the build.
describe('checking the pages before the build', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ditana-docs-'));
    after(() => fs.rmSync(root, { recursive: true, force: true }));
    let count = 0;

    function docsWith(pages) {
        const dir = path.join(root, String(count++));
        fs.mkdirSync(path.join(dir, 'release-notes'), { recursive: true });
        for (const [file, text] of Object.entries(pages)) {
            fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
            fs.writeFileSync(path.join(dir, file), text);
        }
        return dir;
    }

    const page = (body, frontmatter = 'title: A page') => `---\n${frontmatter}\n---\n\n${body}\n`;

    test('pass pages that use known placeholders', () => {
        checkMarkdownPages(docsWith({ 'download.md': page('{{release}}: {{iso}}, {{iso-size}}, {{notes}}') }), releases);
    });

    test('refuse an unknown placeholder, naming the page', () => {
        assert.throws(() => checkMarkdownPages(docsWith({ 'guides/download.md': page('(~{{iso-sise}})') }), releases),
            /guides\/download\.md: unknown placeholder \{\{iso-sise\}\}/);
    });

    test('refuse a placeholder in release notes', () => {
        assert.throws(() => checkMarkdownPages(docsWith({ 'release-notes/0-9-4-beta.md': page('Since {{release}}') }), releases),
            /release-notes\/0-9-4-beta\.md: release notes are history .* found \{\{release\}\}/);
    });

    test('pass double braces in release notes that are not a placeholder', () => {
        checkMarkdownPages(docsWith({ 'release-notes/0-9-4-beta.md': page("`docker ps --format '{{.Names}}'`") }), releases);
    });

    // The frontmatter is not part of the Markdown that the plugin
    // sees.
    test('refuse a placeholder in the frontmatter', () => {
        assert.throws(() => checkMarkdownPages(docsWith({ 'download.md': page('Text.', 'title: Download {{release}}') }), releases),
            /download\.md: placeholders are filled in below the frontmatter only/);
    });

    test('refuse a release block outside the release notes', () => {
        const frontmatter = "title: Donate\nrelease:\n  version: '0.9.9'";
        assert.throws(() => checkMarkdownPages(docsWith({ 'donate.md': page('Text.', frontmatter) }), releases),
            /donate\.md: a release block belongs on a page in release-notes\//);
    });

    test('name every problem at once', () => {
        const dir = docsWith({ 'a.md': page('{{x}}'), 'b.md': page('{{y}}') });
        assert.throws(() => checkMarkdownPages(dir, releases), /a\.md: unknown placeholder \{\{x\}\}.*\n.*b\.md: unknown placeholder \{\{y\}\}/);
    });
});
