// Your impact: totals across every feature set, plus export, import and the
// validation that keeps an imported file from breaking anything.

import { GOALS } from './data/goals.js';
import { currentStreak, lastNDays, longestStreak } from './dates.js';
import { LIMITS, SCHEMA_VERSION, countEntries, normalizeData } from './store.js';
import { moodFor } from './wellbeing.js';
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
  const kindnessDates = data.kindness.map((act) => act.date);

  return {
    checkins: {
      total: data.checkins.length,
      week: weekCheckins.length,
      averageMood: weekCheckins.length ? Math.round((moodTotal / weekCheckins.length) * 10) / 10 : null,
      streak: currentStreak(checkinDates, today),
      longest: longestStreak(checkinDates),
    },
    gratitude: {
      total: data.gratitude.length,
      week: data.gratitude.filter((entry) => inWeek(entry.date)).length,
    },
    kindness: {
      total: data.kindness.length,
      week: data.kindness.filter((act) => inWeek(act.date)).length,
      streak: currentStreak(kindnessDates, today),
      longest: longestStreak(kindnessDates),
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

// Entries from `incoming` that `existing` doesn't already have, by id or by
// what they record.
function newEntries(existing, incoming, keyOf) {
  const ids = new Set(existing.map((item) => item.id));
  const keys = new Set(existing.map(keyOf));
  return incoming.filter((item) => !ids.has(item.id) && !keys.has(keyOf(item)));
}

// Combines data from two browsers. Everything in `current` is kept and what's
// new in `incoming` is added. Where both have a check-in for the same day, the
// one in `current` wins; a pledge for the same action is kept once, and counts
// as done if it was done in either. Also returns how many entries from
// `incoming` were added, marked a pledge done, were already here, were
// check-ins left out because `current` has a different one for that day, or
// were left out to stay within Heal's limits (such as three good things a day).
// Together they count every entry in `incoming`.
export function mergeData(current, incoming) {
  const base = normalizeData(current);
  const extra = normalizeData(incoming);
  const myCheckins = new Map(base.checkins.map((checkin) => [checkin.date, checkin]));
  const theirPledges = new Map(extra.pledges.map((pledge) => [pledge.actionId, pledge]));
  const myActions = new Set(base.pledges.map((pledge) => pledge.actionId));
  let markedDone = 0;

  const pledges = base.pledges.map((pledge) => {
    const theirs = theirPledges.get(pledge.actionId);
    if (!theirs) return pledge;
    if (!pledge.doneAt && theirs.doneAt) markedDone += 1;
    // The earlier start keeps a done date from either copy valid.
    const createdAt = theirs.createdAt < pledge.createdAt ? theirs.createdAt : pledge.createdAt;
    return { ...pledge, createdAt, doneAt: pledge.doneAt ?? theirs.doneAt };
  });

  const candidates = {
    checkins: extra.checkins.filter((checkin) => !myCheckins.has(checkin.date)),
    gratitude: newEntries(base.gratitude, extra.gratitude, (entry) => `${entry.date}\n${entry.text}`),
    kindness: newEntries(base.kindness, extra.kindness, (act) => `${act.date}\n${act.ideaId ? `idea:${act.ideaId}` : act.text}`),
    pledges: extra.pledges.filter((pledge) => !myActions.has(pledge.actionId)),
  };
  const fresh = {};
  let overLimit = 0;
  for (const name of COLLECTIONS) {
    const limit = name === 'pledges' ? LIMITS.pledges : LIMITS.entries;
    const remaining = Math.max(0, limit - base[name].length);
    fresh[name] = candidates[name].slice(0, remaining);
    overLimit += candidates[name].length - fresh[name].length;
  }
  const data = normalizeData({
    checkins: [...base.checkins, ...fresh.checkins],
    gratitude: [...base.gratitude, ...fresh.gratitude],
    kindness: [...base.kindness, ...fresh.kindness],
    pledges: [...pledges, ...fresh.pledges],
  });

  const ids = (list) => new Set(list.map((item) => item.id));
  const [gratitudeIds, kindnessIds] = [ids(base.gratitude), ids(base.kindness)];
  const added =
    data.checkins.filter((checkin) => !myCheckins.has(checkin.date)).length +
    data.gratitude.filter((entry) => !gratitudeIds.has(entry.id)).length +
    data.kindness.filter((act) => !kindnessIds.has(act.id)).length +
    data.pledges.filter((pledge) => !myActions.has(pledge.actionId)).length;
  const differentCheckins = extra.checkins.filter((checkin) => {
    const mine = myCheckins.get(checkin.date);
    return mine && (mine.mood !== checkin.mood || mine.note !== checkin.note);
  }).length;
  return {
    data,
    added,
    markedDone,
    alreadyHere: countEntries(extra) - countEntries(candidates) - markedDone - differentCheckins,
    differentCheckins,
    overLimit: overLimit + countEntries(fresh) - added,
  };
}

const CSV_HEADER = ['Date', 'Type', 'Mood', 'Mood label', 'Text', 'Goal', 'Done on'];

// A spreadsheet may run a cell that starts with one of these as a formula.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// One row per entry, oldest first, for reading or charting in a spreadsheet.
// Only the JSON export can be imported back into Heal.
export function toCsv(data) {
  const goalName = (number) => GOALS.find((goal) => goal.number === number)?.name ?? '';
  const rows = [
    ...data.checkins.map((checkin) => [checkin.date, 'Check-in', checkin.mood, moodFor(checkin.mood)?.label, checkin.note, '', '']),
    ...data.gratitude.map((entry) => [entry.date, 'Good thing', '', '', entry.text, '', '']),
    ...data.kindness.map((act) => [act.date, 'Act of kindness', '', '', act.text, '', '']),
    ...data.pledges.map((pledge) => [
      pledge.createdAt,
      'Pledge',
      '',
      '',
      pledge.text,
      `${pledge.goal}: ${goalName(pledge.goal)}`,
      pledge.doneAt,
    ]),
  ];
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  // The byte order mark tells spreadsheet apps the file is UTF-8, so accents and emoji survive.
  return `\uFEFF${[CSV_HEADER, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export function csvFilename(today) {
  return `heal-data-${today}.csv`;
}
