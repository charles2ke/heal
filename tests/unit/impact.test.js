import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { APP_ID, exportFilename, exportPayload, hasAnyData, parseImport, summarize } from '../../assets/js/impact.js';
import { SCHEMA_VERSION, emptyData, normalizeData } from '../../assets/js/store.js';

const sample = normalizeData({
  checkins: [
    { date: '2026-03-01', mood: 1, note: '' },
    { date: '2026-03-09', mood: 4, note: '' },
    { date: '2026-03-10', mood: 5, note: 'great day' },
  ],
  gratitude: [
    { id: 'g1', date: '2026-03-10', text: 'sunshine' },
    { id: 'g2', date: '2026-02-01', text: 'snow' },
  ],
  kindness: [
    { id: 'k1', date: '2026-03-09', ideaId: null, text: 'helped' },
    { id: 'k2', date: '2026-03-10', ideaId: null, text: 'listened' },
  ],
  pledges: [
    { id: 'p1', goal: 13, actionId: 'g13-plant-trees', text: 'trees', createdAt: '2026-03-01', doneAt: '2026-03-05' },
    { id: 'p2', goal: 13, actionId: 'g13-plant-based', text: 'plants', createdAt: '2026-03-01', doneAt: null },
    { id: 'p3', goal: 2, actionId: 'g2-food-bank', text: 'food bank', createdAt: '2026-03-02', doneAt: null },
  ],
});

describe('summarize', () => {
  it('adds everything up', () => {
    const summary = summarize(sample, '2026-03-10');
    assert.deepEqual(summary.checkins, { total: 3, week: 2, averageMood: 4.5, streak: 2 });
    assert.deepEqual(summary.gratitude, { total: 2, week: 1 });
    assert.deepEqual(summary.kindness, { total: 2, week: 2, streak: 2 });
    assert.deepEqual(summary.pledges, { active: 2, done: 1, goals: 2 });
  });

  it('describes each of the last seven days', () => {
    const { days } = summarize(sample, '2026-03-10');
    assert.equal(days.length, 7);
    assert.equal(days[0].date, '2026-03-04');
    assert.deepEqual(days.at(-1), { date: '2026-03-10', mood: 5, gratitude: 1, kindness: 1 });
    assert.deepEqual(days[0], { date: '2026-03-04', mood: null, gratitude: 0, kindness: 0 });
  });

  it('handles no data', () => {
    const summary = summarize(emptyData(), '2026-03-10');
    assert.equal(summary.checkins.averageMood, null);
    assert.equal(hasAnyData(emptyData()), false);
    assert.equal(hasAnyData(sample), true);
  });
});

describe('export and import', () => {
  it('names the export file after the day', () => {
    assert.equal(exportFilename('2026-03-10'), 'heal-data-2026-03-10.json');
  });

  it('round-trips an export', () => {
    const payload = exportPayload(sample, new Date('2026-03-10T12:00:00Z'));
    assert.equal(payload.app, APP_ID);
    assert.equal(payload.version, SCHEMA_VERSION);
    assert.equal(payload.exportedAt, '2026-03-10T12:00:00.000Z');
    const result = parseImport(JSON.stringify(payload));
    assert.equal(result.ok, true);
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.data, sample);
  });

  it('rejects files that are not Heal exports', () => {
    for (const text of ['not json', '[]', 'null', '{"checkins": []}', '{"app": "other", "data": {}}', '{"app": "heal", "data": []}']) {
      const result = parseImport(text);
      assert.equal(result.ok, false, text);
      assert.match(result.error, /Heal export/);
    }
  });

  it('rejects files from a newer version', () => {
    const result = parseImport(JSON.stringify({ app: 'heal', version: SCHEMA_VERSION + 1, data: {} }));
    assert.equal(result.ok, false);
    assert.match(result.error, /newer version/);
  });

  it('rejects a missing or nonsense version', () => {
    assert.equal(parseImport(JSON.stringify({ app: 'heal', data: {} })).ok, false);
    assert.equal(parseImport(JSON.stringify({ app: 'heal', version: '1', data: {} })).ok, false);
  });

  it('skips invalid entries and reports how many', () => {
    const result = parseImport(
      JSON.stringify({
        app: 'heal',
        version: 1,
        data: {
          checkins: [
            { date: '2026-03-10', mood: 3 },
            { date: 'yesterday', mood: 3 },
          ],
          gratitude: [{ id: 'x', date: '2026-03-10', text: '<script>alert(1)</script>' }],
          kindness: 'nope',
        },
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(result.skipped, 1);
    assert.equal(result.data.checkins.length, 1);
    // Text is kept as text: pages only ever render it with textContent.
    assert.equal(result.data.gratitude[0].text, '<script>alert(1)</script>');
  });
});
