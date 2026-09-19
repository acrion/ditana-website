import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readPo } from '../../src/i18n/po.mjs';

describe('a PO file, as the gates read it', () => {
    let dir;
    let units;
    before(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ditana-po-'));
        const file = path.join(dir, 'de-ch.po');
        fs.writeFileSync(file, `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"

#. type: Plain text
#: src/content/docs/a.md
msgid "Run \`grep -c '\\\\.ko$'\` and \\"quote\\"."
msgstr "Führen Sie \`grep -c '\\\\.ko$'\` aus, «Zitat»."

#. type: Fenced code block (sh)
#: src/content/docs/a.md
#, no-wrap
msgid "ls\\n"
"pwd\\n"
msgstr ""

#: src/content/docs/a.md
#, fuzzy
#| msgid "Old text."
msgid "New text."
msgstr "Alter Text."

msgctxt ".sidebar.best-practices.overview"
msgid "Overview"
msgstr "Übersicht"
`);
        units = readPo(file);
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    test('leaves the header out', () => {
        assert.equal(units.length, 4);
    });

    // A backslash before a dot is a backslash in the text, as in a grep
    // pattern; read as an escape, it would change the command.
    test('reads escapes as gettext writes them', () => {
        assert.equal(units[0].msgid, 'Run `grep -c \'\\.ko$\'` and "quote".');
        assert.equal(units[1].msgid, 'ls\npwd\n');
    });

    test('carries the unit type po4a records', () => {
        assert.deepEqual(units[1].comments, ['type: Fenced code block (sh)']);
    });

    test('knows an outdated translation, and the English it was made from', () => {
        assert.equal(units[2].fuzzy, true);
        assert.equal(units[2].previous, 'Old text.');
        assert.equal(units[0].fuzzy, false);
    });

    test('keeps the context that tells equal strings apart', () => {
        assert.equal(units[3].msgctxt, '.sidebar.best-practices.overview');
    });
});
