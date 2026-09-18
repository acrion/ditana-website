// The release records and the rules that turn them into what the site shows.
//
// A record is what the `release` block in the frontmatter of a release-notes
// page says, plus the page's slug:
//   { slug, version, label?, date?, isoSize? }
// A record without a date is a draft: its notes may be written already, but
// nothing on the site treats that release as out, and the page itself is left
// out of production builds.
//
// Everything here is pure, so that the config, the pages and the tests apply
// the same rules.

const VERSION_RE = /^(\d+)\.(\d+)(?:\.(\d+))?$/;

export function parseVersion(version) {
    const match = typeof version === 'string' ? VERSION_RE.exec(version) : null;
    if (!match) {
        throw new Error(`A release version must be a quoted string such as "0.9.4", got ${JSON.stringify(version)}`);
    }
    return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
}

export function compareVersions(a, b) {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
}

export const isPublished = (release) => release.date !== undefined;

/** Published releases, newest first. */
export function publishedReleases(releases) {
    const published = releases.filter(isPublished);
    const seen = new Map();
    for (const release of published) {
        const key = parseVersion(release.version).join('.');
        if (seen.has(key)) {
            throw new Error(`${release.slug} and ${seen.get(key)} both claim release ${release.version}`);
        }
        seen.set(key, release.slug);
    }
    return published.toSorted((a, b) => compareVersions(b.version, a.version));
}

export function currentRelease(releases) {
    const [current] = publishedReleases(releases);
    if (!current) {
        throw new Error('No release notes carry a release date, so the site has no current release to offer.');
    }
    // The landing and download pages state the size of the image, and only
    // the current release's image is offered.
    if (current.isoSize === undefined) {
        throw new Error(`${current.slug} is the current release but gives no release.isoSize`);
    }
    return current;
}

/** "0.9.4 Beta", or "0.9.5" for a release without a label. */
export const releaseName = (release) => (release.label ? `${release.version} ${release.label}` : release.version);

// mkarchiso names the image `Ditana-$DITANA_VERSION-x86_64.iso`, and
// ditana-installer/version.sh writes the label in DITANA_VERSION using a
// hyphen ("0.9.4-Beta").
/** "Ditana-0.9.4-Beta-x86_64.iso", or "Ditana-0.9.5-x86_64.iso". */
export const isoFileName = (release) =>
    `Ditana-${release.label ? `${release.version}-${release.label}` : release.version}-x86_64.iso`;

/** "/release-notes/0-9-4-beta/" */
export const notesHref = (release) => `/${release.slug}/`;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

/** "12 September 2026" */
export function formatReleaseDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new Error(`A release date must be a day such as 2026-09-12, got ${JSON.stringify(date)}`);
    }
    // YAML reads 2026-09-12 as midnight UTC; a local-time getter would move it
    // to the previous day anywhere west of Greenwich.
    return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Items of the "Release notes" sidebar group, the current release first. */
export function releaseNotesSidebar(releases) {
    return publishedReleases(releases).map((release, index) => ({
        label: index === 0 ? `${releaseName(release)} (current)` : releaseName(release),
        slug: release.slug,
    }));
}

/** What the `{{name}}` placeholders in a Markdown page stand for. */
export function placeholderValues(release) {
    return {
        release: releaseName(release),
        iso: isoFileName(release),
        'iso-size': release.isoSize,
        notes: notesHref(release),
    };
}

/**
 * The top lines of a release-notes page: its own date and its published
 * neighbours. Each line is a separate Markdown line with a hard break, so
 * that they do not run together into one line of text.
 */
export function releaseHeaderMarkdown(releases, self) {
    const published = publishedReleases(releases);
    const link = (release) => `[${releaseName(release)}](${notesHref(release)})`;

    // The neighbours are found by version, so that a draft names the release
    // it follows.
    const older = published.find((release) => compareVersions(release.version, self.version) < 0);
    const newer = isPublished(self)
        ? published.findLast((release) => compareVersions(release.version, self.version) > 0)
        : undefined;

    const lines = [];
    if (isPublished(self)) lines.push(`**Release date:** ${formatReleaseDate(self.date)}`);
    if (older) lines.push(`**Previous release:** ${link(older)} (${formatReleaseDate(older.date)})`);
    if (newer) lines.push(`**Successor:** ${link(newer)} (${formatReleaseDate(newer.date)})`);
    return lines.join('\\\n');
}

/** The current release, preformatted for the pages that show it. */
export function currentReleaseView(releases) {
    const current = currentRelease(releases);
    return {
        version: current.version,
        name: releaseName(current),
        iso: isoFileName(current),
        isoSize: current.isoSize,
        notesHref: notesHref(current),
    };
}
