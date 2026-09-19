import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// LanguageTool, run once over many units of one language. The units are
// joined into one text, a blank line apart, and each match is traced back to
// the unit it lies in.

export const LT_LANGUAGES = { 'en-GB': 'en-GB', 'de-CH': 'de-CH', 'fr-CH': 'fr-CH', 'it-CH': 'it', 'es-419': 'es', uk: 'uk-UA' };

/**
 * `units` are { where, text }. `only` restricts the check to those rules;
 * `categories` enables whole categories beyond the defaults; `disable` turns rules
 * off. Returns { where, rule, category, message, found, replacements }.
 */
export function languageTool(units, lang, { only, categories, disable = [] } = {}) {
    const code = LT_LANGUAGES[lang];
    if (!code) throw new Error(`LanguageTool does not check ${lang}`);
    if (units.length === 0) return [];
    const starts = [];
    let text = '';
    for (const { text: unit } of units) {
        starts.push(text.length);
        text += `${unit.replace(/\n{2,}/g, '\n')}\n\n`;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ditana-lt-'));
    try {
        const file = path.join(dir, 'text.txt');
        fs.writeFileSync(file, text);
        const args = ['-l', code, '--json'];
        if (only) args.push('-eo', '-e', only.join(','));
        if (categories) args.push('--enablecategories', categories.join(','));
        if (disable.length) args.push('-d', disable.join(','));
        const result = spawnSync('languagetool', [...args, file], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
        if (result.error) throw new Error(`languagetool could not be run: ${result.error.message}`);
        const json = result.stdout.slice(result.stdout.indexOf('{'));
        if (result.status !== 0 || !json) throw new Error(`languagetool failed for ${lang}:\n${result.stderr}`);
        return JSON.parse(json).matches.map((match) => {
            let index = starts.length - 1;
            while (index > 0 && starts[index] > match.offset) index--;
            return {
                where: units[index].where,
                rule: match.rule.id,
                category: match.rule.category.id,
                message: match.message,
                found: text.slice(match.offset, match.offset + match.length),
                replacements: match.replacements.slice(0, 3).map(({ value }) => value),
            };
        });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
