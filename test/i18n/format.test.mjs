import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDay, formatNumber } from '../../src/i18n/format.mjs';

describe('a day', () => {
    test('is written with its month in words', () => {
        assert.equal(formatDay(new Date('2026-09-12T12:00:00Z'), 'en-GB', 'UTC'), '12 September 2026');
        assert.equal(formatDay(new Date('2026-09-12T12:00:00Z'), 'it-CH', 'UTC'), '12 settembre 2026');
        assert.equal(formatDay(new Date('2026-09-12T12:00:00Z'), 'uk', 'UTC'), '12 вересня 2026 р.');
    });

    test('is the first of the month as an ordinal in French and Italian', () => {
        assert.equal(formatDay(new Date('2026-05-01T12:00:00Z'), 'fr-CH', 'UTC'), '1er mai 2026');
        assert.equal(formatDay(new Date('2026-05-01T12:00:00Z'), 'it-CH', 'UTC'), '1° maggio 2026');
        assert.equal(formatDay(new Date('2026-05-01T12:00:00Z'), 'es-419', 'UTC'), '1 de mayo de 2026');
    });

    // The dashboard shows a run in the visitor's time zone; late on the 30th
    // in UTC corresponds to the first of the month in Zurich.
    test('is the day of the time zone it is shown in', () => {
        const run = new Date('2026-04-30T23:30:00Z');
        assert.equal(formatDay(run, 'fr-CH', 'Europe/Zurich'), '1er mai 2026');
        assert.equal(formatDay(run, 'fr-CH', 'UTC'), '30 avril 2026');
    });
});

describe('a number', () => {
    test('takes the decimal comma the Federal Chancellery writes, where CLDR has a point', () => {
        assert.equal(formatNumber(1.5, 'de-CH'), '1,5');
        assert.equal(formatNumber(1.5, 'it-CH'), '1,5');
        assert.equal(formatNumber(1.5, 'fr-CH'), '1,5');
    });

    test('takes the decimal point in English and Latin American Spanish', () => {
        assert.equal(formatNumber(1.5, 'en-GB'), '1.5');
        assert.equal(formatNumber(1.5, 'es-419'), '1.5');
    });

    test('is not grouped', () => {
        assert.equal(formatNumber(12345, 'de-CH'), '12345');
    });
});
