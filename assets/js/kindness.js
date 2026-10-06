// Feature set 2, "For each other": a daily act of kindness and a kindness log.

import { addDays, currentStreak, dayNumber } from './dates.js';
import { KINDNESS_IDEAS } from './data/kindness-ideas.js';
import { LIMITS, cleanText, makeId } from './store.js';

// Everyone sees the same idea on the same day, and it changes daily.
export function ideaIndexForDay(date, ideas = KINDNESS_IDEAS) {
  const length = ideas.length;
  return ((dayNumber(date) % length) + length) % length;
}

export function ideaById(id, ideas = KINDNESS_IDEAS) {
  return ideas.find((idea) => idea.id === id) ?? null;
}

export function hasDoneIdea(data, date, ideaId) {
  return data.kindness.some((act) => act.date === date && act.ideaId === ideaId);
}

export function logAct(data, { date, ideaId = null, text, id = makeId() }) {
  const clean = cleanText(text, LIMITS.text);
  if (!clean) return data;
  if (ideaId && hasDoneIdea(data, date, ideaId)) return data;
  return { ...data, kindness: [...data.kindness, { id, date, ideaId: ideaId ?? null, text: clean }] };
}

export function removeAct(data, id) {
  return { ...data, kindness: data.kindness.filter((act) => act.id !== id) };
}

export function kindnessStats(data, today) {
  const dates = data.kindness.map((act) => act.date);
  const weekStart = addDays(today, -6);
  return {
    today: dates.filter((date) => date === today).length,
    week: dates.filter((date) => date >= weekStart && date <= today).length,
    total: dates.length,
    streak: currentStreak(dates, today),
  };
}

export function recentActs(data, count = 10) {
  // Stored oldest first; newest first is more useful to read.
  return data.kindness.slice(-count).reverse();
}
