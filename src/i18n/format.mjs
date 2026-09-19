// Days and numbers as each language writes them. Intl knows most of it; where
// its locale data contradicts the official rules of a variant, this says so.

// French and Italian write the first of a month as an ordinal, which Intl
// does not: "1er mai 2026" (Chancellerie fédérale), "1° maggio 2026"
// (Cancelleria federale).
const FIRST_OF_THE_MONTH = { fr: '1er', it: '1°' };

/** A day, its month written out: "12 September 2026", "1er mai 2026". */
export function formatDay(date, lang = 'en-GB', timeZone = undefined) {
    const text = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(date);
    const day = Number(new Intl.DateTimeFormat('en', { day: 'numeric', timeZone }).format(date));
    const first = FIRST_OF_THE_MONTH[lang.split('-')[0]];
    return day === 1 && first ? text.replace(/^1(?=\s)/, first) : text;
}

// CLDR assigns a decimal point to de-CH and it-CH; the Federal Chancellery
// writes a decimal comma in both, as German and Italian do everywhere else.
const NUMBER_LOCALE = { 'de-CH': 'de', 'it-CH': 'it' };

/** A small number, one decimal at most, ungrouped: "1.5", "1,5". */
export const formatNumber = (n, lang = 'en-GB') =>
    new Intl.NumberFormat(NUMBER_LOCALE[lang] ?? lang, { maximumFractionDigits: 1, useGrouping: false }).format(n);
