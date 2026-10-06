// Your impact: totals across every feature set, plus export, import and the
// validation that keeps an imported file from breaking anything.

import { currentStreak, lastNDays } from './dates.js';
import { SCHEMA_VERSION, countEntries, normalizeData } from './store.js';
import { goalsTouched } from './world.js';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const APP_ID = 'heal';

const COLLECTIONS = ['checkins', 'gratitude', 'kindness', 'pledges'];

export function summarize(data, today) {
  const week = lastNDays(7, today);
  const weekStart = week[0];
  const inWeek = (date) => date >= weekStart && date <= today;
  const weekCheckins = data.checkins.filter((checkin) => inWeek(checkin.date));
  const moodTotal = weekCheckins.reduce((total, checkin) => total + checkin.mood, 0);
  const checkinDates = data.checkins.map((checkin) => checkin.date);

  return {
    checkins: {
      total: data.checkins.length,
      week: weekCheckins.length,
      averageMood: weekCheckins.length ? Math.round((moodTotal / weekCheckins.length) * 10) / 10 : null,
      streak: currentStreak(checkinDates, today),
    },
    gratitude: {
      total: data.gratitude.length,
      week: data.gratitude.filter((entry) => inWeek(entry.date)).length,
    },
    kindness: {
      total: data.kindness.length,
      week: data.kindness.filter((act) => inWeek(act.date)).length,
      streak: currentStreak(data.kindness.map((act) => act.date), today),
    },
    pledges: {
      active: data.pledges.filter((pledge) => !pledge.doneAt).length,
      done: data.pledges.filter((pledge) => pledge.doneAt).length,
      goals: goalsTouched(data).size,
    },
    days: week.map((date) => ({
      date,
      mood: data.checkins.find((checkin) => checkin.date === date)?.mood ?? null,
      gratitude: data.gratitude.filter((entry) => entry.date === date).length,
      kindness: data.kindness.filter((act) => act.date === date).length,
    })),
  };
}

export function hasAnyData(data) {
  return countEntries(data) > 0;
}

export function exportPayload(data, now = new Date()) {
  return { app: APP_ID, version: SCHEMA_VERSION, exportedAt: now.toISOString(), data: normalizeData(data) };
}

export function exportFilename(today) {
  return `heal-data-${today}.json`;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function rawCount(source) {
  return COLLECTIONS.reduce((total, name) => total + (Array.isArray(source[name]) ? source[name].length : 0), 0);
}

// Accepts a file made by "Export my data". Returns { ok: true, data, skipped }
// or { ok: false, error } with a message that can be shown as it is.
export function parseImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON, so it can't be a Heal export." };
  }
  if (!isRecord(parsed) || parsed.app !== APP_ID || !isRecord(parsed.data)) {
    return { ok: false, error: "That file isn't a Heal export." };
  }
  const version = parsed.version ?? parsed.data.version;
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, error: "That file isn't a Heal export." };
  }
  if (version > SCHEMA_VERSION) {
    return { ok: false, error: 'That file comes from a newer version of Heal. Please reload Heal and try again.' };
  }
  const data = normalizeData(parsed.data);
  return { ok: true, data, skipped: Math.max(0, rawCount(parsed.data) - countEntries(data)) };
}
