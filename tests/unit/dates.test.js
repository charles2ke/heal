import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addDays, currentStreak, dayNumber, fromDateKey, isDateKey, lastNDays, toDateKey } from '../../assets/js/dates.js';

describe('dates', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    assert.equal(toDateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
    assert.equal(toDateKey(new Date(2026, 11, 31, 0, 0)), '2026-12-31');
  });

  it('accepts only real calendar dates', () => {
    assert.equal(isDateKey('2026-02-28'), true);
    assert.equal(isDateKey('2024-02-29'), true);
    assert.equal(isDateKey('2026-02-29'), false);
    assert.equal(isDateKey('2026-13-01'), false);
    assert.equal(isDateKey('2026-1-01'), false);
    assert.equal(isDateKey(' 2026-01-01'), false);
    assert.equal(isDateKey(20260101), false);
    assert.equal(isDateKey(null), false);
  });

  it('round-trips a date key at noon', () => {
    const date = fromDateKey('2026-03-29');
    assert.equal(date.getHours(), 12);
    assert.equal(toDateKey(date), '2026-03-29');
  });

  it('adds days across month and year boundaries', () => {
    assert.equal(addDays('2026-01-31', 1), '2026-02-01');
    assert.equal(addDays('2026-01-01', -1), '2025-12-31');
    assert.equal(addDays('2024-02-28', 1), '2024-02-29');
    assert.equal(addDays('2026-03-29', 1), '2026-03-30');
  });

  it('lists the last N days, oldest first', () => {
    assert.deepEqual(lastNDays(3, '2026-03-01'), ['2026-02-27', '2026-02-28', '2026-03-01']);
  });

  it('numbers days consecutively', () => {
    assert.equal(dayNumber('1970-01-01'), 0);
    assert.equal(dayNumber('2026-03-01') - dayNumber('2026-02-28'), 1);
  });

  it('counts a streak that includes today', () => {
    assert.equal(currentStreak(['2026-03-08', '2026-03-09', '2026-03-10'], '2026-03-10'), 3);
  });

  it('keeps a streak alive until the end of the day after it', () => {
    assert.equal(currentStreak(['2026-03-08', '2026-03-09'], '2026-03-10'), 2);
  });

  it('breaks a streak after a missed day', () => {
    assert.equal(currentStreak(['2026-03-07', '2026-03-08'], '2026-03-10'), 0);
    assert.equal(currentStreak(['2026-03-06', '2026-03-08', '2026-03-09', '2026-03-10'], '2026-03-10'), 3);
    assert.equal(currentStreak([], '2026-03-10'), 0);
  });

  it('counts each day once in a streak', () => {
    assert.equal(currentStreak(['2026-03-10', '2026-03-10', '2026-03-09'], '2026-03-10'), 2);
  });
});
