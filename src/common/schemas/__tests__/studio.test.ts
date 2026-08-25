// @vitest-environment node
/**
 * A regression test for a bug that produced no error and no empty state.
 *
 * `legacy/data/studio.js:89` writes an award's year as a NUMBER and `:104` writes a
 * chapter's as a STRING. With a `z.string()` leaf on `award.year`, every award failed —
 * and `jsonArray` degrades a failed payload to `[]` on purpose, so the studio page shipped
 * an empty `<div class="rows">` with six awards sitting in the database. Nothing in the
 * gate could see it, which is exactly why the assertion belongs here.
 */
import { describe, expect, it } from 'vitest';
import { awardSchema, chapterSchema, studioRowSchema } from '../studio';

describe('year leaves accept both spellings', () => {
  it('parses a NUMERIC award year — the shape the seed actually writes', () => {
    const parsed = awardSchema.parse({
      year: 2024,
      title: 'Memar Award — Residential, First Prize',
      project: 'Qeytarieh 08 Residence',
      body: 'Memar Magazine, Tehran',
    });
    expect(parsed.year).toBe('2024');
  });

  it('parses a STRING chapter year unchanged', () => {
    expect(chapterSchema.parse({ year: '2007', text: 'The studio opens.' }).year).toBe('2007');
  });

  it('does not swallow a whole award list because one year is a number', () => {
    // The end-to-end shape of the bug: a row whose JSON column holds numeric years must
    // come back with its awards, not with `[]`.
    const row = studioRowSchema.parse({
      id: 1,
      manifestoEn: '',
      manifestoFa: '',
      foundersEn: '[]',
      foundersFa: '[]',
      statsEn: '[]',
      statsFa: '[]',
      teamEn: '[]',
      teamFa: '[]',
      alumniEn: '[]',
      alumniFa: '[]',
      awardsEn: JSON.stringify([{ year: 2024, title: 'A', project: 'B', body: 'C' }]),
      awardsFa: '[]',
      chaptersEn: '[]',
      chaptersFa: '[]',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(row.awardsEn).toHaveLength(1);
    expect(row.awardsEn[0]?.year).toBe('2024');
  });
});
