import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  APP_ID,
  csvCell,
  csvFilename,
  exportFilename,
  exportPayload,
  hasAnyData,
  mergeData,
  parseImport,
  summarize,
  toCsv,
} from '../../assets/js/impact.js';
import { LIMITS, SCHEMA_VERSION, countEntries, emptyData, normalizeData } from '../../assets/js/store.js';

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
    assert.deepEqual(summary.checkins, { total: 3, week: 2, averageMood: 4.5, streak: 2, longest: 2 });
    assert.deepEqual(summary.gratitude, { total: 2, week: 1 });
    assert.deepEqual(summary.kindness, { total: 2, week: 2, streak: 2, longest: 2 });
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

describe('combining data', () => {
  const current = normalizeData({
    checkins: [{ date: '2026-03-09', mood: 4, note: 'mine' }],
    gratitude: [{ id: 'g1', date: '2026-03-09', text: 'tea' }],
    kindness: [
      { id: 'k1', date: '2026-03-09', ideaId: 'smile', text: 'Smile at someone' },
      { id: 'k2', date: '2026-03-09', ideaId: null, text: 'helped' },
    ],
    pledges: [{ id: 'p1', goal: 13, actionId: 'g13-plant-trees', text: 'trees', createdAt: '2026-03-05', doneAt: null }],
  });
  const incoming = normalizeData({
    checkins: [
      { date: '2026-03-09', mood: 1, note: 'theirs' },
      { date: '2026-03-08', mood: 3, note: '' },
    ],
    gratitude: [
      { id: 'g1', date: '2026-03-09', text: 'tea' },
      { id: 'g9', date: '2026-03-09', text: 'tea' },
      { id: 'g2', date: '2026-03-08', text: 'soup' },
    ],
    kindness: [
      { id: 'k9', date: '2026-03-09', ideaId: 'smile', text: 'Smile at someone' },
      { id: 'k8', date: '2026-03-09', ideaId: null, text: 'helped' },
      { id: 'k7', date: '2026-03-10', ideaId: null, text: 'helped' },
    ],
    pledges: [
      { id: 'p9', goal: 13, actionId: 'g13-plant-trees', text: 'trees', createdAt: '2026-03-01', doneAt: '2026-03-02' },
      { id: 'p8', goal: 2, actionId: 'g2-food-bank', text: 'food bank', createdAt: '2026-03-06', doneAt: null },
    ],
  });

  it('keeps what is here and adds what is new', () => {
    const { data, added, markedDone, alreadyHere, differentCheckins, overLimit } = mergeData(current, incoming);
    assert.deepEqual(data.checkins, [
      { date: '2026-03-08', mood: 3, note: '' },
      { date: '2026-03-09', mood: 4, note: 'mine' },
    ]);
    assert.deepEqual(
      data.gratitude.map((entry) => entry.id),
      ['g2', 'g1'],
    );
    assert.deepEqual(
      data.kindness.map((act) => act.id),
      ['k1', 'k2', 'k7'],
    );
    assert.deepEqual(data.pledges, [
      { id: 'p1', goal: 13, actionId: 'g13-plant-trees', text: 'trees', createdAt: '2026-03-01', doneAt: '2026-03-02' },
      { id: 'p8', goal: 2, actionId: 'g2-food-bank', text: 'food bank', createdAt: '2026-03-06', doneAt: null },
    ]);
    assert.deepEqual(
      { added, markedDone, alreadyHere, differentCheckins, overLimit },
      { added: 4, markedDone: 1, alreadyHere: 4, differentCheckins: 1, overLimit: 0 },
    );
    assert.equal(added + markedDone + alreadyHere + differentCheckins + overLimit, countEntries(incoming));
  });

  it('adds nothing when combined with itself', () => {
    const result = mergeData(sample, sample);
    assert.deepEqual(result.data, sample);
    assert.deepEqual(
      [result.added, result.markedDone, result.alreadyHere, result.differentCheckins, result.overLimit],
      [0, 0, countEntries(sample), 0, 0],
    );
  });

  it("doesn't call a check-in with a different note already here", () => {
    const mine = normalizeData({ checkins: [{ date: '2026-03-09', mood: 4, note: 'mine' }] });
    const theirs = normalizeData({ checkins: [{ date: '2026-03-09', mood: 4, note: 'theirs' }] });
    const result = mergeData(mine, theirs);
    assert.deepEqual(result.data.checkins, mine.checkins);
    assert.deepEqual([result.added, result.alreadyHere, result.differentCheckins], [0, 0, 1]);
  });

  it('keeps the three good things already saved for a day', () => {
    const full = normalizeData({
      gratitude: ['a', 'b', 'c'].map((text) => ({ id: text, date: '2026-03-09', text })),
    });
    const extra = normalizeData({
      gratitude: [
        { id: 'a', date: '2026-03-09', text: 'a' },
        { id: 'd', date: '2026-03-09', text: 'd' },
        { id: 'e', date: '2026-03-08', text: 'e' },
      ],
    });
    const result = mergeData(full, extra);
    assert.deepEqual(
      result.data.gratitude.map((entry) => entry.id),
      ['e', 'a', 'b', 'c'],
    );
    assert.deepEqual([result.added, result.alreadyHere, result.overLimit], [1, 1, 1]);
  });

  it('keeps local entries when a collection is full', () => {
    const full = normalizeData({
      kindness: Array.from({ length: LIMITS.entries }, (_, index) => ({
        id: `k${index}`,
        date: '2026-03-09',
        ideaId: null,
        text: `act ${index}`,
      })),
    });
    const incoming = normalizeData({
      kindness: [{ id: 'new-act', date: '2026-03-10', ideaId: null, text: 'new act' }],
    });

    const result = mergeData(full, incoming);

    assert.deepEqual(result.data.kindness, full.kindness);
    assert.deepEqual(
      [result.added, result.alreadyHere, result.differentCheckins, result.overLimit],
      [0, 0, 0, 1],
    );
    assert.equal(result.added + result.markedDone + result.alreadyHere + result.differentCheckins + result.overLimit, countEntries(incoming));
  });
});

describe('spreadsheet export', () => {
  const HEADER = '\uFEFFDate,Type,Mood,Mood label,Text,Goal,Done on\r\n';

  it('quotes cells that need it', () => {
    assert.equal(csvCell('tea'), 'tea');
    assert.equal(csvCell('tea, cake'), '"tea, cake"');
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell(4), '4');
    assert.equal(csvCell(null), '');
  });

  it('keeps text from being run as a formula', () => {
    for (const text of ['=1+1', '+1', '-1', '@SUM(A1)']) assert.equal(csvCell(text), `'${text}`);
    assert.equal(csvCell('=HYPERLINK("x","y")'), `"'=HYPERLINK(""x"",""y"")"`);
  });

  it('writes one row per entry, oldest first', () => {
    const csv = toCsv(sample);
    assert.ok(csv.startsWith(HEADER));
    assert.ok(csv.endsWith('\r\n'));
    const rows = csv.slice(HEADER.length).split('\r\n').slice(0, -1);
    assert.equal(rows.length, countEntries(sample));
    assert.equal(rows[0], '2026-02-01,Good thing,,,snow,,');
    assert.ok(rows.includes('2026-03-01,Pledge,,,trees,13: Climate Action,2026-03-05'));
    assert.ok(rows.includes('2026-03-10,Check-in,5,Great,great day,,'));
    const dates = rows.map((row) => row.slice(0, 10));
    assert.deepEqual(dates, [...dates].sort());
  });

  it('writes just the header when there is nothing saved', () => {
    assert.equal(toCsv(emptyData()), HEADER);
    assert.equal(csvFilename('2026-03-10'), 'heal-data-2026-03-10.csv');
  });
});
