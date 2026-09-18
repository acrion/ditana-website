import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseDownloads } from '../../scripts/check-release-published.mjs';
import { readReleaseNotes } from '../../src/release/read-release-notes.mjs';
import { currentRelease } from '../../src/release/releases.mjs';

const script = fileURLToPath(new URL('../../publish-ditana-website.sh', import.meta.url));
const release = currentRelease(readReleaseNotes(new URL('../../src/content/docs/', import.meta.url)));
const sizeInBytes = Math.round(Number.parseFloat(release.isoSize) * 1e9);

// publish-ditana-website.sh operates on a sandbox whose PATH holds stand-ins
// for ssh, npm and rsync and a few basic tools, and nothing more, ensuring
// that neither the real server nor a real build environment is accessible.
// The stand-ins record how they were called; ssh runs the remote command on
// this machine, targeting a directory structured like the server's downloads.
describe('publishing', () => {
    let root;
    let run;

    before(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'ditana-publish-script-'));
        const bin = path.join(root, 'bin');
        fs.mkdirSync(bin);
        for (const tool of ['bash', 'dirname', 'sh', 'stat']) {
            fs.symlinkSync(fs.realpathSync(`/usr/bin/${tool}`), path.join(bin, tool));
        }
        fs.symlinkSync(process.execPath, path.join(bin, 'node'));
        const stub = (name, body) => fs.writeFileSync(path.join(bin, name), `#!${process.execPath}\n${body}\n`, { mode: 0o755 });
        const record = "require('node:fs').appendFileSync(process.env.STUB_LOG, [require('node:path').basename(process.argv[1]), ...args].join(' ') + '\\n');";
        stub('ssh', `const args = process.argv.slice(2); ${record}
            const command = args[1].replaceAll('/var/www/ditana.org/downloads', process.env.FAKE_DOWNLOADS);
            process.exit(require('node:child_process').spawnSync('sh', ['-c', command], { stdio: 'inherit' }).status);`);
        stub('npm', `const args = process.argv.slice(2); ${record}`);
        stub('rsync', `const args = process.argv.slice(2).slice(-2); ${record}`);

        run = (files) => {
            const downloads = fs.mkdtempSync(path.join(root, 'downloads-'));
            for (const [file, size] of files) {
                fs.writeFileSync(path.join(downloads, file), '');
                fs.truncateSync(path.join(downloads, file), size);
            }
            const log = path.join(downloads, '..', `${path.basename(downloads)}.log`);
            fs.writeFileSync(log, '');
            const result = spawnSync(path.join(bin, 'bash'), [script], {
                encoding: 'utf8',
                env: { PATH: bin, STUB_LOG: log, FAKE_DOWNLOADS: downloads },
            });
            return { ...result, calls: fs.readFileSync(log, 'utf8').trim().split('\n') };
        };
    });
    after(() => fs.rmSync(root, { recursive: true, force: true }));

    test('checks the server, builds and uploads when the release can be downloaded', () => {
        const [iso, sha256, sig] = releaseDownloads(release);
        const result = run([[iso, sizeInBytes], [sha256, 97], [sig, 566]]);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.calls.length, 3);
        assert.match(result.calls[0], /^ssh ditana-origin cd '\/var\/www\/ditana\.org\/downloads' && /);
        assert.equal(result.calls[1], 'npm run build');
        assert.equal(result.calls[2], 'rsync ./dist/ ditana-origin:/var/www/ditana.org/');
    });

    // The repository is public, and Cloudflare exists to hide this address.
    // ~/.ssh/config maps the alias to it.
    test('names the server by its ssh alias, never by its address', () => {
        assert.doesNotMatch(fs.readFileSync(script, 'utf8'), /\b\d{1,3}(\.\d{1,3}){3}\b/);
    });

    test('stops before building when the image is missing', () => {
        const [, sha256, sig] = releaseDownloads(release);
        const result = run([[sha256, 97], [sig, 566]]);
        assert.equal(result.status, 1);
        assert.match(result.stderr, new RegExp(`${releaseDownloads(release)[0].replaceAll('.', '\\.')} is not on the server`));
        assert.deepEqual(result.calls.map((call) => call.split(' ')[0]), ['ssh']);
    });
});
