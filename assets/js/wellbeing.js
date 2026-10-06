// Feature set 1, "For you": daily check-ins, gratitude notes and paced breathing.

import { LIMITS, cleanText, makeId } from './store.js';

export const MOODS = Object.freeze([
  { value: 1, label: 'Struggling', emoji: '😣' },
  { value: 2, label: 'Low', emoji: '😔' },
  { value: 3, label: 'Okay', emoji: '😐' },
  { value: 4, label: 'Good', emoji: '🙂' },
  { value: 5, label: 'Great', emoji: '😄' },
]);

// Check-ins at or below this mood show a gentle pointer to support.
export const LOW_MOOD = 2;

export function moodFor(value) {
  return MOODS.find((mood) => mood.value === value) ?? null;
}

export function checkinFor(data, date) {
  return data.checkins.find((checkin) => checkin.date === date) ?? null;
}

// One check-in per day; saving again replaces that day's check-in.
export function setCheckin(data, { date, mood, note = '' }) {
  const checkin = { date, mood, note: cleanText(note, LIMITS.note) };
  return { ...data, checkins: [...data.checkins.filter((item) => item.date !== date), checkin] };
}

export function gratitudeFor(data, date) {
  return data.gratitude.filter((entry) => entry.date === date);
}

export function canAddGratitude(data, date) {
  return gratitudeFor(data, date).length < LIMITS.gratitudePerDay;
}

export function addGratitude(data, { date, text, id = makeId() }) {
  const clean = cleanText(text, LIMITS.text);
  if (!clean || !canAddGratitude(data, date)) return data;
  return { ...data, gratitude: [...data.gratitude, { id, date, text: clean }] };
}

export function removeGratitude(data, id) {
  return { ...data, gratitude: data.gratitude.filter((entry) => entry.id !== id) };
}

// "in" grows the breathing circle, "out" shrinks it, holds keep it still.
export const BREATHING_PATTERNS = Object.freeze({
  box: {
    id: 'box',
    label: 'Box breathing (4-4-4-4)',
    phases: [
      { label: 'Breathe in', seconds: 4, motion: 'in' },
      { label: 'Hold', seconds: 4, motion: 'hold-in' },
      { label: 'Breathe out', seconds: 4, motion: 'out' },
      { label: 'Hold', seconds: 4, motion: 'hold-out' },
    ],
  },
  relax: {
    id: 'relax',
    label: '4-7-8 breathing',
    phases: [
      { label: 'Breathe in', seconds: 4, motion: 'in' },
      { label: 'Hold', seconds: 7, motion: 'hold-in' },
      { label: 'Breathe out', seconds: 8, motion: 'out' },
    ],
  },
});

export function cycleSeconds(pattern) {
  return pattern.phases.reduce((total, phase) => total + phase.seconds, 0);
}

// Where a breathing session is after `elapsedMs`, derived from elapsed time
// rather than counted ticks so a slow or throttled timer never drifts.
export function breathingStep(pattern, elapsedMs) {
  const elapsed = Math.max(0, elapsedMs) / 1000;
  const cycle = cycleSeconds(pattern);
  const cycles = Math.floor(elapsed / cycle);
  let offset = elapsed - cycles * cycle;
  for (let index = 0; index < pattern.phases.length; index += 1) {
    const phase = pattern.phases[index];
    if (offset < phase.seconds) {
      return { phase, index, cycles, secondsLeft: Math.ceil(phase.seconds - offset) };
    }
    offset -= phase.seconds;
  }
  // Only reachable through floating-point rounding at a cycle boundary.
  return { phase: pattern.phases[0], index: 0, cycles: cycles + 1, secondsLeft: pattern.phases[0].seconds };
}
