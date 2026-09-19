import GithubSlugger from 'github-slugger';
import { markdownToHast, mdxToHast } from 'satteri';

// A translated heading keeps the id of the English one. Otherwise every link to
// a section, from another page or from outside, would break in each language
// separately, and the literal guard would have to let translators change link
// targets. The generated Markdown of a translation carries the id as a heading
// attribute, `## Titel {#title}`, which Satteri reads once the processor has
// `headingAttributes` switched on.
//
// The English ids are the ones Astro assigns to the English page:
// github-slugger applied to the text of each heading, in order, after the
// release placeholders are filled in. A test compares them with the ids of the
// built English pages.

function textOf(node) {
    if (node.type === 'text') return node.value;
    return (node.children ?? []).map(textOf).join('');
}

/** The headings of a Markdown or MDX page, in order: depth, text and source line. */
export function headingsOf(source, { mdx = false } = {}) {
    const tree = (mdx ? mdxToHast : markdownToHast)(source);
    const headings = [];
    const visit = (node) => {
        const match = node.type === 'element' && /^h([1-6])$/.exec(node.tagName);
        if (match) {
            headings.push({ depth: Number(match[1]), text: textOf(node), line: node.position.start.line });
            return;
        }
        for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
    return headings;
}

/** The ids Astro gives the headings of an English page. */
export function headingIds(source, { mdx = false, substitute = (text) => text } = {}) {
    const slugger = new GithubSlugger();
    return headingsOf(source, { mdx }).map(({ depth, text }) => ({ depth, id: slugger.slug(substitute(text)) }));
}

/**
 * The translated page with the English ids attached to its headings. Throws
 * when the translation lacks the headings of the English page, since the ids
 * could then land on the wrong sections.
 */
export function withEnglishIds(translated, englishIds, { mdx = false, where = 'page' } = {}) {
    const headings = headingsOf(translated, { mdx });
    const shape = (list) => list.map(({ depth }) => depth).join(',');
    if (shape(headings) !== shape(englishIds)) {
        throw new Error(`${where}: the translation has the headings ${shape(headings) || '(none)'}, `
            + `the English page ${shape(englishIds) || '(none)'} (levels, in order)`);
    }
    const lines = translated.split('\n');
    headings.forEach(({ line }, index) => {
        lines[line - 1] = `${lines[line - 1].trimEnd()} {#${englishIds[index].id}}`;
    });
    return lines.join('\n');
}
