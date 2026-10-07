import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LIMITS, STORAGE_KEY, Store, cleanText, countEntries, emptyData, makeId, normalizeData } from '../../assets/js/store.js';

class MemoryStorage {
  constructor() {
    this.items = new Map();
  }
  getItem(key) {
    return this.items.has(key) ? this.items.get(key) : null;
  }
  setItem(key, value) {
    this.items.set(key, String(value));
  }
  removeItem(key) {
    this.items.delete(key);
  }
}

class FullStorage extends MemoryStorage {
  setItem() {
    throw new DOMException('Quota exceeded', 'QuotaExceededError');
  }
}

class TestLocks {
  constructor() {
    this.queues = new Map();
  }
  request(name, callback) {
    const previous = this.queues.get(name) ?? Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    const queue = previous.then(() => current);
    this.queues.set(name, queue);
    return previous.then(callback).finally(() => {
      release();
      if (this.queues.get(name) === queue) this.queues.delete(name);
    });
  }
}

const locks = new TestLocks();

describe('cleanText', () => {
  it('trims, collapses whitespace and strips control characters', () => {
    assert.equal(cleanText('  hello \n\t world\u0000 ', 50), 'hello world');
  });

  it('cuts long text without splitting an emoji', () => {
    assert.equal(cleanText('ab😀cd', 3), 'ab😀');
    assert.equal(Array.from(cleanText('x'.repeat(500), LIMITS.text)).length, LIMITS.text);
  });

  it('turns anything that is not a string into an empty string', () => {
    assert.equal(cleanText(42, 10), '');
    assert.equal(cleanText(undefined, 10), '');
    assert.equal(cleanText({ toString: () => 'x' }, 10), '');
  });
});

describe('makeId', () => {
  it('makes unique ids that pass validation', () => {
    const ids = new Set(Array.from({ length: 100 }, makeId));
    assert.equal(ids.size, 100);
    for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{1,64}$/);
  });
});

describe('normalizeData', () => {
  it('turns anything unexpected into empty data', () => {
    for (const value of [null, undefined, 42, 'text', [], { checkins: 'nope' }]) {
      assert.deepEqual(normalizeData(value), emptyData());
    }
  });

  it('keeps one check-in per day, the last one winning, in date order', () => {
    const data = normalizeData({
      checkins: [
        { date: '2026-03-10', mood: 2, note: 'first' },
        { date: '2026-03-09', mood: 4, note: '' },
        { date: '2026-03-10', mood: 5, note: 'second' },
      ],
    });
    assert.deepEqual(data.checkins, [
      { date: '2026-03-09', mood: 4, note: '' },
      { date: '2026-03-10', mood: 5, note: 'second' },
    ]);
  });

  it('drops invalid check-ins', () => {
    const data = normalizeData({
      checkins: [
        { date: '2026-02-30', mood: 3 },
        { date: '2026-03-01', mood: 0 },
        { date: '2026-03-01', mood: 6 },
        { date: '2026-03-01', mood: 2.5 },
        { date: '2026-03-01', mood: '3' },
        'not an object',
        { date: '2026-03-02', mood: 3, note: 7 },
      ],
    });
    assert.deepEqual(data.checkins, [{ date: '2026-03-02', mood: 3, note: '' }]);
  });

  it('allows at most three gratitude notes per day and drops empty ones', () => {
    const notes = ['one', 'two', '   ', 'three', 'four'].map((text, index) => ({ id: `g${index}`, date: '2026-03-10', text }));
    const data = normalizeData({ gratitude: notes });
    assert.deepEqual(
      data.gratitude.map((entry) => entry.text),
      ['one', 'two', 'three'],
    );
  });

  it('generates missing or unsafe ids and drops repeated ids', () => {
    const data = normalizeData({
      kindness: [
        { id: 'same', date: '2026-03-10', text: 'a' },
        { id: 'same', date: '2026-03-10', text: 'b' },
        { id: '<img src=x>', date: '2026-03-10', text: 'c' },
        { date: '2026-03-10', text: 'd' },
      ],
    });
    assert.deepEqual(
      data.kindness.map((act) => act.text),
      ['a', 'c', 'd'],
    );
    assert.equal(data.kindness[0].id, 'same');
    for (const act of data.kindness) assert.match(act.id, /^[A-Za-z0-9_-]{1,64}$/);
  });

  it('only keeps idea ids that look like slugs', () => {
    const data = normalizeData({
      kindness: [
        { id: 'a', date: '2026-03-10', ideaId: 'thank-unnoticed', text: 'x' },
        { id: 'b', date: '2026-03-10', ideaId: 'Not A Slug', text: 'y' },
      ],
    });
    assert.deepEqual(
      data.kindness.map((act) => act.ideaId),
      ['thank-unnoticed', null],
    );
  });

  it('validates pledges and keeps one per action', () => {
    const base = { goal: 13, actionId: 'g13-plant-trees', text: 'Plant trees', createdAt: '2026-03-01', doneAt: null };
    const data = normalizeData({
      pledges: [
        { id: 'p1', ...base },
        { id: 'p2', ...base },
        { id: 'p3', ...base, actionId: 'g13-talk-climate', goal: 18 },
        { id: 'p4', ...base, actionId: 'g13-plant-based', doneAt: '2026-02-01' },
        { id: 'p5', ...base, actionId: 'g13-other', doneAt: '2026-03-05' },
      ],
    });
    assert.deepEqual(
      data.pledges.map((pledge) => [pledge.id, pledge.doneAt]),
      [
        ['p1', null],
        ['p4', null],
        ['p5', '2026-03-05'],
      ],
    );
  });

  it('caps collections', () => {
    const pledges = Array.from({ length: LIMITS.pledges + 5 }, (_, index) => ({
      id: `p${index}`,
      goal: 1,
      actionId: `a-${index}`,
      text: 'x',
      createdAt: '2026-03-01',
      doneAt: null,
    }));
    assert.equal(normalizeData({ pledges }).pledges.length, LIMITS.pledges);
  });

  it('counts entries', () => {
    const data = normalizeData({
      checkins: [{ date: '2026-03-10', mood: 3 }],
      gratitude: [{ id: 'g', date: '2026-03-10', text: 'sun' }],
    });
    assert.equal(countEntries(data), 2);
  });
});

describe('Store', () => {
  it('starts empty and saves changes', async () => {
    const storage = new MemoryStorage();
    const store = new Store(storage, STORAGE_KEY, locks);
    assert.deepEqual(store.data, emptyData());
    assert.equal(await store.update((data) => ({ ...data, checkins: [{ date: '2026-03-10', mood: 4, note: '' }] })), true);
    assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).checkins[0].mood, 4);
    assert.equal(new Store(storage, STORAGE_KEY, locks).data.checkins.length, 1);
  });

  it('recovers from corrupt saved data', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    assert.deepEqual(new Store(storage, STORAGE_KEY, locks).data, emptyData());
  });

  it('applies changes to the freshest saved copy', async () => {
    const storage = new MemoryStorage();
    const tabA = new Store(storage, STORAGE_KEY, locks);
    const tabB = new Store(storage, STORAGE_KEY, locks);
    await tabA.update((data) => ({ ...data, gratitude: [{ id: 'a', date: '2026-03-10', text: 'from A' }] }));
    await tabB.update((data) => ({ ...data, kindness: [{ id: 'b', date: '2026-03-10', ideaId: null, text: 'from B' }] }));
    const saved = new Store(storage, STORAGE_KEY, locks).data;
    assert.equal(saved.gratitude.length, 1);
    assert.equal(saved.kindness.length, 1);
  });

  it('serializes concurrent updates from separate tabs', async () => {
    const storage = new MemoryStorage();
    const tabA = new Store(storage, STORAGE_KEY, locks);
    const tabB = new Store(storage, STORAGE_KEY, locks);
    let startFirst;
    const firstStarted = new Promise((resolve) => {
      startFirst = resolve;
    });
    let releaseFirst;
    const firstGate = new Promise((resolve) => {
      releaseFirst = resolve;
    });

    const first = tabA.update(async (data) => {
      startFirst();
      await firstGate;
      return { ...data, gratitude: [{ id: 'a', date: '2026-03-10', text: 'from A' }] };
    });
    await firstStarted;
    const second = tabB.update((data) => ({
      ...data,
      kindness: [{ id: 'b', date: '2026-03-10', ideaId: null, text: 'from B' }],
    }));
    releaseFirst();

    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    const saved = new Store(storage, STORAGE_KEY, locks).data;
    assert.equal(saved.gratitude.length, 1);
    assert.equal(saved.kindness.length, 1);
  });

  it('keeps working in memory when storage is unavailable', async () => {
    const store = new Store(null, STORAGE_KEY, locks);
    assert.equal(store.persistent, false);
    assert.equal(await store.update((data) => ({ ...data, checkins: [{ date: '2026-03-10', mood: 3, note: '' }] })), false);
    assert.equal(store.data.checkins.length, 1);
    assert.equal(store.read().checkins.length, 1);
  });

  it('does not persist changes without cross-tab locks', async () => {
    const storage = new MemoryStorage();
    const store = new Store(storage, STORAGE_KEY, null);
    assert.equal(
      await store.update((data) => ({ ...data, checkins: [{ date: '2026-03-10', mood: 3, note: '' }] })),
      false,
    );
    assert.equal(store.persistent, false);
    assert.equal(store.data.checkins.length, 1);
    assert.equal(storage.getItem(STORAGE_KEY), null);
  });

  it('reports when saving fails', async () => {
    const storage = new FullStorage();
    const store = new Store(storage, STORAGE_KEY, locks);
    assert.equal(await store.update((data) => ({ ...data, checkins: [{ date: '2026-03-10', mood: 3, note: '' }] })), false);
    assert.equal(
      await store.update((data) => ({ ...data, gratitude: [{ id: 'g1', date: '2026-03-10', text: 'A good thing' }] })),
      false,
    );
    assert.equal(store.persistent, false);
    assert.equal(store.data.checkins.length, 1);
    assert.equal(store.data.gratitude.length, 1);

    storage.setItem = MemoryStorage.prototype.setItem;
    assert.equal(
      await store.update((data) => ({ ...data, kindness: [{ id: 'k1', date: '2026-03-10', ideaId: null, text: 'Helped a friend' }] })),
      true,
    );
    assert.equal(store.persistent, true);
    assert.equal(new Store(storage, STORAGE_KEY, locks).data.checkins.length, 1);
    assert.equal(new Store(storage, STORAGE_KEY, locks).data.gratitude.length, 1);
    assert.equal(new Store(storage, STORAGE_KEY, locks).data.kindness.length, 1);
  });

  it('clears everything', async () => {
    const storage = new MemoryStorage();
    const store = new Store(storage, STORAGE_KEY, locks);
    await store.update((data) => ({ ...data, checkins: [{ date: '2026-03-10', mood: 3, note: '' }] }));
    assert.equal(await store.clear(), true);
    assert.equal(storage.getItem(STORAGE_KEY), null);
    assert.deepEqual(store.data, emptyData());
  });
});
