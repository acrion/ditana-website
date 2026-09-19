import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readReleaseNotes, releaseNotesDir } from './read-release-notes.mjs';
import { currentReleaseView } from './releases.mjs';
import { checkMarkdownPages, releaseMarkdownPlugin } from './markdown.mjs';

const VIRTUAL_ID = 'virtual:ditana/release';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/**
 * Hands the release records, read once in astro.config.mjs, to the parts of
 * the site that cannot import the config: Markdown pages via the Satteri
 * plugin, MDX pages and endpoints through `virtual:ditana/release`.
 */
export function releaseIntegration({ docsDir, releases, strings }) {
    const current = currentReleaseView(releases);
    const docsPath = docsDir instanceof URL ? fileURLToPath(docsDir) : docsDir;
    return {
        name: 'ditana-release',
        hooks: {
            'astro:config:setup': ({ config, updateConfig }) => {
                checkMarkdownPages(docsPath, releases);

                const processor = config.markdown.processor;
                if (processor?.name !== 'satteri') {
                    throw new Error(`ditana-release expects the Satteri Markdown processor, found ${processor?.name}`);
                }
                processor.options.mdastPlugins.push(releaseMarkdownPlugin(releases, { docsDir, strings }));

                updateConfig({
                    vite: {
                        plugins: [{
                            name: 'ditana-release',
                            resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : undefined),
                            load: (id) => (id === RESOLVED_ID
                                ? `export const current = ${JSON.stringify(current)};`
                                : undefined),
                        }],
                    },
                });
            },

            // The records are read upon the evaluation of the config. Astro can
            // trigger a restart of the dev server when a watched file is
            // modified, but such a restart does not render Markdown anew: the
            // sidebar and the landing page would move to a new release while
            // the download page stayed at the old one. Thus, nothing is watched
            // for a restart; instead, a change to the releases is reported.
            'astro:server:setup': ({ server, logger }) => {
                const notesDir = releaseNotesDir(docsPath);
                const atStartup = JSON.stringify(releases);
                let reported = atStartup;
                server.watcher.on('all', (_event, file) => {
                    if (path.dirname(file) !== notesDir || !/\.mdx?$/.test(file)) return;
                    let now;
                    try {
                        now = JSON.stringify(readReleaseNotes(docsPath));
                    } catch (error) {
                        logger.warn(error.message);
                        return;
                    }
                    if (now === reported) return;
                    reported = now;
                    if (now !== atStartup) {
                        logger.warn('The release notes describe other releases than when the dev server started. '
                            + 'Stop the dev server and start it again; until then, the sidebar, the landing page, '
                            + 'the download page and the preview image show the releases as they were.');
                    }
                });
            },
        },
    };
}
