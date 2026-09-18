// @ts-check
import fs from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { releaseIntegration } from './src/release/integration.mjs';
import { readReleaseNotes } from './src/release/read-release-notes.mjs';
import { currentReleaseView, releaseNotesSidebar } from './src/release/releases.mjs';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, ogImageSvg, ogImageUrl } from './src/og-image/render.mjs';

const site = 'https://ditana.org';

// Which release is current is written once, in the frontmatter of its release
// notes: the newest notes that carry a release date. The sidebar, the landing
// page, the download page and the preview image all follow from there.
const docsDir = new URL('./src/content/docs/', import.meta.url);
const releases = readReleaseNotes(docsDir);

const ogImage = ogImageUrl(site, ogImageSvg(
    fs.readFileSync(new URL('./src/og-image/template.svg', import.meta.url), 'utf8'),
    currentReleaseView(releases).name,
));

// https://astro.build/config
export default defineConfig({
    site,

    // The build history under /build-history/ is written by the package
    // pipeline, not by this site -- publish-ditana-website.sh excludes the path
    // so that a website deploy cannot delete it. It therefore does not exist in
    // a local dist/, and the dashboard would have nothing to read. Proxying the
    // path to the live server during development shows the real records
    // instead of a fixture that could drift away from the pipeline's format.
    vite: {
        server: {
            proxy: {
                '/build-history': {
                    target: 'https://ditana.org',
                    changeOrigin: true,
                },
            },
        },
    },

    // Astro normalises the trailing slash before matching, so '/docs' already
    // covers '/docs/'. Listing both defines the same route twice, which the
    // router warns about today and will reject outright in a later version.
    //
    // These exist because the addresses are already published and cannot be
    // recalled. '/installer' stands in the licence header of every installer
    // source file that ships on the medium; '/docs/the-packages' is in the
    // installer's CONTRIBUTING.md; '/mitigations' was linked from the landing
    // page and from the 0.9.3 release notes. None of the three ever resolved.
    redirects: {
        '/docs': '/best-practices/',
        '/installer': '/download/',
        '/docs/the-packages': '/builds/',
        '/mitigations': '/under-the-hood/mitigations/',
    },

    integrations: [
        releaseIntegration({ docsDir, releases }),
        starlight({
            title: 'Ditana',

            logo: {
                src: './src/assets/logo.svg',
                replacesTitle: false,
                alt: 'Ditana',
            },

            customCss: [
                './src/styles/custom.css',
                './src/styles/landing.css',
            ],

            social: [
                {
                    icon: 'github',
                    label: 'GitHub',
                    href: 'https://github.com/acrion/ditana-config',
                },
                {
                    icon: 'discord',
                    label: 'Discord — community chat',
                    href: 'https://discord.gg/RgcdumdE9J',
                },
            ],

            // The sidebar mirrors the top-level information architecture and
            // stays stable across releases. It is shown on every page, the
            // landing page included: that page uses the default template
            // rather than Starlight's splash one.
            sidebar: [
                { label: 'Download', slug: 'download' },
                { label: 'Build status', slug: 'builds' },
                {
                    label: 'Troubleshooting',
                    items: [
                        { label: 'Overview', slug: 'troubleshooting' },
                        { label: 'Updating', slug: 'troubleshooting/updating' },
                        { label: 'Signature errors', slug: 'troubleshooting/signature-errors' },
                        { label: 'An update broke something', slug: 'troubleshooting/an-update-broke-something' },
                        { label: 'Rescue system', slug: 'troubleshooting/rescue-system' },
                        { label: 'Flatpak and Bubblejail', slug: 'troubleshooting/flatpak-and-bubblejail' },
                        { label: 'Chromium sandbox helper', slug: 'troubleshooting/chromium-sandbox-helper' },
                        { label: 'Reporting a bug', slug: 'troubleshooting/reporting-a-bug' },
                    ],
                },
                { label: 'Release notes', items: releaseNotesSidebar(releases) },
                {
                    label: 'Best practices',
                    items: [
                        { label: 'Overview', slug: 'best-practices' },
                        { label: 'Automatic system snapshots', slug: 'best-practices/automatic-system-snapshots' },
                        { label: 'AUR vs Flatpak', slug: 'best-practices/aur-vs-flatpak' },
                        { label: 'Virtual machines', slug: 'best-practices/virtual-machines' },
                    ],
                },
                {
                    label: 'Under the hood',
                    items: [
                        { label: 'Overview', slug: 'under-the-hood' },
                        { label: 'Configuration as data', slug: 'under-the-hood/configuration-as-data' },
                        { label: 'Hardware detection', slug: 'under-the-hood/hardware-detection' },
                        { label: 'Settings logic', slug: 'under-the-hood/settings-logic' },
                        { label: 'CPU mitigations', slug: 'under-the-hood/mitigations' },
                    ],
                },
                { label: 'Donate', slug: 'donate' },
                { label: 'Who we are', slug: 'who-we-are' },
                { label: 'Licensing', slug: 'licensing' },
            ],

            // Dark throughout, and not as a default: ThemeSelect is replaced
            // by an empty component, so there is no toggle to flip. The amber
            // accent is calibrated for a dark background and would have to be
            // recalibrated before a light theme could be offered.
            components: {
                ThemeProvider: './src/components/ForceDarkTheme.astro',
                ThemeSelect: './src/components/EmptyComponent.astro',
            },

            head: [
                {
                    tag: 'meta',
                    attrs: { property: 'og:image', content: ogImage },
                },
                {
                    tag: 'meta',
                    attrs: { name: 'twitter:card', content: 'summary_large_image' },
                },
                {
                    tag: 'meta',
                    attrs: { name: 'theme-color', content: '#0d1117' },
                },
                {
                    tag: 'meta',
                    attrs: { property: 'og:image:width', content: String(OG_IMAGE_WIDTH) },
                },
                {
                    tag: 'meta',
                    attrs: { property: 'og:image:height', content: String(OG_IMAGE_HEIGHT) },
                },
            ],

            // The Starlight credit line is suppressed site-wide, the landing
            // page included. This is Starlight's own default; it is written
            // out so that a later change of that default cannot bring the line
            // back unnoticed.
            credits: false,
        }),
    ],
});
