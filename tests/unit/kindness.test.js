import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addDays } from '../../assets/js/dates.js';
import { KINDNESS_IDEAS } from '../../assets/js/data/kindness-ideas.js';
import { hasDoneIdea, ideaById, ideaIndexForDay, kindnessStats, logAct, recentActs, removeAct } from '../../assets/js/kindness.js';
import { emptyData } from '../../assets/js/store.js';

describe('kindness', () => {
  it('picks a different idea each day and cycles through them all', () => {
    const start = '2026-03-10';
    const seen = new Set();
    for (let day = 0; day < KINDNESS_IDEAS.length; day += 1) seen.add(ideaIndexForDay(addDays(start, day)));
    assert.equal(seen.size, KINDNESS_IDEAS.length);
    assert.notEqual(ideaIndexForDay('2026-03-10'), ideaIndexForDay('2026-03-11'));
  });

  it('works for dates before 1970', () => {
    const index = ideaIndexForDay('1969-12-31');
    assert.ok(index >= 0 && index < KINDNESS_IDEAS.length);
  });

  it('finds ideas by id', () => {
    assert.equal(ideaById('thank-unnoticed').id, 'thank-unnoticed');
    assert.equal(ideaById('missing'), null);
  });

  it('logs an idea once per day', () => {
    const idea = KINDNESS_IDEAS[0];
    let data = logAct(emptyData(), { date: '2026-03-10', ideaId: idea.id, text: idea.text });
    const again = logAct(data, { date: '2026-03-10', ideaId: idea.id, text: idea.text });
    assert.equal(again, data);
    assert.equal(hasDoneIdea(data, '2026-03-10', idea.id), true);
    assert.equal(hasDoneIdea(data, '2026-03-11', idea.id), false);
    data = logAct(data, { date: '2026-03-11', ideaId: idea.id, text: idea.text });
    assert.equal(data.kindness.length, 2);
  });

  it('logs your own acts, ignoring empty ones', () => {
    let data = logAct(emptyData(), { date: '2026-03-10', text: 'Helped a neighbour', id: 'a' });
    data = logAct(data, { date: '2026-03-10', text: '  ' });
    assert.deepEqual(data.kindness, [{ id: 'a', date: '2026-03-10', ideaId: null, text: 'Helped a neighbour' }]);
    assert.equal(removeAct(data, 'a').kindness.length, 0);
  });

  it('summarises today, the week, the streak and the total', () => {
    let data = emptyData();
    for (const date of ['2026-02-20', '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-10']) {
      data = logAct(data, { date, text: 'kind' });
    }
    assert.deepEqual(kindnessStats(data, '2026-03-10'), { today: 2, week: 4, total: 5, streak: 3 });
  });

  it('lists recent acts newest first', () => {
    let data = emptyData();
    for (const [index, date] of ['2026-03-08', '2026-03-09', '2026-03-10'].entries()) {
      data = logAct(data, { date, text: `act ${index}` });
    }
    assert.deepEqual(
      recentActs(data, 2).map((act) => act.text),
      ['act 2', 'act 1'],
    );
  });
});
