// Refuses to publish the site while the current release cannot be
// downloaded.
//
// Which release is current is derived from the release notes, and it changes
// as soon as a date is added to them, regardless of whether the image is on
// the server or not. The 0.9.4 download page was committed three days prior
// to its image being uploaded. publish-ditana-website.sh therefore runs this
// first.
//
// The files are looked up on the server itself, via the ssh connection that
// rsync uses anyway. Cloudflare is not asked: it turns a HEAD request for a
// cacheable file it has not cached into a GET directed toward the server,
// which for an image with a query string fetches the whole image, and
// without one it might maintain a 404 for four hours after the upload.
//
//   node scripts/check-release-published.mjs <ssh destination> <downloads directory>

import { spawnSync } from 'node:child_process';
import { readReleaseNotes } from '../src/release/read-release-notes.mjs';
import { currentRelease, isoFileName, releaseName } from '../src/release/releases.mjs';

/** The files a release is downloaded as. */
export const releaseDownloads = (release) => {
    const iso = isoFileName(release);
    return [iso, `${iso}.sha256`, `${iso}.sig`];
};

/** Bytes as the pages state them: decimal gigabytes, one decimal. */
export const formatIsoSize = (bytes) => `${(bytes / 1e9).toFixed(1)} GB`;

const SAFE_RE = /^[A-Za-z0-9._/-]+$/;

const quote = (word) => {
    if (!SAFE_RE.test(word)) throw new Error(`Refusing to pass ${JSON.stringify(word)} to a remote shell`);
    return `'${word}'`;
};

/**
 * The shell command run on the server. It prints `<bytes> <name>` for each of
 * the files that exists, and fails only if the directory does not.
 */
export function remoteStatCommand(dir, files) {
    return `cd ${quote(dir)} && for f in ${files.map(quote).join(' ')}; do `
        + 'if [ -f "$f" ]; then stat --format=\'%s %n\' -- "$f"; fi; done';
}

/** Sizes by file name, from the output of remoteStatCommand. */
export function parseStat(output) {
    const sizes = new Map();
    for (const line of output.split('\n')) {
        const match = /^(\d+) (.+)$/.exec(line.trim());
        if (match) sizes.set(match[2], Number(match[1]));
    }
    return sizes;
}

/** What keeps the release from being downloaded, as sentences; empty if nothing. */
export function downloadProblems(release, sizes) {
    const [iso, ...others] = releaseDownloads(release);
    const problems = [];
    for (const file of [iso, ...others]) {
        if (!sizes.has(file)) problems.push(`${file} is not on the server`);
        else if (sizes.get(file) === 0) problems.push(`${file} is empty`);
    }
    if (sizes.get(iso) > 0 && formatIsoSize(sizes.get(iso)) !== release.isoSize) {
        problems.push(`${iso} has ${formatIsoSize(sizes.get(iso))} (${sizes.get(iso)} bytes), but ${release.slug}.md says ${release.isoSize}`);
    }
    return problems;
}

export function checkReleasePublished({ destination, dir, docsDir, ssh = 'ssh' }) {
    const release = currentRelease(readReleaseNotes(docsDir));
    // stdin and stderr stay with the terminal, so that ssh can ask for a
    // passphrase as it does for rsync.
    const result = spawnSync(ssh, [destination, remoteStatCommand(dir, releaseDownloads(release))], {
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'inherit'],
    });
    if (result.error) throw result.error;
    if (result.status === 255) {
        return { release, problems: [`${destination} could not be reached over ssh`] };
    }
    if (result.status !== 0) {
        return { release, problems: [`${dir} does not exist on ${destination}`] };
    }
    return { release, problems: downloadProblems(release, parseStat(result.stdout)) };
}

if (import.meta.main) {
    const [destination, dir] = process.argv.slice(2);
    if (!destination || !dir) {
        console.error('usage: node scripts/check-release-published.mjs <ssh destination> <downloads directory>');
        process.exit(2);
    }
    const { release, problems } = checkReleasePublished({
        destination,
        dir,
        docsDir: new URL('../src/content/docs/', import.meta.url),
    });
    if (problems.length > 0) {
        console.error(`✗ ${releaseName(release)} is the current release, but it cannot be downloaded:`);
        for (const problem of problems) console.error(`  ${problem}`);
        console.error(`Upload the image, its .sha256 and its .sig first, or remove the date from ${release.slug}.md.`);
        process.exit(1);
    }
    console.log(`✓ ${releaseName(release)}: ${releaseDownloads(release).join(', ')} are on the server.`);
}
