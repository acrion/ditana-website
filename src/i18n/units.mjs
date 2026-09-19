import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isCodeUnit } from './literals.mjs';
import { readPo } from './po.mjs';

// The units of one language as a list to translate, and a translated list
// put back into the PO files. Putting back is gettext's work: the new
// translations are laid over the file with msgcat, and msgmerge brings the
// result back into the order and form of the POT, so a PO file changes only
// where a translation did.

const quote = (text) => `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n').replaceAll('\t', '\\t')}"`;

function run(command, args) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    if (result.error) throw new Error(`${command} could not be run: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr}`);
}

/** The POT that a PO file belongs to: po/docs/x/de-ch.po → po/docs/x/x.pot, po/ui/de-ch.po → po/ui/ui.pot. */
export const templateOf = (po) => path.join(path.dirname(po), `${path.basename(path.dirname(po))}.pot`);

/**
 * The units of the PO files of `prefix` beneath `root`, each with its
 * file, context and the English it was translated from when that changed.
 * `open` omits what is translated and current. Code units are never
 * listed: they are translated as themselves.
 */
export function exportUnits(root, prefix, { open = false } = {}) {
    const units = [];
    for (const file of fs.globSync(`po/**/${prefix}.po`, { cwd: root }).toSorted()) {
        for (const unit of readPo(path.join(root, file))) {
            if (isCodeUnit(unit)) continue;
            if (open && unit.msgstr && !unit.fuzzy) continue;
            units.push({
                file,
                ...(unit.msgctxt !== undefined && { msgctxt: unit.msgctxt }),
                type: unit.comments.find((comment) => comment.startsWith('type: '))?.slice(6),
                msgid: unit.msgid,
                msgstr: unit.msgstr,
                ...(unit.fuzzy && { fuzzy: true, previous: unit.previous }),
            });
        }
    }
    return units;
}

/**
 * Writes translations into the PO files under `root`: `units` are { file,
 * msgctxt?, msgid, msgstr }. A translation replaces what the unit had,
 * fuzzy or not, and the unit is no longer fuzzy.
 */
export function importUnits(root, units) {
    const byFile = Map.groupBy(units, ({ file }) => file);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ditana-units-'));
    try {
        for (const [file, entries] of byFile) {
            const po = path.join(root, file);
            if (!fs.existsSync(po)) throw new Error(`${file} does not exist`);
            const known = new Set(readPo(po).map(({ msgctxt, msgid }) => `${msgctxt ?? ''}\u0004${msgid}`));
            const unknown = entries.filter(({ msgctxt, msgid }) => !known.has(`${msgctxt ?? ''}\u0004${msgid}`));
            if (unknown.length) throw new Error(`${file} has no unit ${JSON.stringify(unknown[0].msgid.slice(0, 60))}`);
            // gettext refuses a unit whose English ends a line and whose
            // translation does not, or the other way round, and po4a with it.
            const unended = entries.find(({ msgid, msgstr }) => msgid.endsWith('\n') !== msgstr.endsWith('\n'));
            if (unended) {
                throw new Error(`${file}: the translation of ${JSON.stringify(unended.msgid.slice(0, 60))} must ${unended.msgid.endsWith('\n') ? '' : 'not '}end with a line break, as the English does`);
            }
            const layer = path.join(dir, 'layer.po');
            fs.writeFileSync(layer, ['msgid ""', 'msgstr "Content-Type: text/plain; charset=UTF-8\\n"', '',
                ...entries.flatMap(({ msgctxt, msgid, msgstr }) => [
                    ...(msgctxt !== undefined ? [`msgctxt ${quote(msgctxt)}`] : []),
                    `msgid ${quote(msgid)}`, `msgstr ${quote(msgstr)}`, '',
                ])].join('\n'));
            const merged = path.join(dir, 'merged.po');
            // msgcat takes the header from its first file, the layer; the
            // PO file keeps its own.
            const header = fs.readFileSync(po, 'utf8').split('\n\n', 1)[0];
            run('msgcat', ['--no-wrap', '--use-first', '-o', merged, layer, po]);
            // msgmerge brings the units into the POT's order and form.
            run('msgmerge', ['--quiet', '--no-wrap', '--no-fuzzy-matching', '--previous', '-o', po, merged, path.join(root, templateOf(file))]);
            const text = fs.readFileSync(po, 'utf8');
            fs.writeFileSync(po, header + text.slice(text.indexOf('\n\n')));
        }
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
