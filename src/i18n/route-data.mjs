import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { LOCALES } from './locales.mjs';

// Starlight names each language via its `lang` in the alternate links of
// a page. Search engines read them as the audience of the page, which
// encompasses every reader of that language, thus they get the `hreflang`
// instead: de-CH is the only German there is. Open Graph writes a locale
// with an underscore.

const HREFLANG = new Map(LOCALES.map(({ lang, hreflang }) => [lang, hreflang]));

export const onRequest = defineRouteMiddleware((context) => {
    for (const { tag, attrs } of context.locals.starlightRoute.head) {
        if (tag === 'link' && attrs?.rel === 'alternate' && HREFLANG.has(attrs.hreflang)) {
            attrs.hreflang = HREFLANG.get(attrs.hreflang);
        }
        if (tag === 'meta' && attrs?.property === 'og:locale' && typeof attrs.content === 'string') {
            attrs.content = attrs.content.replace('-', '_');
        }
    }
});
