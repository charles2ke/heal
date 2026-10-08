import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GOALS } from '../../assets/js/data/goals.js';
import { LIMITS, emptyData } from '../../assets/js/store.js';
import {
  addPledge,
  canPledge,
  filterGoals,
  filtersToSearch,
  findAction,
  fold,
  goalsTouched,
  normalizeFilters,
  parseFilters,
  pledgeFor,
  removePledge,
  setPledgeDone,
} from '../../assets/js/world.js';

const countActions = (results) => results.reduce((total, result) => total + result.actions.length, 0);

describe('filters', () => {
  it('reads filters from the address bar and ignores unknown types', () => {
    assert.deepEqual(parseFilters('?q=%20tree%20&type=time'), { query: 'tree', type: 'time' });
    assert.deepEqual(parseFilters('?type=toString'), { query: '', type: 'all' });
    assert.deepEqual(parseFilters('?type=__proto__'), { query: '', type: 'all' });
    assert.deepEqual(parseFilters(''), { query: '', type: 'all' });
    assert.equal(parseFilters(`?q=${'a'.repeat(500)}`).query.length, 100);
  });

  it('normalises filters typed into the form', () => {
    assert.deepEqual(normalizeFilters({ query: '  clean   water ', type: 'nonsense' }), { query: 'clean water', type: 'all' });
  });

  it('writes filters back to a query string', () => {
    assert.equal(filtersToSearch({ query: '', type: 'all' }), '');
    assert.equal(filtersToSearch({ query: 'clean water', type: 'habit' }), '?q=clean+water&type=habit');
    assert.deepEqual(parseFilters(filtersToSearch({ query: 'café & co', type: 'give' })), { query: 'café & co', type: 'give' });
  });

  it('shows every action with no filters', () => {
    const results = filterGoals();
    assert.equal(results.length, 17);
    assert.equal(countActions(results), 51);
  });

  it('filters by type', () => {
    const results = filterGoals({ type: 'voice' });
    assert.ok(results.length > 0);
    for (const { actions } of results) for (const action of actions) assert.equal(action.type, 'voice');
  });

  it('matches every word, ignoring case and accents', () => {
    assert.equal(fold('Café'), 'cafe');
    const results = filterGoals({ query: 'REPAIR cafe' });
    assert.deepEqual(
      results.map((result) => result.goal.number),
      [9],
    );
  });

  it('matches goal names and type labels', () => {
    const ocean = filterGoals({ query: 'below water' });
    assert.deepEqual(
      ocean.map((result) => result.goal.number),
      [14],
    );
    assert.equal(countActions(ocean), 3);
    assert.ok(countActions(filterGoals({ query: 'speak up' })) > 0);
  });

  it('treats a number as a goal number', () => {
    const results = filterGoals({ query: '13' });
    assert.deepEqual(
      results.map((result) => result.goal.number),
      [13],
    );
    assert.equal(filterGoals({ query: '18' }).length, 0);
  });

  it('returns nothing when nothing matches', () => {
    assert.deepEqual(filterGoals({ query: 'zzzz' }), []);
  });
});

describe('pledges', () => {
  const { goal, action } = findAction('g13-plant-trees');

  it('finds actions by id', () => {
    assert.equal(goal.number, 13);
    assert.equal(findAction('missing'), null);
  });

  it('pledges an action once', () => {
    let data = addPledge(emptyData(), { goal, action, date: '2026-03-10', id: 'p1' });
    assert.equal(addPledge(data, { goal, action, date: '2026-03-10' }), data);
    assert.deepEqual(pledgeFor(data, action.id), {
      id: 'p1',
      goal: 13,
      actionId: 'g13-plant-trees',
      text: action.text,
      createdAt: '2026-03-10',
      doneAt: null,
    });
    data = setPledgeDone(data, 'p1', '2026-03-12');
    assert.equal(pledgeFor(data, action.id).doneAt, '2026-03-12');
    data = setPledgeDone(data, 'p1', null);
    assert.equal(pledgeFor(data, action.id).doneAt, null);
    assert.deepEqual([...goalsTouched(data)], [13]);
    assert.equal(removePledge(data, 'p1').pledges.length, 0);
  });

  it('stops at the pledge limit', () => {
    const data = emptyData();
    data.pledges = Array.from({ length: LIMITS.pledges }, (_, index) => ({ id: `p${index}` }));
    assert.equal(canPledge(data), false);
    assert.equal(addPledge(data, { goal, action, date: '2026-03-10' }), data);
  });

  it('every goal has actions to pledge', () => {
    for (const item of GOALS) assert.ok(item.actions.length >= 3, `Goal ${item.number}`);
  });
});
