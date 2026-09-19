import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    compareVersions,
    currentRelease,
    currentReleaseView,
    formatReleaseDate,
    isoFileName,
    placeholderValues,
    publishedReleases,
    releaseHeaderMarkdown,
    releaseName,
    releaseNotesSidebar,
} from '../../src/release/releases.mjs';

const r090 = { slug: 'release-notes/0-9-0-beta', version: '0.9', label: 'Beta', date: new Date('2024-12-31') };
const r093 = { slug: 'release-notes/0-9-3-beta', version: '0.9.3', label: 'Beta', date: new Date('2026-05-21'), isoSize: '2.6 GB' };
const r094 = { slug: 'release-notes/0-9-4-beta', version: '0.9.4', label: 'Beta', date: new Date('2026-09-12'), isoSize: '1.9 GB' };
const draft095 = { slug: 'release-notes/0-9-5', version: '0.9.5', isoSize: '2.0 GB' };
const r095 = { ...draft095, date: new Date('2026-12-01') };

describe('versions', () => {
    test('compare numerically, so 0.10 is newer than 0.9.4', () => {
        assert.ok(compareVersions('0.10', '0.9.4') > 0);
    });

    // The first release is called "0.9" on the site.
    test('treat a missing patch number as 0', () => {
        assert.equal(compareVersions('0.9', '0.9.0'), 0);
    });
});

describe('published releases', () => {
    test('are the dated ones, newest first', () => {
        assert.deepEqual(publishedReleases([r090, draft095, r094, r093]).map((r) => r.version), ['0.9.4', '0.9.3', '0.9']);
    });

    // Two notes pages claiming one release would give two "current" pages.
    test('refuse two records for the same version', () => {
        assert.throws(() => publishedReleases([r094, { ...r094, slug: 'release-notes/copy' }]), /both claim release 0\.9\.4/);
    });
});

describe('the current release', () => {
    test('is the newest dated release', () => {
        assert.equal(currentRelease([r090, r093, r094]).version, '0.9.4');
    });

    // The 0.9.4 notes were written four days prior to 0.9.4's release.
    // Notes lacking a date must not make their release current.
    test('ignores notes without a release date', () => {
        assert.equal(currentRelease([r093, r094, draft095]).version, '0.9.4');
    });

    test('moves to a release once its notes carry a date', () => {
        assert.equal(currentRelease([r093, r094, r095]).version, '0.9.5');
    });

    test('must exist', () => {
        assert.throws(() => currentRelease([draft095]), /no current release/);
    });

    // The landing and download pages state the size of the image.
    test('must give the size of its image', () => {
        assert.throws(() => currentRelease([{ ...r094, isoSize: undefined }]), /0-9-4-beta .* gives no release\.isoSize/);
    });
});

describe('names', () => {
    test('join version and label', () => {
        assert.equal(releaseName(r094), '0.9.4 Beta');
    });

    // 0.9.5 is the first release without the Beta label.
    test('are the bare version for a release without a label', () => {
        assert.equal(releaseName(r095), '0.9.5');
    });

    // mkarchiso names the image Ditana-$DITANA_VERSION-x86_64.iso, and
    // ditana-installer/version.sh held DITANA_VERSION="0.9.4-Beta".
    test('of the image follow the installer build', () => {
        assert.equal(isoFileName(r094), 'Ditana-0.9.4-Beta-x86_64.iso');
    });

    test('of the image carry no label for a release without one', () => {
        assert.equal(isoFileName(r095), 'Ditana-0.9.5-x86_64.iso');
    });
});

describe('release dates', () => {
    test('are written as day, month and year', () => {
        assert.equal(formatReleaseDate(new Date('2026-09-12')), '12 September 2026');
    });

    // YAML dates are midnight UTC. They would appear as the prior day when
    // printed in local time for anyone building the site west of Greenwich.
    test('do not shift with the time zone of the build', () => {
        const saved = process.env.TZ;
        process.env.TZ = 'America/Los_Angeles';
        try {
            assert.equal(formatReleaseDate(new Date('2026-09-12')), '12 September 2026');
        } finally {
            if (saved === undefined) delete process.env.TZ;
            else process.env.TZ = saved;
        }
    });
});

describe('release dates in other languages', () => {
    test('are written as the language writes them', () => {
        assert.equal(formatReleaseDate(new Date('2026-09-12'), 'de-CH'), '12. September 2026');
        assert.equal(formatReleaseDate(new Date('2026-09-12'), 'es-419'), '12 de septiembre de 2026');
        assert.equal(formatReleaseDate(new Date('2026-09-12'), 'rm'), '12 da settember 2026');
    });

    test('write the first of a month as an ordinal in French and Italian', () => {
        assert.equal(formatReleaseDate(new Date('2026-05-01'), 'fr-CH'), '1er mai 2026');
        assert.equal(formatReleaseDate(new Date('2026-05-01'), 'it-CH'), '1° maggio 2026');
        assert.equal(formatReleaseDate(new Date('2026-05-01'), 'de-CH'), '1. Mai 2026');
        assert.equal(formatReleaseDate(new Date('2026-05-11'), 'fr-CH'), '11 mai 2026');
    });
});

describe('the release notes sidebar', () => {
    test('lists published releases, newest first, and marks the current one', () => {
        assert.deepEqual(releaseNotesSidebar([r090, r093, r094]), [
            { label: '0.9.4 Beta (current)', slug: 'release-notes/0-9-4-beta' },
            { label: '0.9.3 Beta', slug: 'release-notes/0-9-3-beta' },
            { label: '0.9 Beta', slug: 'release-notes/0-9-0-beta' },
        ]);
    });

    test('labels the current release as the caller says, translations included', () => {
        const current = (name) => ({ label: `${name} (current)`, translations: { 'de-CH': `${name} (aktuell)` } });
        assert.deepEqual(releaseNotesSidebar([r093, r094], current)[0],
            { label: '0.9.4 Beta (current)', translations: { 'de-CH': '0.9.4 Beta (aktuell)' }, slug: 'release-notes/0-9-4-beta' });
    });

    // Starlight fails a build whose sidebar names a page that is not built,
    // and notes without a date are not built.
    test('leaves out notes without a date', () => {
        assert.deepEqual(releaseNotesSidebar([r094, draft095]).map((item) => item.label), ['0.9.4 Beta (current)']);
    });
});

describe('the header of a release-notes page', () => {
    const all = [r090, r093, r094];

    // The lines are separated by hard breaks. Separated by plain line breaks,
    // as they were when written by hand, a browser runs them into one line.
    test('names the date, the previous release and the successor', () => {
        assert.equal(
            releaseHeaderMarkdown(all, r093),
            '**Release date:** 21 May 2026\\\n'
            + '**Previous release:** [0.9 Beta](/release-notes/0-9-0-beta/) (31 December 2024)\\\n'
            + '**Successor:** [0.9.4 Beta](/release-notes/0-9-4-beta/) (12 September 2026)',
        );
    });

    // With multiple newer releases, the successor is the next one, not the
    // newest.
    test('of the first release names the next release as its successor', () => {
        assert.equal(
            releaseHeaderMarkdown(all, r090),
            '**Release date:** 31 December 2024\\\n'
            + '**Successor:** [0.9.3 Beta](/release-notes/0-9-3-beta/) (21 May 2026)',
        );
    });

    test('of the current release has no successor', () => {
        assert.doesNotMatch(releaseHeaderMarkdown(all, r094), /Successor/);
    });

    // Written before the release, the notes are visible in the dev server.
    test('of notes without a date names only the release before', () => {
        assert.equal(
            releaseHeaderMarkdown([...all, draft095], draft095),
            '**Previous release:** [0.9.4 Beta](/release-notes/0-9-4-beta/) (12 September 2026)',
        );
    });

    // A translated page links to the notes in its own language.
    test('of a translation is written in its language, with its labels and links', () => {
        const labels = { date: 'Veröffentlicht am:', previous: 'Vorherige Version:', successor: 'Nachfolger:' };
        assert.equal(
            releaseHeaderMarkdown(all, r093, { lang: 'de-CH', labels, prefix: 'de-ch' }),
            '**Veröffentlicht am:** 21. Mai 2026\\\n'
            + '**Vorherige Version:** [0.9 Beta](/de-ch/release-notes/0-9-0-beta/) (31. Dezember 2024)\\\n'
            + '**Nachfolger:** [0.9.4 Beta](/de-ch/release-notes/0-9-4-beta/) (12. September 2026)',
        );
    });

    test('does not announce a successor that has no date yet', () => {
        assert.doesNotMatch(releaseHeaderMarkdown([...all, draft095], r094), /Successor/);
    });

    test('announces the successor once it has a date', () => {
        assert.match(
            releaseHeaderMarkdown([...all, r095], r094),
            /\*\*Successor:\*\* \[0\.9\.5\]\(\/release-notes\/0-9-5\/\) \(1 December 2026\)$/,
        );
    });
});

describe('what the pages show', () => {
    test('the placeholders stand for the current release', () => {
        assert.deepEqual(placeholderValues(r094), {
            release: '0.9.4 Beta',
            iso: 'Ditana-0.9.4-Beta-x86_64.iso',
            'iso-size': '1.9 GB',
            notes: '/release-notes/0-9-4-beta/',
        });
    });

    test('the view of the current release is preformatted', () => {
        assert.deepEqual(currentReleaseView([r093, r094, draft095]), {
            version: '0.9.4',
            name: '0.9.4 Beta',
            iso: 'Ditana-0.9.4-Beta-x86_64.iso',
            isoSize: '1.9 GB',
            notesHref: '/release-notes/0-9-4-beta/',
        });
    });
});
