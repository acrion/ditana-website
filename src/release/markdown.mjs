import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { releaseNotesDir, splitFrontmatter } from './read-release-notes.mjs';
import { currentRelease, placeholderValues, releaseHeaderMarkdown } from './releases.mjs';

// Markdown cannot interpolate, so a page that names the current release
// writes {{release}}, {{iso}} and so on, and this Satteri mdast plugin
// substitutes them. Astro 7 renders Markdown with Satteri, not unified:
// `markdown.remarkPlugins` would only run after switching the whole site to
// @astrojs/markdown-remark.
//
// Release notes are history. A placeholder there would rewrite an old page at
// the next release, so it is refused. Instead, the plugin writes the facts at
// the top of each release-notes page (its date, the releases before and after
// it), which otherwise have to be edited by hand in the previous release's
// notes whenever a new one comes out.

const PLACEHOLDER_RE = /\{\{\s*([a-z][a-z0-9-]*)\s*\}\}/g;

// Other double braces, such as `{{.Names}}` in a docker command, are text.
const hasPlaceholder = (text) => text.search(PLACEHOLDER_RE) !== -1;

export function substitutePlaceholders(text, values, where) {
    return text.replace(PLACEHOLDER_RE, (_, name) => {
        if (!Object.hasOwn(values, name)) {
            const known = Object.keys(values).map((key) => `{{${key}}}`).join(', ');
            throw new Error(`${where}: unknown placeholder {{${name}}}; known are ${known}`);
        }
        return values[name];
    });
}

// An exception thrown while Astro renders a Markdown page does not fail the
// build: the content loader logs it and publishes the page without a body,
// and a later build on the same cache does not even log it again. So the
// pages are checked when the config is loaded, where an exception does stop
// the build, and the plugin below meets only pages that have passed.
export function checkMarkdownPages(docsDir, releases) {
    const root = docsDir instanceof URL ? fileURLToPath(docsDir) : docsDir;
    const notesDir = releaseNotesDir(root);
    const values = placeholderValues(currentRelease(releases));
    const problems = [];
    for (const page of fs.globSync('**/*.md', { cwd: root }).toSorted()) {
        const file = path.join(root, page);
        const { frontmatter, body } = splitFrontmatter(fs.readFileSync(file, 'utf8'));
        const isNotes = path.dirname(file) === notesDir;
        if (hasPlaceholder(frontmatter)) {
            problems.push(`${page}: placeholders are filled in below the frontmatter only`);
        }
        if (!isNotes && yaml.load(frontmatter)?.release !== undefined) {
            problems.push(`${page}: a release block belongs on a page in release-notes/`);
        }
        if (isNotes) {
            const found = body.match(PLACEHOLDER_RE);
            if (found) problems.push(`${page}: release notes are history and name versions literally, found ${found[0]}`);
        } else {
            try {
                substitutePlaceholders(body, values, page);
            } catch (error) {
                problems.push(error.message);
            }
        }
    }
    if (problems.length > 0) {
        throw new Error(`These pages would be published wrong or empty:\n${problems.map((problem) => `  ${problem}`).join('\n')}`);
    }
}

const moduleDir = new URL('./', import.meta.url);
const codeDigest = fs.readdirSync(moduleDir)
    .filter((file) => /\.m?[jt]s$/.test(file))
    .toSorted()
    .reduce((hash, file) => hash.update(file).update(fs.readFileSync(new URL(file, moduleDir))), createHash('sha256'))
    .digest('hex');

const where = (ctx) => ctx.fileURL?.pathname ?? '(unnamed document)';
const releaseOf = (ctx) => ctx.data.astro?.frontmatter?.release;

export function releaseMarkdownPlugin(releases) {
    const values = placeholderValues(currentRelease(releases));

    function substitute(node, key, ctx) {
        const text = node[key];
        if (typeof text !== 'string' || !hasPlaceholder(text)) return;
        // In MDX, braces are expressions; such a page imports the release
        // from virtual:ditana/release instead.
        if (ctx.sourceFormat !== 'markdown') return;
        if (releaseOf(ctx)) {
            throw new Error(`${where(ctx)}: release notes are history and name versions literally, found ${text.match(PLACEHOLDER_RE)?.[0] ?? text}`);
        }
        ctx.setProperty(node, key, substitutePlaceholders(text, values, where(ctx)));
    }

    return {
        name: 'ditana-release',

        // Satteri never reads this. Astro hashes the Markdown processor options
        // into the digest of its content cache (node_modules/.astro) and
        // renders a cached page again only when that digest changes. A function
        // hashes as null, and a Date as {} because the hash walks objects
        // itself instead of calling toJSON, so the records are carried as a
        // JSON string: a new release, or a corrected date, then reaches pages
        // whose own file did not change. The code that turns the records into
        // Markdown is carried as a digest of this directory, for the same
        // reason.
        cacheKey: JSON.stringify({ code: codeDigest, releases }),

        before(root, ctx) {
            const own = releaseOf(ctx);
            if (!own || ctx.sourceFormat !== 'markdown') return;
            // The page is found by its file, so that notes in progress cannot
            // substitute for the published notes of the same version. Notes
            // written while the dev server runs have no record yet, and their
            // own frontmatter serves until the server is restarted.
            const file = ctx.fileURL && fileURLToPath(ctx.fileURL);
            const self = releases.find((release) => release.file === file) ?? own;
            const header = releaseHeaderMarkdown(releases, self);
            if (header) ctx.prependChild(root, { raw: header });
        },

        text: (node, ctx) => substitute(node, 'value', ctx),
        inlineCode: (node, ctx) => substitute(node, 'value', ctx),
        code: (node, ctx) => {
            substitute(node, 'value', ctx);
            substitute(node, 'meta', ctx);
        },
        html: (node, ctx) => substitute(node, 'value', ctx),
        link: (node, ctx) => {
            substitute(node, 'url', ctx);
            substitute(node, 'title', ctx);
        },
        image: (node, ctx) => {
            substitute(node, 'url', ctx);
            substitute(node, 'title', ctx);
            substitute(node, 'alt', ctx);
        },
        definition: (node, ctx) => {
            substitute(node, 'url', ctx);
            substitute(node, 'title', ctx);
        },
    };
}
