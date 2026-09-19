import { spawnSync } from 'node:child_process';

// Reads the units from a PO file. msgcat writes each string on a single
// line, except that it still breaks after every \n, so a string occupies
// the line of its keyword and the quoted lines that follow it.

const ESCAPES = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', f: '\f', v: '\v' };
const unescape = (quoted) => quoted.slice(1, -1).replace(/\\(.)/g, (_, char) => ESCAPES[char] ?? char);

/**
 * The units of a PO file, the header omitted: { msgctxt, msgid, msgstr,
 * fuzzy, previous, comments, references, flags }
 */
export function readPo(file) {
    const result = spawnSync('msgcat', ['--no-wrap', '--add-location=file', file], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`msgcat could not read ${file}:\n${result.stderr}`);
    const units = [];
    for (const block of result.stdout.split(/\n\n+/)) {
        const unit = { msgctxt: undefined, msgid: undefined, msgstr: undefined, previous: undefined, comments: [], references: [], flags: [] };
        let field;
        for (const line of block.split('\n')) {
            let match;
            if ((match = /^(?:#\| )?(".*")$/.exec(line)) && field) unit[field] += unescape(match[1]);
            else if ((match = /^#\. (.*)$/.exec(line))) unit.comments.push(match[1]);
            else if ((match = /^#: (.*)$/.exec(line))) unit.references.push(...match[1].split(' '));
            else if ((match = /^#, (.*)$/.exec(line))) unit.flags.push(...match[1].split(/,\s*/));
            else if ((match = /^#\| msgid (".*")$/.exec(line))) {
                field = 'previous';
                unit.previous = unescape(match[1]);
            } else if ((match = /^(msgctxt|msgid|msgstr) (".*")$/.exec(line))) {
                field = match[1];
                unit[field] = unescape(match[2]);
            }
        }
        if (unit.msgid === undefined || unit.msgid === '') continue;
        unit.fuzzy = unit.flags.includes('fuzzy');
        units.push(unit);
    }
    return units;
}
