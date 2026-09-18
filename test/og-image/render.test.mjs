import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, checkFonts, drawingFonts, ogImageSvg, ogImageUrl, renderPng } from '../../src/og-image/render.mjs';

const template = fs.readFileSync(new URL('../../src/og-image/template.svg', import.meta.url), 'utf8');

const pixels = async (png) => (await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true }));

/** Rows that contain a pixel differing by more than `tolerance` in any channel. */
function differingRows(a, b, tolerance = 0) {
    const rows = new Set();
    for (let i = 0; i < a.data.length; i++) {
        if (Math.abs(a.data[i] - b.data[i]) > tolerance) rows.add(Math.floor(i / 3 / a.info.width));
    }
    return [...rows].toSorted((x, y) => x - y);
}

describe('the template', () => {
    // The image said 0.9.3 for days after 0.9.4 was out, because the version
    // was typed into the drawing.
    test('names no version of its own', () => {
        assert.doesNotMatch(template.replace('{{RELEASE}}', ''), /\d+\.\d+\.\d+/);
    });

    test('draws in Noto Sans and JetBrains Mono', () => {
        assert.deepEqual(drawingFonts(template), ['Noto Sans', 'JetBrains Mono']);
    });
});

describe('the fonts of a drawing', () => {
    test('are read from attributes', () => {
        assert.deepEqual(drawingFonts('<text font-family="Noto Sans, sans-serif"/><text font-family=\'JetBrains Mono\'/>'),
            ['Noto Sans', 'JetBrains Mono']);
    });

    // Inkscape writes the font into a style.
    test('are read from a style', () => {
        assert.deepEqual(drawingFonts('<text style="font-size:24px;font-family:\'Noto Sans\';fill:#fff"/>'), ['Noto Sans']);
    });

    // Generic families are resolved by the fontconfig of whoever builds the
    // site; a personal ~/.config/fontconfig mapped monospace to a Nerd Font.
    test('must be named, not generic', () => {
        assert.throws(() => checkFonts('<text style="font-family:sans-serif"/>'), /generic font-family sans-serif .* name a font/);
    });

    // fontconfig would draw another font, and rsvg-convert would not say so.
    test('must be installed', () => {
        assert.throws(() => checkFonts('<text font-family="No Such Sans"/>'), /the font No Such Sans is not installed; fontconfig would draw .+ instead/);
    });

    test('pass when they are installed', () => {
        checkFonts(template);
    });
});

describe('filling in the release', () => {
    test('writes it in capitals after the distribution name', () => {
        assert.match(ogImageSvg(template, '0.9.4 Beta'), /DITANA GNU\/LINUX · 0\.9\.4 BETA/);
    });

    test('works for a release without a label', () => {
        assert.match(ogImageSvg(template, '0.9.5'), /DITANA GNU\/LINUX · 0\.9\.5\s*</);
    });

    test('escapes markup', () => {
        assert.match(ogImageSvg(template, 'R&D <1>'), /R&amp;D &lt;1&gt;/);
    });

    // In a replacement string, $& would stand for the placeholder itself.
    test('writes a dollar sign as it is', () => {
        assert.match(ogImageSvg(template, '1.0 $&'), /DITANA GNU\/LINUX · 1\.0 \$&amp;\s*</);
    });

    test('refuses a template without the placeholder', () => {
        assert.throws(() => ogImageSvg('<svg/>', '0.9.4'), /exactly once, found 0/);
    });

    test('refuses a template with the placeholder twice', () => {
        assert.throws(() => ogImageSvg('{{RELEASE}}{{RELEASE}}', '0.9.4'), /exactly once, found 2/);
    });

    // Only {{RELEASE}} is filled in; another placeholder would be printed as is.
    test('refuses an unknown placeholder', () => {
        assert.throws(() => ogImageSvg('{{RELEASE}} {{release}}', '0.9.4'), /unknown placeholder \{\{release\}\}/);
    });
});

describe('the address of the image', () => {
    const svg = ogImageSvg(template, '0.9.4 Beta');

    test('is og-image.png on the site, with a digest', () => {
        assert.match(ogImageUrl('https://ditana.org', svg), /^https:\/\/ditana\.org\/og-image\.png\?v=[0-9a-f]{12}$/);
    });

    test('stays the same while the image does', () => {
        assert.equal(ogImageUrl('https://ditana.org', svg), ogImageUrl('https://ditana.org', ogImageSvg(template, '0.9.4 Beta')));
    });

    // Cloudflare, Facebook and Mastodon keep an image by its URL.
    test('changes with the release', () => {
        assert.notEqual(ogImageUrl('https://ditana.org', ogImageSvg(template, '0.9.5')), ogImageUrl('https://ditana.org', svg));
    });

    test('changes with the drawing', () => {
        const redrawn = ogImageSvg(template.replace('#0d1117', '#000000'), '0.9.4 Beta');
        assert.notEqual(ogImageUrl('https://ditana.org', redrawn), ogImageUrl('https://ditana.org', svg));
    });
});

describe('rendering', () => {
    test('gives a PNG of the size it declares', async () => {
        const { width, height, format } = await sharp(renderPng(ogImageSvg(template, '0.9.4 Beta'))).metadata();
        assert.deepEqual({ width, height, format }, { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, format: 'png' });
    });

    // The 0.9.4 image as Inkscape rendered it from the hand-drawn template and
    // as it was published. rsvg-convert draws the same glyphs; the two differ
    // only in antialiasing, by at most 17 levels. A changed character, or a
    // font that is missing and replaced, differs by far more.
    test('draws what Inkscape drew for 0.9.4', async () => {
        const reference = await pixels(fs.readFileSync(new URL('../fixtures/og-image-0.9.4-inkscape.png', import.meta.url)));
        const rendered = await pixels(renderPng(ogImageSvg(template, '0.9.4 Beta')));
        assert.deepEqual(differingRows(rendered, reference, 32), []);
    });

    // Why the template names its fonts: the account that renders the image
    // must not decide what it looks like. A personal configuration can also
    // hide a missing font, by mapping it to one with the same glyphs.
    test('draws the same without a personal font configuration', async (t) => {
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'og-image-fontconfig-'));
        t.after(() => fs.rmSync(empty, { recursive: true, force: true }));
        const svg = ogImageSvg(template, '0.9.4 Beta');
        const own = await pixels(renderPng(svg));
        const reference = await pixels(fs.readFileSync(new URL('../fixtures/og-image-0.9.4-inkscape.png', import.meta.url)));
        const saved = process.env.XDG_CONFIG_HOME;
        process.env.XDG_CONFIG_HOME = empty;
        try {
            const plain = await pixels(renderPng(svg));
            assert.deepEqual(differingRows(plain, own), []);
            assert.deepEqual(differingRows(plain, reference, 32), []);
        } finally {
            if (saved === undefined) delete process.env.XDG_CONFIG_HOME;
            else process.env.XDG_CONFIG_HOME = saved;
        }
    });

    test('changes nothing but the release line for another release', async () => {
        const a = await pixels(renderPng(ogImageSvg(template, '0.9.4 Beta')));
        const b = await pixels(renderPng(ogImageSvg(template, '0.9.5')));
        const rows = differingRows(a, b);
        assert.ok(rows.length > 0, 'the release line did not change');
        assert.ok(rows[0] >= 150 && rows.at(-1) <= 190, `rows ${rows[0]}–${rows.at(-1)} changed`);
    });

    // Inkscape wrote a PNG and exited with 0 even for a broken drawing.
    test('fails for a broken drawing', () => {
        assert.throws(() => renderPng('<svg><text>unclosed</svg>'), /rsvg-convert failed to render og-image\.png: .+/);
    });

    test('says what is missing when rsvg-convert is not installed', () => {
        const saved = process.env.PATH;
        process.env.PATH = '/nonexistent';
        try {
            assert.throws(() => renderPng('<svg/>'), /rsvg-convert is needed .* librsvg package/);
        } finally {
            process.env.PATH = saved;
        }
    });
});
