// The typographic and grammatical rules of each language variant that a
// machine can check, taken from the official sources named beside each rule.
// A rule is a pattern that must not occur in the prose of a translated unit:
// its code, link targets, addresses and markup are removed first, since
// they are literals and right as they are.
//
// The sources:
//   BK-de   Schweizerische Bundeskanzlei, Schreibweisungen (2013) and
//           Rechtschreibleitfaden; Leitfaden zum geschlechtergerechten
//           Formulieren im Deutschen (2023)
//   ChF-fr  Chancellerie fédérale, Instructions sur la présentation des textes
//           officiels en français (2016); Guide de formulation inclusive (2023)
//   CaF-it  Cancelleria federale, Istruzioni per la redazione dei testi
//           ufficiali in italiano (2023, updated 2025); guida al linguaggio
//           inclusivo (2023)
//   BK-rm   Chanzlia federala, Grammatica elementara dal rumantsch grischun
//           (binding since 2009); regulaziuns da la lingua inclusiva (2023)
//   RAE     Real Academia Española and ASALE, Ortografía de la lengua
//           española (2010) and Diccionario panhispánico de dudas
//   UP      Український правопис, the state-language standard of 2026, whose
//           norms are those of the 2019 edition; § numbers are the 2019 ones

/**
 * A unit's text with what is not prose replaced by a neutral mark, §: code,
 * link targets, addresses, placeholders, and identifiers such as
 * hardened_malloc that the English writes as plain text. A mark, not a
 * space, so that "Datei `x`:" does not turn into a space before a colon; and
 * not a word, so that a rule about letters around a colon or an underscore
 * does not find "CODE:CODE" in "{{hour}}:{{minute}}".
 */
export function typographyText(text) {
    return text
        .replace(/^\s*```[\s\S]*?^\s*```/gm, '§')
        .replace(/(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)/g, '§')
        .replace(/\]\([^)]*\)/g, ']')
        .replace(/https?:\/\/[^\s)>\]]+/g, '§')
        .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '§')
        .replace(/<\/?[a-zA-Z][^<>]*>/g, '')
        .replace(/\{\{\s*[\w-]+\s*\}\}|\[(?:SEARCH_TERM|DIFFERENT_TERM|COUNT)\]/g, '§')
        .replace(/\b[a-z0-9]+(?:_[a-z0-9]+)+(?:-[a-z0-9]+)*\b/g, '§');
}

// A whole word from a list: \b knows only ASCII, and would find "tes" in
// "êtes".
const words = (list) => new RegExp(`(?<!\\p{L})(?:${list.join('|')})(?!\\p{L})`, 'gu');

const NBSP = '\u00A0';

// Shared by several languages.
const STRAIGHT_QUOTES = { rule: 'straight double quotes; use the quotation marks of the language', forbid: /"/g };
const STRAIGHT_APOSTROPHE = { rule: 'typewriter apostrophe; use ’ (U+2019)', forbid: /\p{L}'\p{L}/gu };
const EM_DASH = { rule: 'em dash; the dash is the en dash – (U+2013)', forbid: /—/g };
const THREE_DOTS = { rule: 'three full stops; use the ellipsis … (U+2026)', forbid: /\.\.\./g };
const SPACE_BEFORE_MARK = { rule: 'space before : ; ! ?', forbid: /[ \u00A0\u202F][:;!?](?=\s|$)/g };
const APOSTROPHE_THOUSANDS = { rule: 'apostrophe between digit groups; group with a no-break space from five digits', forbid: /\d['’]\d{3}(?!\d)/g };
const PERCENT_WITHOUT_SPACE = { rule: 'no space between number and %; put a no-break space', forbid: /\d%/g };

export const RULES = {
    'de-CH': [
        // BK-de, Rechtschreibleitfaden Rz. 1.7: "ss" in all positions, SS in capitals.
        { rule: 'ß or ẞ; Swiss German writes ss', forbid: /[ßẞ]/g },
        // BK-de, Schreibweisungen Rz. 202–206: « », nested ‹ ›, no inner spaces.
        STRAIGHT_QUOTES,
        { rule: '„ “ ” or » «; use « » and, nested, ‹ ›', forbid: /[„“”]|(^|\s)»(?=\S)/g },
        { rule: 'space inside « » or ‹ ›', forbid: /[«‹][ \u00A0]|[ \u00A0][»›]/g },
        STRAIGHT_APOSTROPHE,
        // BK-de, Schreibweisungen Rz. 512: the apostrophe grouping is outdated.
        APOSTROPHE_THOUSANDS,
        PERCENT_WITHOUT_SPACE,
        SPACE_BEFORE_MARK,
        EM_DASH,
        THREE_DOTS,
        // BK-de, Schreibweisungen: readers are addressed with "Sie".
        { rule: 'informal address; use Sie', forbid: words(['[Dd]u', '[Dd]ich', '[Dd]ir', '[Dd]ein(?:e|en|em|er|es)?', '[Ee]uch', '[Ee]uer', '[Ee]ure(?:n|m|r|s)?']) },
        // Gender guide 2023: no gender symbols, no internal capital I.
        { rule: 'gender symbol or internal capital I; use pair forms or neutral wording', forbid: /\p{L}[*:_·](?:in|innen)\b|\p{Ll}In(?:nen)?\b/gu },
    ],
    'fr-CH': [
        // ChF-fr (2016), ch. on punctuation: « » with a no-break space inside.
        STRAIGHT_QUOTES,
        { rule: '“ ” or „; use « » and, nested, ‹ ›', forbid: /[“”„]/g },
        { rule: 'no no-break space (U+00A0) inside « »', forbid: new RegExp(`«(?!${NBSP})|(?<!${NBSP})»`, 'g') },
        // ChF-fr (2016): a no-break space (U+00A0) before : ; ! ?, never omitted.
        { rule: 'no no-break space (U+00A0) before : ; ! ?', forbid: new RegExp(`(?<!${NBSP})[:;!?](?=\\s|$)`, 'g') },
        { rule: 'narrow no-break space (U+202F); the Chancellery uses U+00A0', forbid: /\u202F/g },
        STRAIGHT_APOSTROPHE,
        // ChF-fr (2016), annex: thousands with a space from five digits; no apostrophe.
        APOSTROPHE_THOUSANDS,
        PERCENT_WITHOUT_SPACE,
        { rule: 'n° with a degree sign; write n<sup>o</sup>', forbid: /\b[nN][°º]/g },
        EM_DASH,
        THREE_DOTS,
        // ChF-fr, Guide de formulation inclusive (2023): no typographic gender markers.
        { rule: 'typographic gender marker; use epicene or collective nouns', forbid: /\p{L}[·•]\p{L}|\p{L}\(e\)s?\b|\p{L}\.e\.s?\b/gu },
        { rule: 'informal address; use vous', forbid: words(['[Tt]u', '[Tt]oi', '[Tt]on', '[Tt]a', '[Tt]es']) },
    ],
    'it-CH': [
        // CaF-it (2023), ch. 6: « » without inner spaces; “ ” only inside them.
        STRAIGHT_QUOTES,
        { rule: '„ ; use « » and, nested, “ ”', forbid: /„/g },
        { rule: 'space inside « »', forbid: /«[ \u00A0]|[ \u00A0]»/g },
        STRAIGHT_APOSTROPHE,
        // CaF-it: the capital of è is È, never E'.
        { rule: 'E’ for È', forbid: /\bE['’](?!\p{L})/gu },
        // CaF-it: no space before ; : ! ?
        SPACE_BEFORE_MARK,
        // CaF-it, ch. 5: groups of three with a no-break space from five digits.
        APOSTROPHE_THOUSANDS,
        PERCENT_WITHOUT_SPACE,
        EM_DASH,
        THREE_DOTS,
        { rule: 'informal address; tu is never used', forbid: words(['[Tt]u', '[Tt]uo', '[Tt]ua', '[Tt]uoi', '[Tt]ue']) },
        // CaF-it, inclusive-language guide (2023): no asterisk, @, schwa, middle dot.
        { rule: 'gender symbol; use the inclusive masculine, collective nouns or impersonal forms', forbid: /\p{L}[*@·]\p{L}|[əз]/gu },
    ],
    rm: [
        // BK-rm: « », nested ‹ ›, no inner spaces.
        STRAIGHT_QUOTES,
        { rule: '“ ” or „; use « » and, nested, ‹ ›', forbid: /[“”„]/g },
        { rule: 'space inside « » or ‹ ›', forbid: /[«‹][ \u00A0]|[ \u00A0][»›]/g },
        STRAIGHT_APOSTROPHE,
        SPACE_BEFORE_MARK,
        { rule: 'apostrophe between digit groups', forbid: /\d['’]\d{3}(?!\d)/g },
        EM_DASH,
        THREE_DOTS,
        // BK-rm, grammar §167 and §314: Vus, As and Voss are capitalized; ti is never used.
        { rule: 'formal address in lower case; write Vus, Voss', forbid: words(['vus', 'voss', 'vossa', 'vossas']) },
        { rule: 'informal address; use Vus', forbid: words(['[Tt]i', '[Tt]ai', '[Tt]es']) },
        // Dates as 12-05-2010 or in words, never with dots.
        { rule: 'date with dots; write 12-05-2010 or 12 da matg 2010', forbid: /\b\d{1,2}\.\d{1,2}\.\d{4}\b/g },
        // BK-rm (2023): no gender symbols and no capital-A endings.
        { rule: 'gender symbol; use double forms or neutral wording', forbid: /\p{L}[*:_·]\p{L}|\p{Ll}As\b/gu },
    ],
    'es-419': [
        STRAIGHT_QUOTES,
        { rule: '„; use « » or “ ”', forbid: /„/g },
        STRAIGHT_APOSTROPHE,
        // RAE, Ortografía 2010, 3.4.1: a question or exclamation opens with ¿ ¡.
        { rule: 'question or exclamation without its opening mark', check: (text) => (count(text, '?') !== count(text, '¿') ? ['¿ … ?'] : [])
            .concat(count(text, '!') !== count(text, '¡') ? ['¡ … !'] : []) },
        // RAE, Ortografía 2010: the decimal sign is the point; digits are not
        // grouped with a comma.
        { rule: 'decimal or grouping comma between digits; the decimal sign is the point', forbid: /\d,\d/g },
        PERCENT_WITHOUT_SPACE,
        // The raya of an aside touches the words it encloses; a spaced en dash is English.
        { rule: 'spaced en dash; set an aside with rayas —así—', forbid: / – /g },
        THREE_DOTS,
        // DPD, "usted": readers are addressed with usted, never tú, vos or vosotros.
        { rule: 'informal address; use usted', forbid: words(['[Tt]ú', '[Tt]u', '[Tt]us', '[Cc]ontigo', '[Vv]osotr[oa]s', '[Vv]uestr[oa]s?']) },
        { rule: 'gender marker; RAE rejects @, x and e endings', forbid: /\p{L}@\p{L}/gu },
    ],
};

RULES.uk = [
    // UP § 164: «…», and “…” inside them.
    STRAIGHT_QUOTES,
    { rule: '„; use «…» and, nested, “…”', forbid: /„/g },
    // One apostrophe for the whole site, the one the official text of the
    // orthography uses.
    { rule: 'apostrophe other than ’ (U+2019)', forbid: /\p{L}['ʼ]\p{L}/gu },
    THREE_DOTS,
    // UP § 60: ви in lower case; the capital is for letters to one person.
    { rule: 'informal address; use ви', forbid: words(['[Тт]и', '[Тт]ебе', '[Тт]обі', '[Тт]вій', '[Тт]воя', '[Тт]воє', '[Тт]вої', '[Тт]вого', '[Тт]воїх']) },
    { rule: 'capital Ви inside a sentence', forbid: /(?<=\p{Ll}[,;:]? )(?:Ви|Вас|Вам|Вами|Ваш\p{L}*)(?!\p{L})/gu },
    { rule: 'Russian letter', forbid: /[ъыэёЪЫЭЁ]/g },
    { rule: 'Latin letter in a Cyrillic word', forbid: /(?=[\p{L}’]*\p{Script=Cyrillic})(?=[\p{L}’]*\p{Script=Latin})[\p{L}’]+/gu },
    { rule: 'gender form with a slash or brackets', forbid: /\p{L}\/(?:ка|ки|ці)(?!\p{L})|\p{L}\((?:ка|ки)\)/gu },
];

const count = (text, char) => text.split(char).length - 1;

/** The rules of `lang` that `text` breaks, each with what it found. */
export function typographyProblems(text, lang) {
    const prose = typographyText(text);
    const problems = [];
    for (const rule of RULES[lang] ?? []) {
        const found = rule.check ? rule.check(prose) : [...prose.matchAll(rule.forbid)].map((match) => match[0]);
        if (found.length) problems.push(`${rule.rule}: ${found.map((f) => JSON.stringify(f)).join(', ')}`);
    }
    return problems;
}
