// What a translation must preserve precisely as the English text presents it.
// A reader types a command, follows a link, compares a version; none of that
// may change in translation, and a model that translates rewrites them as
// readily as prose. Each kind of literal is compared between the English unit
// and its translation as a collection: languages order a sentence
// differently, so the order is free, but nothing may be added, lost, or
// altered.
//
// Code units, the fenced code blocks and the imports and component tags of an
// MDX page, are translated as themselves and must stay identical.

const all = (re, text) => [...text.matchAll(re)].map((match) => match[1] ?? match[0]);

// Inline code first: a URL or a number inside backticks belongs to the code
// span, and is compared there only.
const CODE_SPAN = /(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)/g;
const withoutCode = (text) => text.replace(CODE_SPAN, ' ');
const withoutTargets = (text) => withoutCode(text).replace(/\]\([^)]*\)/g, '] ').replace(/https?:\/\/\S+/g, ' ');

const LITERALS = {
    'inline code': (text) => [...text.matchAll(CODE_SPAN)].map((match) => match[0]),
    'link target': (text) => all(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, withoutCode(text)),
    'reference target': (text) => all(/^\[[^\]]+\]:\s*(\S+)/gm, withoutCode(text)),
    URL: (text) => all(/(?<![(\w])(https?:\/\/[^\s)>\]]+?)(?=[.,;:!?]?(?:\s|$|[)>\]]))/g, withoutCode(text)),
    'e-mail address': (text) => all(/(?<![\w.:/-])([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g, withoutCode(text)),
    // {{release}} on a page, {{error}} in an interface string, and the tokens
    // Pagefind fills in.
    placeholder: (text) => all(/(\{\{\s*[\w-]+\s*\}\}|\[(?:SEARCH_TERM|DIFFERENT_TERM|COUNT)\])/g, text),
    'HTML tag': (text) => all(/(<\/?[a-zA-Z][\w-]*(?:\s[^<>]*)?\/?>)/g, withoutCode(text)),
    'bold marker': (text) => all(/(\*\*|__)/g, withoutCode(text)),
    // Digits, not number formats: "2.6 GB" may become "2,6 GB", but no figure
    // may change, appear or disappear.
    number: (text) => all(/(\d+)/g, withoutTargets(text)),
};

const sameCollection = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

// The shape of a unit is Markdown as well: a paragraph indented by two
// spaces is part of the list item above it, and a table keeps its rows only
// as long as each line still begins with a pipe. Thus, the lines of a
// translation, in order, must begin just as the English ones do.
const lineStarts = (text) => text.split('\n').map((line) => /^\s*\|?/.exec(line)[0]);

export const isCodeUnit = (unit) => unit.comments.some((comment) => comment.startsWith('type: Fenced code block'))
    || /^(import |export |<[A-Z])/.test(unit.msgid);

/**
 * The literals of `unit` that its translation does not keep, as messages.
 * An untranslated unit has nothing to compare; the completeness check
 * reports it.
 */
export function literalProblems(unit) {
    if (!unit.msgstr) return [];
    if (isCodeUnit(unit)) return unit.msgstr === unit.msgid ? [] : ['code is translated as itself'];
    const problems = [];
    if (JSON.stringify(lineStarts(unit.msgid)) !== JSON.stringify(lineStarts(unit.msgstr))) {
        problems.push(`lines: ${JSON.stringify(lineStarts(unit.msgid))} became ${JSON.stringify(lineStarts(unit.msgstr))}`);
    }
    for (const [kind, extract] of Object.entries(LITERALS)) {
        const english = extract(unit.msgid);
        const translated = extract(unit.msgstr);
        if (!sameCollection(english, translated)) {
            problems.push(`${kind}: ${JSON.stringify(english)} became ${JSON.stringify(translated)}`);
        }
    }
    return problems;
}
