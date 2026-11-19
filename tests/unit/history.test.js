import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calendarMove, dayDetails, firstEntryDate, isEmptyDay, monthRange, monthView } from '../../assets/js/history.js';
import { emptyData, normalizeData } from '../../assets/js/store.js';

const data = normalizeData({
  checkins: [
    { date: '2026-02-27', mood: 2, note: 'tired' },
    { date: '2026-03-08', mood: 4, note: 'a walk' },
    { date: '2026-03-10', mood: 5, note: '' },
  ],
  gratitude: [
    { id: 'g1', date: '2026-03-08', text: 'sunshine' },
    { id: 'g2', date: '2026-03-08', text: 'soup' },
  ],
  kindness: [{ id: 'k1', date: '2026-03-08', ideaId: null, text: 'helped' }],
  pledges: [
    { id: 'p1', goal: 13, actionId: 'g13-plant-trees', text: 'trees', createdAt: '2026-02-20', doneAt: '2026-03-08' },
    { id: 'p2', goal: 2, actionId: 'g2-food-bank', text: 'food bank', createdAt: '2026-03-08', doneAt: null },
  ],
});

describe('a day', () => {
  it('gathers everything recorded on it', () => {
    const day = dayDetails(data, '2026-03-08');
    assert.deepEqual(day.checkin, { date: '2026-03-08', mood: 4, note: 'a walk' });
    assert.deepEqual(
      day.gratitude.map((entry) => entry.text),
      ['sunshine', 'soup'],
    );
    assert.deepEqual(
      day.kindness.map((act) => act.text),
      ['helped'],
    );
    assert.deepEqual(
      day.pledgesKept.map((pledge) => pledge.id),
      ['p1'],
    );
    assert.deepEqual(
      day.pledgesMade.map((pledge) => pledge.id),
      ['p2'],
    );
    assert.equal(isEmptyDay(day), false);
  });

  it('can be empty', () => {
    const day = dayDetails(data, '2026-03-09');
    assert.equal(day.checkin, null);
    assert.equal(isEmptyDay(day), true);
  });
});

describe('the months to look back on', () => {
  it('start with the first thing recorded, including pledges', () => {
    assert.equal(firstEntryDate(data), '2026-02-20');
    assert.equal(firstEntryDate(emptyData()), null);
    assert.deepEqual(monthRange(data, '2026-03-10'), { first: '2026-02', last: '2026-03' });
  });

  it('are just this month when there is nothing earlier', () => {
    assert.deepEqual(monthRange(emptyData(), '2026-03-10'), { first: '2026-03', last: '2026-03' });
    const later = normalizeData({ checkins: [{ date: '2026-05-01', mood: 3 }] });
    assert.deepEqual(monthRange(later, '2026-03-10'), { first: '2026-03', last: '2026-03' });
  });
});

describe('a month', () => {
  it('describes each day and adds up the month', () => {
    const view = monthView(data, '2026-03');
    assert.equal(view.offset, 6);
    assert.equal(view.days.length, 31);
    assert.deepEqual(view.days[7], { date: '2026-03-08', mood: 4, gratitude: 2, kindness: 1, pledgesKept: 1, pledgesMade: 1 });
    assert.deepEqual(view.days[8], { date: '2026-03-09', mood: null, gratitude: 0, kindness: 0, pledgesKept: 0, pledgesMade: 0 });
    assert.deepEqual(view.totals, {
      checkins: 2,
      averageMood: 4.5,
      gratitude: 2,
      kindness: 1,
      pledgesKept: 1,
      pledgesMade: 1,
    });
  });

  it('counts a pledge in the month it was made', () => {
    const view = monthView(data, '2026-02');
    assert.equal(view.days[19].pledgesMade, 1);
    assert.equal(view.totals.pledgesMade, 1);
  });

  it('handles a month with nothing in it', () => {
    const view = monthView(data, '2026-01');
    assert.equal(view.offset, 3);
    assert.equal(view.totals.checkins, 0);
    assert.equal(view.totals.averageMood, null);
  });
});

describe('moving around the calendar', () => {
  const range = { min: '2026-02-20', max: '2026-03-10' };

  it('moves by day, week and month', () => {
    assert.equal(calendarMove('2026-03-05', 'ArrowLeft', range), '2026-03-04');
    assert.equal(calendarMove('2026-03-05', 'ArrowRight', range), '2026-03-06');
    assert.equal(calendarMove('2026-03-05', 'ArrowUp', range), '2026-02-26');
    assert.equal(calendarMove('2026-03-01', 'ArrowDown', range), '2026-03-08');
    assert.equal(calendarMove('2026-03-05', 'Home', range), '2026-03-02');
    assert.equal(calendarMove('2026-03-03', 'End', range), '2026-03-08');
    assert.equal(calendarMove('2026-03-25', 'PageUp', range), '2026-02-25');
    assert.equal(calendarMove('2026-02-21', 'PageDown', { min: '2026-02-20', max: '2026-03-31' }), '2026-03-21');
  });

  it('uses the last day of a shorter month', () => {
    assert.equal(calendarMove('2026-03-31', 'PageUp', { min: '2026-01-01', max: '2026-03-31' }), '2026-02-28');
  });

  it('stays between the first and last day', () => {
    assert.equal(calendarMove('2026-03-10', 'ArrowRight', range), '2026-03-10');
    assert.equal(calendarMove('2026-03-09', 'ArrowDown', range), '2026-03-10');
    assert.equal(calendarMove('2026-02-21', 'ArrowUp', range), '2026-02-20');
    assert.equal(calendarMove('2026-03-05', 'PageUp', range), '2026-02-20');
    assert.equal(calendarMove('2026-02-27', 'PageDown', range), '2026-03-10');
  });

  it('ignores other keys', () => {
    assert.equal(calendarMove('2026-03-05', 'Enter', range), null);
  });
});
