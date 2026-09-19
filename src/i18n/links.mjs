import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localeOfPage, SOURCE } from './locales.mjs';

// A translation links to pages within its own language. The Markdown of each
// language names the English route, `[…](/download/)`, since link targets are
// literals that translators do not modify; this Satteri mdast plugin puts the
// prefix of the page's language before every target that is a page on the
// site. Anything else under / (the build history, the downloads, the preview
// image) is shared across all languages and keeps its address.

/** "/download/#verifying" → "/de-ch/download/#verifying" when "/download/" is a page. */
export function localizeHref(href, prefix, routes) {
    if (!prefix || typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return href;
    const [, route, rest] = /^([^?#]*)(.*)$/.exec(href);
    return routes.has(route) ? `/${prefix}${route}${rest}` : href;
}

/** Where Starlight serves each English page: "/", "/download/" and so on. */
export function pageRoutes(pages) {
    return new Set(pages.map((page) => {
        const slug = page.replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '');
        return slug ? `/${slug}/` : '/';
    }));
}

export function localizedLinksPlugin({ docsDir, routes }) {
    // path.resolve drops the trailing slash a directory URL possesses, so
    // the test below looks for one separator after the root, not two.
    const root = path.resolve(docsDir instanceof URL ? fileURLToPath(docsDir) : docsDir);
    const prefixOf = (ctx) => {
        const file = ctx.fileURL && fileURLToPath(ctx.fileURL);
        if (!file || !file.startsWith(root + path.sep)) return '';
        const locale = localeOfPage(path.relative(root, file));
        return locale === SOURCE ? '' : locale.prefix;
    };
    const localize = (node, ctx) => {
        const prefix = prefixOf(ctx);
        const url = localizeHref(node.url, prefix, routes);
        if (url !== node.url) ctx.setProperty(node, 'url', url);
    };
    return {
        name: 'ditana-localized-links',
        cacheKey: JSON.stringify([...routes]),
        link: localize,
        definition: localize,
    };
}
