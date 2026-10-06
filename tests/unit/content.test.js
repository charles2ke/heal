import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ACTION_TYPES, GOALS, goalUrl } from '../../assets/js/data/goals.js';
import { KINDNESS_IDEAS } from '../../assets/js/data/kindness-ideas.js';
import { LIMITS, cleanText, isSlug } from '../../assets/js/store.js';

describe('content', () => {
  it('lists the 17 goals in order', () => {
    assert.deepEqual(
      GOALS.map((goal) => goal.number),
      Array.from({ length: 17 }, (_, index) => index + 1),
    );
    assert.equal(GOALS[16].name, 'Partnerships for the Goals');
    assert.equal(goalUrl(6), 'https://sdgs.un.org/goals/goal6');
  });

  it('gives every action a unique slug, a known type and text that fits', () => {
    const ids = new Set();
    for (const goal of GOALS) {
      assert.ok(goal.name && goal.summary, `Goal ${goal.number}`);
      for (const action of goal.actions) {
        assert.ok(isSlug(action.id), action.id);
        assert.ok(!ids.has(action.id), `Duplicate ${action.id}`);
        ids.add(action.id);
        assert.ok(Object.hasOwn(ACTION_TYPES, action.type), action.id);
        assert.equal(cleanText(action.text, LIMITS.text), action.text, action.id);
      }
    }
  });

  it('gives every kindness idea a unique slug and text that fits', () => {
    assert.ok(KINDNESS_IDEAS.length >= 30);
    const ids = new Set(KINDNESS_IDEAS.map((idea) => idea.id));
    assert.equal(ids.size, KINDNESS_IDEAS.length);
    for (const idea of KINDNESS_IDEAS) {
      assert.ok(isSlug(idea.id), idea.id);
      assert.equal(cleanText(idea.text, LIMITS.text), idea.text, idea.id);
    }
    const texts = new Set(KINDNESS_IDEAS.map((idea) => idea.text));
    assert.equal(texts.size, KINDNESS_IDEAS.length);
  });
});
