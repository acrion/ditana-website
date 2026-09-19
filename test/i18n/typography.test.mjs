import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isCodeUnit } from '../../src/i18n/literals.mjs';
import { TRANSLATIONS } from '../../src/i18n/locales.mjs';
import { readPo } from '../../src/i18n/po.mjs';
import { RULES, typographyProblems } from '../../src/i18n/typography.mjs';

// Each rule of each language, with a sentence that keeps it and one that
// breaks it. The source of each rule is named beside it in
// `typography.mjs`.

const NBSP = '\u00A0';
const passes = (text, lang) => assert.deepEqual(typographyProblems(text, lang), [], text);
const fails = (text, lang, rule) => assert.ok(typographyProblems(text, lang).some((problem) => problem.startsWith(rule)),
    `${text}: expected "${rule}", got ${JSON.stringify(typographyProblems(text, lang))}`);

describe('Swiss Standard German', () => {
    test('keeps the rules', () => passes(`Führen Sie \`pacman -Syu\` aus: «Paket» ‹innen› mit 10${NBSP}000 Dateien und 5${NBSP}% der Grösse – Benutzerinnen und Benutzer.`, 'de-CH'));
    test('has no ß', () => fails('Die Grösse ist gross, nicht groß.', 'de-CH', 'ß or ẞ'));
    test('quotes with « »', () => {
        fails('Das „Paket“.', 'de-CH', '„ “ ”');
        fails('Das "Paket".', 'de-CH', 'straight double quotes');
        fails('Das »Paket« hier.', 'de-CH', '„ “ ”');
        fails('Das « Paket ».', 'de-CH', 'space inside');
    });
    test('groups thousands without an apostrophe', () => fails('Mit 10’000 Dateien.', 'de-CH', 'apostrophe between digit groups'));
    test('addresses the reader with Sie', () => {
        fails('Du musst das Paket aktualisieren.', 'de-CH', 'informal address');
        fails('Aktualisiere dein System.', 'de-CH', 'informal address');
    });
    test('has no gender symbols', () => {
        fails('Für Benutzer*innen.', 'de-CH', 'gender symbol');
        fails('Für BenutzerInnen.', 'de-CH', 'gender symbol');
        fails('Für Benutzer:innen.', 'de-CH', 'gender symbol');
    });
    // A colon following an inline code span is not a space preceding a
    // colon.
    test('reads code as a word', () => passes('Die Datei `pacman.conf`: so.', 'de-CH'));
});

describe('Swiss French', () => {
    test('keeps the rules', () => passes(`Vous êtes prêt${NBSP}: lancez «${NBSP}pacman${NBSP}» et \`ls\`${NBSP}! L’installation prend 12${NBSP}300 s – 5${NBSP}%.`, 'fr-CH'));
    test('puts a no-break space before : ; ! ? and inside « »', () => {
        fails('Vous êtes prêt: lancez-le.', 'fr-CH', 'no no-break space (U+00A0) before');
        fails('Vous êtes prêt : lancez-le.', 'fr-CH', 'no no-break space (U+00A0) before');
        fails(`Lancez « pacman${NBSP}».`, 'fr-CH', 'no no-break space (U+00A0) inside');
    });
    test('uses U+00A0, not the narrow no-break space', () => fails('Prêt\u202F?', 'fr-CH', 'narrow no-break space'));
    test('uses no English quotation marks', () => fails('Lancez “pacman”.', 'fr-CH', '“ ” or „'));
    test('addresses the reader with vous', () => {
        fails('Tu es prêt.', 'fr-CH', 'informal address');
        passes('Vous êtes prêt.', 'fr-CH');
    });
    test('has no typographic gender markers', () => {
        fails('Les utilisateur·rices.', 'fr-CH', 'typographic gender marker');
        fails('Les utilisateur(e)s.', 'fr-CH', 'typographic gender marker');
    });
    test('writes n° with a superscript o', () => fails('Le n° 5.', 'fr-CH', 'n° with a degree sign'));
});

describe('Swiss Italian', () => {
    test('keeps the rules', () => passes('È pronto: esegua «pacman» e l’utente vedrà “questo” – 5 %.', 'it-CH'));
    test('quotes with « » without inner spaces', () => fails('Esegua « pacman ».', 'it-CH', 'space inside'));
    test('writes È, not E’', () => fails('E’ pronto.', 'it-CH', 'E’ for È'));
    test('uses the typographic apostrophe', () => fails("L'utente.", 'it-CH', 'typewriter apostrophe'));
    test('never addresses the reader with tu', () => fails('Il tuo sistema.', 'it-CH', 'informal address'));
    // Markdown emphasis is not a gender asterisk.
    test('has no gender symbols, and tells them from emphasis', () => {
        fails('Gli utent*i.', 'it-CH', 'gender symbol');
        fails('Caro utentə.', 'it-CH', 'gender symbol');
        passes('Il *kernel* è pronto.', 'it-CH');
    });
});

describe('Romansh', () => {
    test('keeps the rules', () => passes('Installai il pachet: Vus stuais reaviar il sistem «ussa».', 'rm'));
    test('writes Vus and Voss with a capital', () => fails('Installai, vus stuais.', 'rm', 'formal address in lower case'));
    test('never addresses the reader with ti', () => fails('Ti stos installar.', 'rm', 'informal address'));
    test('writes no date with dots', () => fails('Ils 12.05.2010.', 'rm', 'date with dots'));
    // The rule pertains to gender symbols between letters, not to the
    // identifiers of a program or the placeholders of a string.
    test('tells a gender symbol from an identifier and from a placeholder', () => {
        fails('Ils students:as.', 'rm', 'gender symbol');
        passes('Il modus strict spectre_v2-user e hardened_malloc.', 'rm');
        passes('{{date}}, {{hour}}:{{minute}}', 'rm');
    });
});

describe('Latin American Spanish', () => {
    test('keeps the rules', () => passes('¿Instaló el paquete? ¡Listo! Ocupa 2.5 GB —si existe— y 50 %.', 'es-419'));
    test('opens a question and an exclamation', () => {
        fails('Instaló el paquete?', 'es-419', 'question or exclamation');
        fails('Listo!', 'es-419', 'question or exclamation');
    });
    test('writes the decimal point', () => fails('Ocupa 2,5 GB.', 'es-419', 'decimal or grouping comma'));
    test('sets an aside with rayas', () => fails('El paquete – si existe – se instala.', 'es-419', 'spaced en dash'));
    test('addresses the reader with usted', () => {
        fails('Si tú quieres.', 'es-419', 'informal address');
        fails('Vosotros podéis.', 'es-419', 'informal address');
    });
    // An e-mail address is not a gender marker.
    test('has no @ in a word, and tells it from an address', () => {
        fails('Querid@s usuari@s.', 'es-419', 'gender marker');
        passes('Escriba a support@ditana.org.', 'es-419');
    });
});

describe('Ukrainian', () => {
    test('keeps the rules', () => passes(`Натисніть «Встановити» — система оновиться, а ви побачите “звіт” за 5${NBSP}хвилин. Об’єкт.`, 'uk'));
    test('uses one apostrophe, U+2019', () => {
        fails("Об'єкт.", 'uk', 'apostrophe');
        fails('Обʼєкт.', 'uk', 'apostrophe');
    });
    test('addresses the reader with ви, in lower case', () => {
        fails('Натисни, якщо ти готовий.', 'uk', 'informal address');
        fails('Після цього Ви побачите звіт.', 'uk', 'capital Ви');
        passes('Ви побачите звіт.', 'uk');
    });
    test('has no Russian letters', () => fails('Объект ещё.', 'uk', 'Russian letter'));
    test('mixes no Latin letters into a Cyrillic word', () => fails('Система (з латинською \u0441→c): cистема.', 'uk', 'Latin letter in a Cyrillic word'));
    test('has no slash or bracket gender forms', () => fails('Кожен користувач/ка.', 'uk', 'gender'));
});

describe('the typography of each translation', () => {
    const repo = fileURLToPath(new URL('../../', import.meta.url));
    for (const { prefix, lang } of TRANSLATIONS.filter(({ lang }) => RULES[lang])) {
        test(prefix, () => {
            const problems = [];
            for (const file of fs.globSync(`po/**/${prefix}.po`, { cwd: repo }).toSorted()) {
                for (const unit of readPo(path.join(repo, file))) {
                    if (!unit.msgstr || unit.fuzzy || isCodeUnit(unit)) continue;
                    for (const problem of typographyProblems(unit.msgstr, lang)) problems.push(`${file}: ${unit.msgstr.slice(0, 50)}…: ${problem}`);
                }
            }
            assert.deepEqual(problems, []);
        });
    }
});
