import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Spelling, verified using hunspell against the dictionary of each language
// and the words of this project that no dictionary has: names of programs,
// packages and people, and technical terms the translations keep in English.
// Each word in i18n/vocabulary/ was inserted by someone who examined it; a
// word there is accepted in every unit of its language.
//
// Only prose is checked. Code, link targets, addresses, placeholders and
// markup are removed first, since they are right as they are and no
// dictionary knows them.

export const DICTIONARIES = {
    'en-GB': 'en_GB',
    'de-CH': 'de_CH',
    'fr-CH': 'fr_CH',
    'it-CH': 'it_CH',
    'es-419': 'es',
    rm: 'i18n/dictionaries/rm/rm-rumgr',
};

/** The words of a unit a reader reads, without code, targets and markup. */
export function proseOf(text) {
    return text
        .replace(/^\s*```[\s\S]*?^\s*```/gm, ' ')
        .replace(/(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)/g, ' ')
        // Markup before addresses: an address inside a tag goes with the tag.
        .replace(/<code>[\s\S]*?<\/code>/g, ' ')
        .replace(/<\/?[a-zA-Z][^<>]*>/g, ' ')
        .replace(/\]\([^)]*\)/g, '] ')
        .replace(/^\[[^\]]+\]:\s*\S+/gm, ' ')
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, ' ')
        .replace(/\{\{\s*[\w-]+\s*\}\}|\[(?:SEARCH_TERM|DIFFERENT_TERM|COUNT)\]/g, ' ')
        .replace(/[*_]{1,2}|[#>|[\]]/g, ' ')
        // The rule beneath the head of a table, | ---
        // |.
        .replace(/:?-{3,}:?/g, ' ')
        // A path or a file name is a literal too: /etc/pacman.conf, *.pacnew.
        .replace(/(?:^|\s)[~.]?\/\S+|\S*\.(?:conf|service|hook|kdl|json|md|mdx|log|sh|iso|sig|sha256|img|zst|ko|png|pacnew)\b/g, ' ')
        // So is a domain named as text, gnulinux.ch, and a word with a digit
        // in it: ARM64, K3100M, 470xx, v2.
        .replace(/\b[\w-]+(?:\.[a-z][\w-]*)+(?:\/\S*)?/g, ' ')
        .replace(/[\p{L}\d-]*\d[\p{L}\d-]*/gu, ' ')
        // A closing single quote is punctuation, not an apostrophe: ‘IBPB’.
        .replace(/’(?!\p{L})/gu, ' ');
}

/** English prose for hunspell: a possessive is its noun, whichever apostrophe it has. */
export const englishProseOf = (text) => proseOf(text.replace(/([\p{L}\d])['’]s\b/gu, '$1'));

export function vocabulary(root, lang) {
    const words = [];
    for (const file of ['common.txt', `${lang}.txt`]) {
        const full = path.join(root, 'i18n/vocabulary', file);
        if (!fs.existsSync(full)) continue;
        words.push(...fs.readFileSync(full, 'utf8').split('\n').map((line) => line.replace(/#.*/, '').trim()).filter(Boolean));
    }
    return words;
}

function unknownWords(root, lang, text) {
    const dictionary = DICTIONARIES[lang];
    if (!dictionary) throw new Error(`No hunspell dictionary is set for ${lang}`);
    const dict = dictionary.includes('/') ? path.join(root, dictionary) : dictionary;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ditana-spelling-'));
    const personal = path.join(dir, 'words');
    fs.writeFileSync(personal, `${vocabulary(root, lang).join('\n')}\n`);
    try {
        const result = spawnSync('hunspell', ['-l', '-i', 'UTF-8', '-d', dict, '-p', personal], { input: text, encoding: 'utf8' });
        if (result.error) throw new Error(`hunspell could not be run: ${result.error.message}`);
        if (result.status !== 0) throw new Error(`hunspell failed for ${lang}:\n${result.stderr}`);
        // de_CH counts a full stop to be part of a word, especially in
        // abbreviations, and reports "Aktualisirung." at the end of a
        // sentence; en_GB reports the same word without the full stop.
        return [...new Set(result.stdout.split('\n').map((word) => word.replace(/\.+$/, '')).filter(Boolean))];
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

/**
 * The terms in `text` that neither the dictionary of `lang` nor the
 * vocabulary knows, each once. A translation keeps English terms and the
 * English labels of the programs it describes, so a word the English
 * dictionary knows is no misspelling there; English left untranslated by
 * mistake is for the review of meaning to find, not for this check.
 */
export function misspelled(root, lang, text) {
    const unknown = unknownWords(root, lang, text);
    if (lang === 'en-GB' || unknown.length === 0) return unknown;
    const notEnglish = new Set(unknownWords(root, 'en-GB', unknown.join('\n')));
    return unknown.filter((word) => notEnglish.has(word));
}

/**
 * The unknown words of many units, found in one run of hunspell and traced
 * back to the units they occur in: [{ where, word }].
 */
export function misspelledUnits(root, lang, units) {
    if (units.length === 0) return [];
    const unknown = misspelled(root, lang, units.map(({ text }) => text).join('\n'));
    if (unknown.length === 0) return [];
    const found = [];
    for (const { where, text } of units) {
        for (const word of unknown) {
            const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(text)) found.push({ where, word });
        }
    }
    return found;
}
