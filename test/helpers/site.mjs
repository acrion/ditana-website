import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const repo = fileURLToPath(new URL('../../', import.meta.url));

/**
 * A copy of the site in a temporary directory. A test that stands for a
 * future release writes its notes into the copy, the way a maintainer would
 * write them into the repository.
 */
export function copySite() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ditana-site-'));
    for (const entry of ['src', 'po', 'public', 'astro.config.mjs', 'package.json', 'tsconfig.json']) {
        fs.cpSync(path.join(repo, entry), path.join(dir, entry), { recursive: true });
    }
    fs.symlinkSync(path.join(repo, 'node_modules'), path.join(dir, 'node_modules'));
    return dir;
}

export const removeSite = (dir) => dir && fs.rmSync(dir, { recursive: true, force: true });

export const writeFile = (dir, file, text) => fs.writeFileSync(path.join(dir, file), text);

export const editFile = (dir, file, edit) => writeFile(dir, file, edit(fs.readFileSync(path.join(dir, file), 'utf8')));

/*
 * Astro runs in a child process, because astro.config.mjs reads the release
 * notes when it is evaluated. Its caches are directed to the copy: by default
 * they would end up in the node_modules shared with the repository.
 *
 * Symbolic links remain unresolved, for Node and for Vite alike. Resolved,
 * the shared node_modules lies outside the copy with no common ancestor but
 * /, and Astro then looks for its components under the copy's root.
 */
const astroOptions = (dir) => ({
    root: dir,
    cacheDir: path.join(dir, '.astro-cache'),
    vite: { cacheDir: path.join(dir, '.vite-cache'), resolve: { preserveSymlinks: true } },
});

const nodeArgs = (script) => ['--preserve-symlinks', '--preserve-symlinks-main', '--input-type=module', '-e', script];

/**
 * Builds the site at `dir` and returns accessors for the result. If
 * the build fails, it rejects with Astro's output in the error message.
 * Building the same copy once more leverages its cache, just as a build in
 * the repository does.
 */
export async function buildSite(dir) {
    const outDir = path.join(dir, 'dist');
    const options = { ...astroOptions(dir), outDir, logLevel: 'error' };
    await promisify(execFile)(
        process.execPath,
        nodeArgs(`import { build } from 'astro'; await build(${JSON.stringify(options)});`),
        { cwd: dir },
    );
    const read = (file) => fs.readFileSync(path.join(outDir, file), 'utf8');
    return {
        outDir,
        exists: (file) => fs.existsSync(path.join(outDir, file)),
        read,
        page: (route) => read(path.join(route, 'index.html')),
        pages: () => fs.globSync('**/*.html', { cwd: outDir }).filter((file) => !file.startsWith('pagefind/')),
    };
}

/**
 * Starts the dev server for the site at `dir`. `output()` contains all
 * that has been printed previously, `get(route)` fetches from it, and
 * `stop()` ends it.
 */
export async function startDev(dir) {
    const options = { ...astroOptions(dir), logLevel: 'warn', server: { host: '127.0.0.1', port: 0 } };
    const child = spawn(
        process.execPath,
        nodeArgs(`import { dev } from 'astro'; const server = await dev(${JSON.stringify(options)}); console.log('listening on port', server.address.port);`),
        { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    const exited = new Promise((resolve) => child.on('exit', resolve));
    const port = await waitFor(() => /listening on port (\d+)/.exec(output)?.[1], 30_000, () => output);
    return {
        output: () => output,
        get: (route) => fetch(`http://127.0.0.1:${port}${route}`),
        stop: async () => {
            child.kill();
            await exited;
        },
    };
}

/** Polls `probe` until it returns something truthy. */
export async function waitFor(probe, timeout, describe = () => '') {
    const deadline = Date.now() + timeout;
    for (;;) {
        const value = await probe();
        if (value) return value;
        if (Date.now() > deadline) throw new Error(`gave up waiting after ${timeout} ms\n${describe()}`);
        await sleep(100);
    }
}

/** The labels of the "Release notes" sidebar group, in order. */
export const sidebarReleases = (html) =>
    [...html.matchAll(/<a href="\/release-notes\/[^"]*"[^>]*>\s*<span[^>]*>([^<]*)<\/span>/g)].map((match) => match[1]);

/** The `content` of every meta tag with the given property. */
export const metaProperty = (html, property) =>
    [...html.matchAll(new RegExp(`<meta property="${property.replaceAll('.', '\\.')}" content="([^"]*)"`, 'g'))]
        .map((match) => match[1]);

/** The page's own content, without the sidebar and the table of contents. */
export const mainContent = (html) => /<main[\s\S]*<\/main>/.exec(html)[0];

/** The pages Astro generates for `redirects`; they carry no Starlight head. */
export const isRedirect = (html) => html.includes('http-equiv="refresh"');
