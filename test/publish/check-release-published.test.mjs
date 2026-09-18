import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    checkReleasePublished,
    downloadProblems,
    formatIsoSize,
    parseStat,
    releaseDownloads,
    remoteStatCommand,
} from '../../scripts/check-release-published.mjs';

const r094 = { slug: 'release-notes/0-9-4-beta', version: '0.9.4', label: 'Beta', date: new Date('2026-09-12'), isoSize: '1.9 GB' };
const r095 = { slug: 'release-notes/0-9-5', version: '0.9.5', date: new Date('2026-12-01'), isoSize: '2.0 GB' };

const iso094 = 'Ditana-0.9.4-Beta-x86_64.iso';
const complete094 = new Map([[iso094, 1938915328], [`${iso094}.sha256`, 97], [`${iso094}.sig`, 566]]);

describe('the files of a release', () => {
    test('are the image, its checksum and its signature', () => {
        assert.deepEqual(releaseDownloads(r094), [iso094, `${iso094}.sha256`, `${iso094}.sig`]);
    });

    test('carry no label for a release without one', () => {
        assert.deepEqual(releaseDownloads(r095), ['Ditana-0.9.5-x86_64.iso', 'Ditana-0.9.5-x86_64.iso.sha256', 'Ditana-0.9.5-x86_64.iso.sig']);
    });
});

// The pages state sizes in decimal gigabytes: the 0.9.3 image had 2605023232
// bytes and was announced as 2.6 GB.
describe('image sizes', () => {
    test('are decimal gigabytes with one decimal', () => {
        assert.equal(formatIsoSize(1938915328), '1.9 GB');
        assert.equal(formatIsoSize(2605023232), '2.6 GB');
    });
});

describe('what keeps a release from being downloaded', () => {
    test('is nothing when all three files are there and the size matches', () => {
        assert.deepEqual(downloadProblems(r094, complete094), []);
    });

    test('is a missing image', () => {
        const sizes = new Map(complete094);
        sizes.delete(iso094);
        assert.deepEqual(downloadProblems(r094, sizes), [`${iso094} is not on the server`]);
    });

    test('is a missing signature', () => {
        const sizes = new Map(complete094);
        sizes.delete(`${iso094}.sig`);
        assert.deepEqual(downloadProblems(r094, sizes), [`${iso094}.sig is not on the server`]);
    });

    // An interrupted upload can leave an empty file behind.
    test('is an empty checksum', () => {
        const sizes = new Map(complete094).set(`${iso094}.sha256`, 0);
        assert.deepEqual(downloadProblems(r094, sizes), [`${iso094}.sha256 is empty`]);
    });

    test('is a size other than the release notes state', () => {
        const sizes = new Map(complete094).set(iso094, 2012345678);
        assert.deepEqual(downloadProblems(r094, sizes),
            [`${iso094} has 2.0 GB (2012345678 bytes), but release-notes/0-9-4-beta.md says 1.9 GB`]);
    });
});

describe('the command run on the server', () => {
    test('quotes the directory and the file names', () => {
        assert.equal(remoteStatCommand('/var/www/ditana.org/downloads', ['a.iso', 'a.iso.sig']),
            'cd \'/var/www/ditana.org/downloads\' && for f in \'a.iso\' \'a.iso.sig\'; do '
            + 'if [ -f "$f" ]; then stat --format=\'%s %n\' -- "$f"; fi; done');
    });

    test('refuses a name a shell would read as more than a name', () => {
        assert.throws(() => remoteStatCommand('/srv', ["a.iso'; rm -rf ~; '"]), /Refusing to pass/);
    });

    test('prints sizes that are read back by name', () => {
        assert.deepEqual(parseStat(`1938915328 ${iso094}\n97 ${iso094}.sha256\n`),
            new Map([[iso094, 1938915328], [`${iso094}.sha256`, 97]]));
    });
});

// The command is carried out by a stand-in for ssh, which executes it on this
// machine against a directory structured like the server's downloads
// directory.
describe('checking the server', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ditana-publish-'));
    after(() => fs.rmSync(root, { recursive: true, force: true }));

    const docsDir = path.join(root, 'docs');
    fs.mkdirSync(path.join(docsDir, 'release-notes'), { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'release-notes/0-9-4-beta.md'),
        "---\ntitle: 0.9.4 Beta release notes\nrelease:\n  version: '0.9.4'\n  label: Beta\n  date: 2026-09-12\n  isoSize: 1.9 GB\n---\n");
    fs.writeFileSync(path.join(docsDir, 'release-notes/0-9-5.md'),
        "---\ntitle: 0.9.5 release notes\nrelease:\n  version: '0.9.5'\n---\n");

    const log = path.join(root, 'ssh.log');
    const ssh = path.join(root, 'ssh');
    fs.writeFileSync(ssh, `#!/bin/sh\necho "$1" >> '${log}'\nexec /bin/sh -c "$2"\n`, { mode: 0o755 });
    const unreachable = path.join(root, 'ssh-unreachable');
    fs.writeFileSync(unreachable, '#!/bin/sh\necho "ssh: connect to host example port 22: Connection refused" >&2\nexit 255\n', { mode: 0o755 });

    let count = 0;
    function downloads(files) {
        const dir = path.join(root, `downloads-${count++}`);
        fs.mkdirSync(dir);
        // Sparse files: the size is what counts, not the content.
        for (const [file, size] of files) {
            fs.writeFileSync(path.join(dir, file), '');
            fs.truncateSync(path.join(dir, file), size);
        }
        return dir;
    }

    // The undated 0.9.5 notes are not the current release, and nothing of
    // 0.9.5 is on the server.
    test('passes when the files of the current release are there', () => {
        const dir = downloads(complete094);
        const { release, problems } = checkReleasePublished({ destination: 'root@example', dir, docsDir, ssh });
        assert.equal(release.version, '0.9.4');
        assert.deepEqual(problems, []);
        assert.match(fs.readFileSync(log, 'utf8'), /^root@example$/m);
    });

    test('names what is missing', () => {
        const dir = downloads([[iso094, 1938915328], [`${iso094}.sha256`, 97]]);
        assert.deepEqual(checkReleasePublished({ destination: 'root@example', dir, docsDir, ssh }).problems,
            [`${iso094}.sig is not on the server`]);
    });

    test('says so when the downloads directory is missing', () => {
        const dir = path.join(root, 'nowhere');
        assert.deepEqual(checkReleasePublished({ destination: 'root@example', dir, docsDir, ssh }).problems,
            [`${dir} does not exist on root@example`]);
    });

    test('says so when the server cannot be reached', () => {
        const dir = downloads(complete094);
        assert.deepEqual(checkReleasePublished({ destination: 'root@example', dir, docsDir, ssh: unreachable }).problems,
            ['root@example could not be reached over ssh']);
    });

    // The current release of the repository, whichever it is: the directory
    // is empty.
    describe('from the command line', () => {
        const bin = path.join(root, 'bin');
        fs.mkdirSync(bin);
        fs.symlinkSync(ssh, path.join(bin, 'ssh'));
        const script = new URL('../../scripts/check-release-published.mjs', import.meta.url).pathname;
        const run = (dir) => spawnSync(process.execPath, [script, 'root@example', dir], {
            encoding: 'utf8',
            env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
        });

        test('fails and names the current release and what is missing', () => {
            const result = run(downloads([]));
            assert.equal(result.status, 1);
            assert.match(result.stderr, /^✗ .+ is the current release, but it cannot be downloaded:\n {2}Ditana-.+-x86_64\.iso is not on the server\n/);
            assert.match(result.stderr, /Upload the image, its \.sha256 and its \.sig first, or remove the date from release-notes\/.+\.md\.\n$/);
        });

        test('fails when the downloads directory is missing', () => {
            const result = run(path.join(root, 'nowhere'));
            assert.equal(result.status, 1);
            assert.match(result.stderr, /nowhere does not exist on root@example/);
        });

        test('needs both arguments', () => {
            assert.equal(spawnSync(process.execPath, [script, 'root@example']).status, 2);
        });
    });
});
