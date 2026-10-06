// Everything Heal remembers lives in one versioned JSON document in this
// browser's localStorage. Every read, write and import goes through
// normalizeData(), so malformed or hand-edited data can never break a page.

import { isDateKey } from './dates.js';

export const STORAGE_KEY = 'heal:v1';
export const SCHEMA_VERSION = 1;

export const LIMITS = Object.freeze({
  note: 280,
  text: 200,
  entries: 5000,
  pledges: 200,
  gratitudePerDay: 3,
  goals: 17,
});

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

export function emptyData() {
  return { version: SCHEMA_VERSION, checkins: [], gratitude: [], kindness: [], pledges: [] };
}

export function makeId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  // randomUUID needs a secure context; getRandomValues does not.
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Single-line, trimmed text, cut on a character boundary so emoji survive.
export function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max).join('').trim() : text;
}

export function isSlug(value) {
  return typeof value === 'string' && SLUG_PATTERN.test(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIntegerBetween(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

// Keeps valid ids, generates missing ones and skips repeats of the same entry.
function withUniqueIds(seen) {
  return (item) => {
    const id = typeof item.id === 'string' && ID_PATTERN.test(item.id) ? item.id : makeId();
    if (seen.has(id)) return null;
    seen.add(id);
    return id;
  };
}

function byDate(a, b) {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

function normalizeCheckins(list) {
  const latestByDate = new Map();
  for (const item of asArray(list)) {
    if (!isRecord(item) || !isDateKey(item.date) || !isIntegerBetween(item.mood, 1, 5)) continue;
    latestByDate.set(item.date, {
      date: item.date,
      mood: item.mood,
      note: cleanText(item.note, LIMITS.note),
    });
  }
  return [...latestByDate.values()].sort(byDate).slice(-LIMITS.entries);
}

function normalizeGratitude(list) {
  const uniqueId = withUniqueIds(new Set());
  const perDay = new Map();
  const result = [];
  for (const item of asArray(list)) {
    if (!isRecord(item) || !isDateKey(item.date)) continue;
    const text = cleanText(item.text, LIMITS.text);
    const count = perDay.get(item.date) ?? 0;
    if (!text || count >= LIMITS.gratitudePerDay) continue;
    const id = uniqueId(item);
    if (!id) continue;
    perDay.set(item.date, count + 1);
    result.push({ id, date: item.date, text });
  }
  return result.sort(byDate).slice(-LIMITS.entries);
}

function normalizeKindness(list) {
  const uniqueId = withUniqueIds(new Set());
  const result = [];
  for (const item of asArray(list)) {
    if (!isRecord(item) || !isDateKey(item.date)) continue;
    const text = cleanText(item.text, LIMITS.text);
    if (!text) continue;
    const id = uniqueId(item);
    if (!id) continue;
    result.push({ id, date: item.date, ideaId: isSlug(item.ideaId) ? item.ideaId : null, text });
  }
  return result.sort(byDate).slice(-LIMITS.entries);
}

function normalizePledges(list) {
  const uniqueId = withUniqueIds(new Set());
  const actions = new Set();
  const result = [];
  for (const item of asArray(list)) {
    if (!isRecord(item) || !isSlug(item.actionId) || actions.has(item.actionId)) continue;
    if (!isIntegerBetween(item.goal, 1, LIMITS.goals) || !isDateKey(item.createdAt)) continue;
    const text = cleanText(item.text, LIMITS.text);
    if (!text) continue;
    const id = uniqueId(item);
    if (!id) continue;
    actions.add(item.actionId);
    const doneAt = isDateKey(item.doneAt) && item.doneAt >= item.createdAt ? item.doneAt : null;
    result.push({ id, goal: item.goal, actionId: item.actionId, text, createdAt: item.createdAt, doneAt });
    if (result.length === LIMITS.pledges) break;
  }
  return result;
}

export function normalizeData(raw) {
  const source = isRecord(raw) ? raw : {};
  return {
    version: SCHEMA_VERSION,
    checkins: normalizeCheckins(source.checkins),
    gratitude: normalizeGratitude(source.gratitude),
    kindness: normalizeKindness(source.kindness),
    pledges: normalizePledges(source.pledges),
  };
}

export function countEntries(data) {
  return data.checkins.length + data.gratitude.length + data.kindness.length + data.pledges.length;
}

// Returns localStorage if it can actually be written to. Some browsers expose
// it but throw on access (blocked cookies, some private modes).
export function browserStorage() {
  try {
    const storage = globalThis.localStorage;
    const probe = '__heal_probe__';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export class Store {
  constructor(storage = browserStorage(), key = STORAGE_KEY) {
    this.storage = storage;
    this.key = key;
    // False when nothing can be saved, so pages can warn the user honestly.
    this.persistent = Boolean(storage);
    this.memory = emptyData();
    this.data = this.read();
  }

  read() {
    if (!this.storage) return normalizeData(this.memory);
    try {
      const raw = this.storage.getItem(this.key);
      return raw ? normalizeData(JSON.parse(raw)) : emptyData();
    } catch {
      return emptyData();
    }
  }

  reload() {
    this.data = this.read();
    return this.data;
  }

  write(data) {
    this.memory = data;
    if (!this.storage) return false;
    try {
      this.storage.setItem(this.key, JSON.stringify(data));
      this.persistent = true;
      return true;
    } catch {
      this.persistent = false;
      return false;
    }
  }

  // Applies a pure change to the freshest saved copy, so an older copy held by
  // another open tab cannot overwrite newer changes. Returns whether it saved.
  update(change) {
    const next = normalizeData(change(this.read()));
    this.data = next;
    return this.write(next);
  }

  replace(data) {
    return this.update(() => data);
  }

  clear() {
    this.memory = emptyData();
    this.data = emptyData();
    if (!this.storage) return true;
    try {
      this.storage.removeItem(this.key);
      return true;
    } catch {
      return false;
    }
  }
}
