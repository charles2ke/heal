import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { emptyData } from '../../assets/js/store.js';
import {
  BREATHING_PATTERNS,
  MOODS,
  addGratitude,
  breathingStep,
  canAddGratitude,
  canCheckIn,
  checkinDays,
  checkinFor,
  cycleSeconds,
  gratitudeFor,
  moodFor,
  removeGratitude,
  sessionRounds,
  setCheckin,
} from '../../assets/js/wellbeing.js';

describe('check-ins', () => {
  it('has five moods from 1 to 5', () => {
    assert.deepEqual(
      MOODS.map((mood) => mood.value),
      [1, 2, 3, 4, 5],
    );
    assert.equal(moodFor(4).label, 'Good');
    assert.equal(moodFor(9), null);
    assert.equal(moodFor(undefined), null);
  });

  it('saves one check-in per day and replaces it on update', () => {
    let data = setCheckin(emptyData(), { date: '2026-03-10', mood: 2, note: '  tired  ' });
    assert.deepEqual(checkinFor(data, '2026-03-10'), { date: '2026-03-10', mood: 2, note: 'tired' });
    data = setCheckin(data, { date: '2026-03-10', mood: 4 });
    assert.equal(data.checkins.length, 1);
    assert.deepEqual(checkinFor(data, '2026-03-10'), { date: '2026-03-10', mood: 4, note: '' });
    assert.equal(checkinFor(data, '2026-03-11'), null);
  });

  it('can be filled in for the past week, newest day first', () => {
    const days = checkinDays('2026-03-10');
    assert.equal(days.length, 7);
    assert.equal(days[0], '2026-03-10');
    assert.equal(days.at(-1), '2026-03-04');
    assert.equal(canCheckIn('2026-03-04', '2026-03-10'), true);
    assert.equal(canCheckIn('2026-03-03', '2026-03-10'), false);
    assert.equal(canCheckIn('2026-03-11', '2026-03-10'), false);
  });
});

describe('gratitude', () => {
  it('adds up to three good things a day', () => {
    let data = emptyData();
    for (const text of ['sunshine', 'a call', 'soup', 'one too many']) {
      data = addGratitude(data, { date: '2026-03-10', text });
    }
    assert.deepEqual(
      gratitudeFor(data, '2026-03-10').map((entry) => entry.text),
      ['sunshine', 'a call', 'soup'],
    );
    assert.equal(canAddGratitude(data, '2026-03-10'), false);
    assert.equal(canAddGratitude(data, '2026-03-11'), true);
  });

  it('ignores empty text', () => {
    const data = emptyData();
    assert.equal(addGratitude(data, { date: '2026-03-10', text: '   ' }), data);
  });

  it('removes a note by id', () => {
    const data = addGratitude(emptyData(), { date: '2026-03-10', text: 'tea', id: 'x' });
    assert.equal(removeGratitude(data, 'x').gratitude.length, 0);
  });
});

describe('breathing', () => {
  const box = BREATHING_PATTERNS.box;
  const relax = BREATHING_PATTERNS.relax;

  it('knows each cycle length', () => {
    assert.equal(cycleSeconds(box), 16);
    assert.equal(cycleSeconds(relax), 19);
    assert.equal(cycleSeconds(BREATHING_PATTERNS.even), 10);
    assert.equal(cycleSeconds(BREATHING_PATTERNS.longer), 10);
  });

  it('describes every pattern', () => {
    for (const [id, pattern] of Object.entries(BREATHING_PATTERNS)) {
      assert.equal(pattern.id, id);
      assert.ok(pattern.label && pattern.description, id);
    }
  });

  it('fits whole rounds into a timed session', () => {
    assert.equal(sessionRounds(box, 0), 0);
    assert.equal(sessionRounds(box, 1), 4);
    assert.equal(sessionRounds(box, 5), 19);
    assert.equal(sessionRounds(relax, 1), 3);
    assert.equal(sessionRounds(BREATHING_PATTERNS.even, 3), 18);
    assert.equal(sessionRounds(relax, 0.1), 1);
  });

  it('breathes in and out with no hold', () => {
    const even = BREATHING_PATTERNS.even;
    assert.deepEqual(pick(breathingStep(even, 4_900)), ['Breathe in', 0, 1]);
    assert.deepEqual(pick(breathingStep(even, 5_000)), ['Breathe out', 0, 5]);
    assert.deepEqual(pick(breathingStep(even, 10_000)), ['Breathe in', 1, 5]);
  });

  it('works out the phase from elapsed time', () => {
    assert.deepEqual(pick(breathingStep(box, 0)), ['Breathe in', 0, 4]);
    assert.deepEqual(pick(breathingStep(box, 3_100)), ['Breathe in', 0, 1]);
    assert.deepEqual(pick(breathingStep(box, 4_000)), ['Hold', 0, 4]);
    assert.deepEqual(pick(breathingStep(box, 8_500)), ['Breathe out', 0, 4]);
    assert.deepEqual(pick(breathingStep(box, 16_000)), ['Breathe in', 1, 4]);
    assert.deepEqual(pick(breathingStep(relax, 11_000)), ['Breathe out', 0, 8]);
    assert.deepEqual(pick(breathingStep(relax, 18_999)), ['Breathe out', 0, 1]);
    assert.deepEqual(pick(breathingStep(relax, 19_000 * 3 + 5_000)), ['Hold', 3, 6]);
  });

  it('treats negative time as the start', () => {
    assert.deepEqual(pick(breathingStep(box, -500)), ['Breathe in', 0, 4]);
  });
});

function pick(step) {
  return [step.phase.label, step.cycles, step.secondsLeft];
}
