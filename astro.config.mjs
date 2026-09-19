// @ts-check
import fs from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import { releaseIntegration } from './src/release/integration.mjs';
import { readReleaseNotes } from './src/release/read-release-notes.mjs';
import { currentRelease, currentReleaseView, placeholderValues, releaseNotesSidebar } from './src/release/releases.mjs';
import { fillKnownPlaceholders } from './src/release/markdown.mjs';
import { generateTranslations } from './src/i18n/generate.mjs';
import { sitemapI18n, starlightLocales } from './src/i18n/locales.mjs';
import { i18nIntegration } from './src/i18n/integration.mjs';
import { languageChoiceScript } from './src/i18n/choose-language.mjs';
import { labelled, readUiStrings } from './src/i18n/ui.mjs';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, ogImageSvg, ogImageUrl } from './src/og-image/render.mjs';

const site = 'https://ditana.org';

// Which release is current is written once, in the frontmatter of its release
// notes: the newest notes that carry a release date. The sidebar, the landing
// page, the download page and the preview image all follow from there.
const docsDir = new URL('./src/content/docs/', import.meta.url);
const releases = readReleaseNotes(docsDir);

// The translations are written from po/ prior to anything reads them. A
// translated heading gets the id of the English one, which Astro takes from
// the heading as the page shows it, with the release populated.
const values = placeholderValues(currentRelease(releases));
generateTranslations(new URL('./', import.meta.url), { substitute: (text) => fillKnownPlaceholders(text, values) });

// The interface strings of every language, for the labels of the sidebar and
// the lines at the top of the release notes.
const ui = readUiStrings(new URL('./src/', import.meta.url));
const label = (key, values) => labelled(ui, key, values);

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
        // Starlight adds a sitemap by default if none exists. Its own
        // carries each language's `lang`, and the sitemap's schema refuses
        // "es-419" (letters and hyphens only) and then writes no sitemap at
        // all, with a warning.
        sitemap({ i18n: sitemapI18n() }),
        releaseIntegration({ docsDir, releases, strings: ui }),
        i18nIntegration({ docsDir }),
        starlight({
            title: 'Ditana',

            defaultLocale: 'root',
            locales: starlightLocales(),
            routeMiddleware: './src/i18n/route-data.mjs',

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
                { ...label('sidebar.download'), slug: 'download' },
                { ...label('sidebar.builds'), slug: 'builds' },
                {
                    ...label('sidebar.troubleshooting'),
                    items: [
                        { ...label('sidebar.troubleshooting.overview'), slug: 'troubleshooting' },
                        { ...label('sidebar.troubleshooting.updating'), slug: 'troubleshooting/updating' },
                        { ...label('sidebar.troubleshooting.signature-errors'), slug: 'troubleshooting/signature-errors' },
                        { ...label('sidebar.troubleshooting.an-update-broke-something'), slug: 'troubleshooting/an-update-broke-something' },
                        { ...label('sidebar.troubleshooting.flatpak-and-bubblejail'), slug: 'troubleshooting/flatpak-and-bubblejail' },
                        { ...label('sidebar.troubleshooting.chromium-sandbox-helper'), slug: 'troubleshooting/chromium-sandbox-helper' },
                        { ...label('sidebar.troubleshooting.reporting-a-bug'), slug: 'troubleshooting/reporting-a-bug' },
                    ],
                },
                {
                    ...label('sidebar.release-notes'),
                    items: releaseNotesSidebar(releases, (release) => label('sidebar.release-notes.current', { release })),
                },
                {
                    ...label('sidebar.best-practices'),
                    items: [
                        { ...label('sidebar.best-practices.overview'), slug: 'best-practices' },
                        { ...label('sidebar.best-practices.automatic-system-snapshots'), slug: 'best-practices/automatic-system-snapshots' },
                        { ...label('sidebar.best-practices.aur-vs-flatpak'), slug: 'best-practices/aur-vs-flatpak' },
                        { ...label('sidebar.best-practices.virtual-machines'), slug: 'best-practices/virtual-machines' },
                    ],
                },
                {
                    ...label('sidebar.under-the-hood'),
                    items: [
                        { ...label('sidebar.under-the-hood.overview'), slug: 'under-the-hood' },
                        { ...label('sidebar.under-the-hood.configuration-as-data'), slug: 'under-the-hood/configuration-as-data' },
                        { ...label('sidebar.under-the-hood.hardware-detection'), slug: 'under-the-hood/hardware-detection' },
                        { ...label('sidebar.under-the-hood.settings-logic'), slug: 'under-the-hood/settings-logic' },
                        { ...label('sidebar.under-the-hood.mitigations'), slug: 'under-the-hood/mitigations' },
                    ],
                },
                { ...label('sidebar.donate'), slug: 'donate' },
                { ...label('sidebar.who-we-are'), slug: 'who-we-are' },
                { ...label('sidebar.licensing'), slug: 'licensing' },
            ],

            // Dark throughout, and not as a default: ThemeSelect is replaced
            // by an empty component, so there is no toggle to flip. The amber
            // accent is calibrated for a dark background and would have to be
            // recalibrated before a light theme could be offered.
            components: {
                ThemeProvider: './src/components/ForceDarkTheme.astro',
                ThemeSelect: './src/components/EmptyComponent.astro',
                Footer: './src/components/Footer.astro',
                SocialIcons: './src/components/SocialIcons.astro',
            },

            head: [
                { tag: 'script', content: languageChoiceScript() },
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
