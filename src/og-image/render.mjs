import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// The preview image displayed in link previews (og:image). template.svg is
// manually created and stays editable in Inkscape; the sole variable part is
// {{RELEASE}}, representing the current release in capitals.
//
// The template names its fonts instead of sans-serif and monospace. Generic
// names are resolved by the fontconfig of the person who builds the site,
// including a personal ~/.config/fontconfig, so the image would change with
// the account that builds it.
//
// rsvg-convert renders it rather than sharp. sharp brings its own fontconfig,
// which is older than the system's and prints about ninety warnings about the
// system configuration whenever it lays out text; the system's librsvg reads
// that configuration with the fontconfig it belongs to.

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

const PLACEHOLDER = '{{RELEASE}}';

const escapeXml = (text) => text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** The template with the release filled in, e.g. "0.9.4 Beta". */
export function ogImageSvg(template, releaseName) {
    const occurrences = template.split(PLACEHOLDER).length - 1;
    if (occurrences !== 1) {
        throw new Error(`The og:image template must contain ${PLACEHOLDER} exactly once, found ${occurrences}`);
    }
    const unknown = template.replace(PLACEHOLDER, '').match(/\{\{[^}]*\}\}/);
    if (unknown) throw new Error(`The og:image template contains an unknown placeholder ${unknown[0]}`);
    return template.replace(PLACEHOLDER, () => escapeXml(releaseName.toUpperCase()));
}

const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
    'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong']);

/**
 * The first family of every font-family in the drawing, whether written as
 * an attribute or, as Inkscape writes it, inside a style.
 */
export function drawingFonts(svg) {
    const families = new Set();
    for (const match of svg.matchAll(/font-family\s*(?:=\s*"([^"]*)"|=\s*'([^']*)'|:\s*([^;"]+))/g)) {
        families.add((match[1] ?? match[2] ?? match[3]).split(',')[0].trim().replace(/^['"]|['"]$/g, ''));
    }
    return [...families];
}

// fontconfig draws a missing font in whatever it finds instead, and
// rsvg-convert reports nothing. Such an image would be published under the
// same address as the right one, and stay in the caches of link-preview
// services after the font is installed.
export function checkFonts(svg) {
    for (const family of drawingFonts(svg)) {
        if (GENERIC_FAMILIES.has(family.toLowerCase())) {
            throw new Error(`og:image: the generic font-family ${family} is resolved by the font configuration of whoever builds the site; name a font`);
        }
        let found;
        try {
            found = execFileSync('fc-match', ['--format=%{family}', family], { encoding: 'utf8' });
        } catch (error) {
            if (error.code === 'ENOENT') throw new Error('fc-match is needed to check the fonts of og-image.png; on Arch it comes with the fontconfig package');
            throw error;
        }
        if (!found.split(',').some((name) => name.trim().toLowerCase() === family.toLowerCase())) {
            throw new Error(`og:image: the font ${family} is not installed; fontconfig would draw ${found} instead`);
        }
    }
}

/**
 * The address pages give for the image. Link-preview services and Cloudflare
 * cache an image by its URL, so the URL carries a digest of what is drawn: a
 * new release, or a changed template, results in a new address.
 */
export function ogImageUrl(site, svg) {
    const digest = createHash('sha256').update(svg).digest('hex').slice(0, 12);
    return `${new URL('/og-image.png', site)}?v=${digest}`;
}

export function renderPng(svg) {
    checkFonts(svg);
    try {
        return execFileSync(
            'rsvg-convert',
            ['--width', String(OG_IMAGE_WIDTH), '--height', String(OG_IMAGE_HEIGHT), '--format', 'png'],
            { input: svg, maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
        );
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error('rsvg-convert is needed to render og-image.png; on Arch it comes with the librsvg package');
        }
        throw new Error(`rsvg-convert failed to render og-image.png: ${error.stderr?.toString().trim() || error.message}`);
    }
}
