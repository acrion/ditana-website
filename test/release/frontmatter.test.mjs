import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReleaseFile, readReleaseNotes } from '../../src/release/read-release-notes.mjs';
import { draftUnlessReleased } from '../../src/release/schema.mjs';
import { releaseName } from '../../src/release/releases.mjs';

const docsDir = new URL('../../src/content/docs/', import.meta.url);

const page = (release) => `---\ntitle: Some notes\nrelease:\n${release}\n---\n\nText.\n`;

describe('the release block in the frontmatter', () => {
    test('reads a day as a date', () => {
        const release = parseReleaseFile(page("  version: '0.9.4'\n  label: Beta\n  date: 2026-09-12\n  isoSize: 1.9 GB"), 'x.md');
        assert.deepEqual(release, { version: '0.9.4', label: 'Beta', date: new Date('2026-09-12'), isoSize: '1.9 GB' });
    });

    test('may leave out the date while the release is being prepared', () => {
        assert.equal(parseReleaseFile(page("  version: '0.9.5'"), 'x.md').date, undefined);
    });

    test('may leave out the label', () => {
        assert.equal(parseReleaseFile(page("  version: '0.9.5'\n  date: 2026-12-01"), 'x.md').label, undefined);
    });

    // The label integrates into the image's file name, and publishing looks
    // that name up on the server via a shell.
    test('refuses a label that is more than letters and digits', () => {
        assert.throws(() => parseReleaseFile(page("  version: '0.9.5'\n  label: RC 1"), 'x.md'), /expected a label such as "Beta"/);
    });

    // Unquoted, 0.9 still parses; 0.10 would silently become 0.1.
    test('refuses an unquoted version', () => {
        assert.throws(() => parseReleaseFile(page('  version: 0.9'), 'x.md'), /x\.md: .*quote the version/s);
    });

    // The 0.9.3 notes named only the month, and the day was never filled in.
    test('refuses a date without a day', () => {
        assert.throws(() => parseReleaseFile(page("  version: '0.9.3'\n  date: 2026-05"), 'x.md'), /expected a day/);
    });

    // YAML rolls an impossible day over into the next month, so a typo on
    // release day would be printed as another, real-looking date.
    test('refuses a day that does not exist', () => {
        assert.throws(() => parseReleaseFile(page("  version: '0.9.5'\n  date: 2026-11-31"), 'x.md'),
            /x\.md: release\.date must be a day that exists, .* found 2026-11-31/);
    });

    // A time of day would be printed as the day it is in UTC.
    test('refuses a time of day', () => {
        assert.throws(() => parseReleaseFile(page("  version: '0.9.5'\n  date: 2026-12-01T23:30:00-05:00"), 'x.md'),
            /must be a day that exists/);
    });

    // A key misspelt would otherwise be dropped without a word.
    test('refuses an unknown key', () => {
        assert.throws(() => parseReleaseFile(page("  version: '0.9.4'\n  isosize: 1.9 GB"), 'x.md'), /isosize/);
    });

    test('refuses a size in another form than the pages print', () => {
        assert.throws(() => parseReleaseFile(page("  version: '0.9.4'\n  isoSize: 1.9GB"), 'x.md'), /expected a size/);
    });

    test('must be present on a release-notes page', () => {
        assert.throws(() => parseReleaseFile('---\ntitle: Notes\n---\n', 'x.md'), /x\.md: .*needs a `release` block/);
    });
});

describe('the release notes in the repository', () => {
    const releases = readReleaseNotes(docsDir);
    const files = fs.readdirSync(new URL('release-notes/', docsDir)).filter((file) => file.endsWith('.md'));

    test('each give one record, named after the file', () => {
        assert.deepEqual(
            releases.map(({ slug, file }) => ({ slug, file })),
            files.toSorted().map((file) => ({
                slug: `release-notes/${path.basename(file, '.md')}`,
                file: fileURLToPath(new URL(`release-notes/${file}`, docsDir)),
            })),
        );
    });

    // The title is written by hand and the release block beside it; nothing
    // else would notice if the two named different releases.
    test('each name in their title the release their metadata describes', () => {
        for (const release of releases) {
            const text = fs.readFileSync(new URL(`${release.slug}.md`, docsDir), 'utf8');
            const title = /^title: (.*)$/m.exec(text)[1];
            assert.ok(title.startsWith(`${releaseName(release)} `), `${release.slug}: "${title}" does not name ${releaseName(release)}`);
        }
    });
});

// The header of a release-notes page is written by a Markdown plugin, which
// an MDX page does not pass through.
test('release notes written in MDX are refused', (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ditana-notes-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dir, 'release-notes'));
    fs.writeFileSync(path.join(dir, 'release-notes/0-9-5.mdx'), page("  version: '0.9.5'"));
    assert.throws(() => readReleaseNotes(dir), /release notes are written in Markdown, not MDX: 0-9-5\.mdx/);
});

describe('notes without a release date', () => {
    test('are drafts, which Starlight leaves out of production builds', () => {
        assert.equal(draftUnlessReleased({ title: 'x', draft: false, release: { version: '0.9.5' } }).draft, true);
    });

    test('become pages once they carry a date', () => {
        const data = { title: 'x', draft: false, release: { version: '0.9.5', date: new Date('2026-12-01') } };
        assert.equal(draftUnlessReleased(data), data);
    });

    test('are the only pages this applies to', () => {
        const data = { title: 'Download', draft: false };
        assert.equal(draftUnlessReleased(data), data);
    });
});
