import { z } from 'astro/zod';

// The `release` block within the frontmatter of a release-notes page. The
// content collection validates it via docsSchema({ extend }), and the config
// reads the same files prior to that collection being established, so both use
// this one schema.
export const releaseFrontmatterSchema = z.strictObject({
    // A string, never a YAML number: unquoted, 0.9 would still parse, but 0.10
    // would silently become 0.1.
    version: z.string({ error: 'quote the version, e.g. version: "0.9.4"' })
        .regex(/^\d+\.\d+(\.\d+)?$/, 'expected a version such as "0.9.4"'),
    // "Beta" for 0.9.4. A release without a label leaves the key out. The
    // label is included in the image's file name, which publishing
    // looks up on the server via a shell.
    label: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/, 'expected a label such as "Beta"').optional(),
    // Written as 2026-09-12, which YAML reads as a date. Left out during
    // the release preparation: the page becomes a draft then.
    date: z.date({ error: 'expected a day such as 2026-09-12' }).optional(),
    // "1.9 GB", as the landing and download pages state it.
    isoSize: z.string().regex(/^\d+(\.\d+)? GB$/, 'expected a size such as "1.9 GB"').optional(),
});

export const releaseNotesExtension = z.object({
    release: releaseFrontmatterSchema.optional(),
});

/**
 * Starlight leaves pages with `draft: true` out of production builds. A
 * release-notes page without a release date is marked that way, so notes
 * written ahead of a release are neither built nor listed in the sitemap.
 * In the dev server they stay reachable.
 */
export const draftUnlessReleased = (data) =>
    (data.release && data.release.date === undefined ? { ...data, draft: true } : data);
