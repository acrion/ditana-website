import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { z } from 'astro/zod';
import { releaseFrontmatterSchema } from './schema.mjs';

// astro.config.mjs is evaluated prior to any content collection being
// established, so the sidebar and the Markdown plugin cannot ask the
// collection for the releases. They read the frontmatter here instead, using
// the YAML loader Astro uses (js-yaml with its default schema, so 2026-09-12
// becomes a Date) and the schema the collection applies afterwards.

const FRONTMATTER_RE = /^﻿?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** The frontmatter as YAML text, and the Markdown after it. */
export function splitFrontmatter(text) {
    const match = FRONTMATTER_RE.exec(text);
    return match
        ? { frontmatter: match[1], body: text.slice(match[0].length) }
        : { frontmatter: '', body: text };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// js-yaml builds a date using Date.UTC, which rolls an impossible day over
// into the next month: 2026-11-31 would be printed as 1 December. A
// timestamp containing a time of day would be printed as the day it falls on
// in UTC. Thus, the date is also read as it was written, and must correspond
// to a day that actually exists.
function checkDay(frontmatter, where) {
    const written = yaml.load(frontmatter, { schema: yaml.CORE_SCHEMA })?.release?.date;
    if (written === undefined) return;
    const day = String(written);
    if (!DAY_RE.test(day) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) {
        throw new Error(`${where}: release.date must be a day that exists, written as 2026-09-12, found ${day}`);
    }
}

export function parseReleaseFile(text, where) {
    const { frontmatter } = splitFrontmatter(text);
    const data = frontmatter ? yaml.load(frontmatter) : undefined;
    if (!data?.release) {
        throw new Error(`${where}: a release-notes page needs a \`release\` block in its frontmatter`);
    }
    const parsed = releaseFrontmatterSchema.safeParse(data.release);
    if (!parsed.success) throw new Error(`${where}: ${z.prettifyError(parsed.error)}`);
    checkDay(frontmatter, where);
    return parsed.data;
}

/**
 * @param {URL|string} docsDir  the root of the docs collection, src/content/docs
 * @param {string} subdir       the directory of the release notes inside it
 */
export const releaseNotesDir = (docsDir, subdir = 'release-notes') =>
    path.join(docsDir instanceof URL ? fileURLToPath(docsDir) : docsDir, subdir);

export function readReleaseNotes(docsDir, subdir = 'release-notes') {
    const dir = releaseNotesDir(docsDir, subdir);
    const files = fs.readdirSync(dir).filter((file) => /\.mdx?$/.test(file)).toSorted();
    // The header of a release-notes page is written by a Markdown plugin,
    // which MDX pages do not pass through.
    const mdx = files.filter((file) => file.endsWith('.mdx'));
    if (mdx.length > 0) {
        throw new Error(`${subdir}: release notes are written in Markdown, not MDX: ${mdx.join(', ')}`);
    }
    return files.map((file) => ({
        slug: `${subdir}/${file.replace(/\.md$/, '')}`,
        file: path.join(dir, file),
        ...parseReleaseFile(fs.readFileSync(path.join(dir, file), 'utf8'), `${subdir}/${file}`),
    }));
}
