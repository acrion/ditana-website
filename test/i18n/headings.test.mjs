import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownToHtml } from 'satteri';
import { headingIds, withEnglishIds } from '../../src/i18n/headings.mjs';

const english = `---
title: Updating
---

Intro.

## The graphical way

### Pachub

## The \`pacman\` way

## After the update

## After the update
`;

describe('the ids of the English headings', () => {
    test('are the slugs Astro gives them, in order and with their levels', () => {
        assert.deepEqual(headingIds(english), [
            { depth: 2, id: 'the-graphical-way' },
            { depth: 3, id: 'pachub' },
            { depth: 2, id: 'the-pacman-way' },
            { depth: 2, id: 'after-the-update' },
            { depth: 2, id: 'after-the-update-1' },
        ]);
    });

    // Astro fills in the release placeholders before it takes the slug.
    test('are taken after the placeholders are filled in', () => {
        const ids = headingIds('## Ditana GNU/Linux {{release}}\n', { substitute: (text) => text.replace('{{release}}', '0.9.4 Beta') });
        assert.deepEqual(ids, [{ depth: 2, id: 'ditana-gnulinux-094-beta' }]);
    });
});

describe('a translated page', () => {
    const german = `---
title: Aktualisieren
---

Einleitung.

## Der grafische Weg

### Pachub

## Der \`pacman\`-Weg

## Nach dem Update

## Nach dem Update
`;

    test('gets the English id on each heading', () => {
        const out = withEnglishIds(german, headingIds(english));
        assert.match(out, /^## Der grafische Weg \{#the-graphical-way\}$/m);
        assert.match(out, /^### Pachub \{#pachub\}$/m);
        assert.match(out, /^## Der `pacman`-Weg \{#the-pacman-way\}$/m);
        assert.match(out, /^## Nach dem Update \{#after-the-update-1\}$/m);
    });

    test('renders with the English ids once Satteri reads heading attributes', async () => {
        const { html } = await markdownToHtml(withEnglishIds(german, headingIds(english)), { features: { headingAttributes: true } });
        assert.deepEqual([...html.matchAll(/<h[23] id="([^"]+)"/g)].map((match) => match[1]),
            ['the-graphical-way', 'pachub', 'the-pacman-way', 'after-the-update', 'after-the-update-1']);
        assert.doesNotMatch(html, /\{#/);
    });

    // A heading lost, added or moved to another level would put the ids on
    // the wrong sections, which no reader would notice.
    test('with other headings than the English page is refused', () => {
        assert.throws(() => withEnglishIds(german.replace('### Pachub', 'Pachub'), headingIds(english), { where: 'de-ch/updating.md' }),
            /de-ch\/updating\.md: the translation has the headings 2,2,2,2, the English page 2,3,2,2,2/);
        assert.throws(() => withEnglishIds(german.replace('### Pachub', '## Pachub'), headingIds(english)), /headings/);
    });

    test('leaves a heading-like line in a code block alone', () => {
        const withCode = '## A\n\n```sh\n## not a heading\n```\n';
        assert.equal(withEnglishIds(withCode, [{ depth: 2, id: 'a' }]), '## A {#a}\n\n```sh\n## not a heading\n```\n');
    });
});
