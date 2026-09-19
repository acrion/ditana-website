import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { localeOfPage, SOURCE } from './locales.mjs';
import { localizedLinksPlugin, pageRoutes } from './links.mjs';

/** The English pages, relative to src/content/docs. */
export function englishPages(docsDir) {
    const root = docsDir instanceof URL ? fileURLToPath(docsDir) : docsDir;
    return fs.globSync('**/*.{md,mdx}', { cwd: root })
        .filter((page) => localeOfPage(page) === SOURCE)
        .toSorted();
}

/**
 * Lets Satteri read the English heading ids that the generated translations
 * carry, and points the links of a translation to pages in its own language.
 * It belongs after the release integration in the list: the links it
 * localizes include those the release placeholders become.
 */
export function i18nIntegration({ docsDir }) {
    return {
        name: 'ditana-i18n',
        hooks: {
            'astro:config:setup': ({ config }) => {
                const processor = config.markdown.processor;
                if (processor?.name !== 'satteri') {
                    throw new Error(`ditana-i18n expects the Satteri Markdown processor, found ${processor?.name}`);
                }
                processor.options.features.headingAttributes = true;
                processor.options.mdastPlugins.push(localizedLinksPlugin({ docsDir, routes: pageRoutes(englishPages(docsDir)) }));
            },
        },
    };
}
