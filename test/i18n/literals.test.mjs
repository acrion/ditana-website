import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isCodeUnit, literalProblems } from '../../src/i18n/literals.mjs';

const prose = (msgid, msgstr) => literalProblems({ comments: ['type: Plain text'], msgid, msgstr });

describe('a translation that keeps every literal', () => {
    test('passes, with the sentence rearranged and the number format of its language', () => {
        assert.deepEqual(prose(
            'Run `pacman -Syu`, then see [the keyring repair](/troubleshooting/signature-errors/#the-repair). The image is 2.6 GB.',
            'Das Abbild ist 2,6 GB gross. Siehe die [Reparatur des Schlüsselbunds](/troubleshooting/signature-errors/#the-repair), nachdem Sie `pacman -Syu` ausgeführt haben.',
        ), []);
    });

    test('passes when a number is written into a link target and nowhere else', () => {
        assert.deepEqual(prose('See the [0.9.4 notes](/release-notes/0-9-4-beta/).', 'Siehe die [Hinweise zu 0.9.4](/release-notes/0-9-4-beta/).'), []);
    });
});

describe('a translation is refused when it', () => {
    test('changes a command', () => {
        assert.match(prose('Run `pacman -Syu`.', 'Führen Sie `pacman -Sy` aus.')[0], /^inline code/);
    });

    test('translates inside backticks', () => {
        assert.match(prose('Open `Settings`.', 'Öffnen Sie `Einstellungen`.')[0], /^inline code/);
    });

    test('points a link elsewhere', () => {
        assert.match(prose('See [this](/download/).', 'Siehe [dies](/de-ch/download/).')[0], /^link target/);
    });

    test('loses a link', () => {
        assert.match(prose('See [this](/download/).', 'Siehe dies.')[0], /^link target/);
    });

    test('changes a bare address', () => {
        assert.match(prose('Report it at https://gitlab.archlinux.org/ please.', 'Melden Sie es auf https://gitlab.archlinux.org/de/.')[0], /^URL/);
    });

    test('changes an e-mail address', () => {
        assert.match(prose('Write to support@ditana.org.', 'Schreiben Sie an info@ditana.org.')[0], /^e-mail address/);
    });

    test('translates a placeholder', () => {
        assert.match(prose('Download {{release}}.', 'Laden Sie {{version}} herunter.')[0], /^placeholder/);
        assert.match(prose('[COUNT] results for [SEARCH_TERM]', '[ANZAHL] Ergebnisse für [SEARCH_TERM]')[0], /^placeholder/);
    });

    test('changes a figure', () => {
        assert.match(prose('It takes 15–45 minutes.', 'Es dauert 15–30 Minuten.')[0], /^number/);
    });

    test('adds a figure the English does not have', () => {
        assert.match(prose('Four desktops.', '4 Desktops.')[0], /^number/);
    });

    test('drops a bold passage', () => {
        assert.match(prose('**Never update a single package.** Why.', 'Aktualisieren Sie nie ein einzelnes Paket. Warum.')[0], /^bold marker/);
    });

    test('takes an indented paragraph out of its list item', () => {
        assert.match(prose('  (The one exception is the keyring.)\n', '(Die einzige Ausnahme ist der Schlüsselbund.)\n')[0], /^lines/);
    });

    test('loses a row of a table', () => {
        assert.match(prose('| A | B |\n| --- | --- |\n| x | y |\n', '| A | B |\n| --- | --- |\n')[0], /^lines/);
    });

    test('changes an HTML tag', () => {
        assert.match(prose('Line<br>break', 'Zeilen<br/>umbruch')[0], /^HTML tag/);
    });
});

describe('a code unit', () => {
    const block = (msgid, msgstr) => ({ comments: ['type: Fenced code block (sh)'], msgid, msgstr });

    test('is a fenced code block, or an import or component tag of an MDX page', () => {
        assert.ok(isCodeUnit(block('ls\n', '')));
        assert.ok(isCodeUnit({ comments: ['type: Plain text'], msgid: "import { Image } from 'astro:assets';" }));
        assert.ok(isCodeUnit({ comments: ['type: Plain text'], msgid: '<Image src={stefan} alt="Stefan" />\n' }));
        assert.ok(!isCodeUnit({ comments: ['type: Plain text'], msgid: 'Imports are listed below.' }));
    });

    test('must stay exactly as it is, comments included', () => {
        assert.deepEqual(literalProblems(block('ls  # list\n', 'ls  # list\n')), []);
        assert.deepEqual(literalProblems(block('ls  # list\n', 'ls  # auflisten\n')), ['code is translated as itself']);
    });
});

describe('an untranslated unit', () => {
    test('has no literals to compare; the completeness check reports it', () => {
        assert.deepEqual(prose('Run `ls`.', ''), []);
    });
});
