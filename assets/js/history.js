// Looking back: everything recorded on a day, and a month at a time for the
// calendar on "Your impact".

import { addDays, addMonths, monthDays, monthOf, weekdayIndex } from './dates.js';

export function dayDetails(data, date) {
  return {
    date,
    checkin: data.checkins.find((checkin) => checkin.date === date) ?? null,
    gratitude: data.gratitude.filter((entry) => entry.date === date),
    kindness: data.kindness.filter((act) => act.date === date),
    pledgesMade: data.pledges.filter((pledge) => pledge.createdAt === date),
    pledgesKept: data.pledges.filter((pledge) => pledge.doneAt === date),
  };
}

export function isEmptyDay(details) {
  return (
    !details.checkin &&
    details.gratitude.length === 0 &&
    details.kindness.length === 0 &&
    details.pledgesMade.length === 0 &&
    details.pledgesKept.length === 0
  );
}

// The first day anything was recorded, or null when nothing has been yet.
// A pledge is always done on or after the day it was made.
export function firstEntryDate(data) {
  let first = null;
  const dates = [
    ...data.checkins.map((checkin) => checkin.date),
    ...data.gratitude.map((entry) => entry.date),
    ...data.kindness.map((act) => act.date),
    ...data.pledges.map((pledge) => pledge.createdAt),
  ];
  for (const date of dates) if (first === null || date < first) first = date;
  return first;
}

// The months the calendar can show: from the first entry up to this month.
export function monthRange(data, today) {
  const last = monthOf(today);
  const first = firstEntryDate(data);
  return { first: first && monthOf(first) < last ? monthOf(first) : last, last };
}

// One month for the calendar: each day's mood and counts, and the totals.
export function monthView(data, month) {
  const days = new Map(
    monthDays(month).map((date) => [date, { date, mood: null, gratitude: 0, kindness: 0, pledgesKept: 0, pledgesMade: 0 }]),
  );
  for (const checkin of data.checkins) {
    const day = days.get(checkin.date);
    if (day) day.mood = checkin.mood;
  }
  for (const entry of data.gratitude) {
    const day = days.get(entry.date);
    if (day) day.gratitude += 1;
  }
  for (const act of data.kindness) {
    const day = days.get(act.date);
    if (day) day.kindness += 1;
  }
  for (const pledge of data.pledges) {
    const kept = pledge.doneAt ? days.get(pledge.doneAt) : null;
    if (kept) kept.pledgesKept += 1;
    const made = days.get(pledge.createdAt);
    if (made) made.pledgesMade += 1;
  }

  const list = [...days.values()];
  const moods = list.filter((day) => day.mood !== null).map((day) => day.mood);
  const sum = (key) => list.reduce((total, day) => total + day[key], 0);
  return {
    month,
    // Empty cells before the 1st, so it falls under the right weekday.
    offset: weekdayIndex(`${month}-01`),
    days: list,
    totals: {
      checkins: moods.length,
      averageMood: moods.length ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
      gratitude: sum('gratitude'),
      kindness: sum('kindness'),
      pledgesKept: sum('pledgesKept'),
      pledgesMade: sum('pledgesMade'),
    },
  };
}

// The same day of another month, or that month's last day if it is shorter.
function sameDayInMonth(date, months) {
  const days = monthDays(addMonths(monthOf(date), months));
  return days[Math.min(Number(date.slice(8)), days.length) - 1];
}

const MOVES = {
  ArrowLeft: (date) => addDays(date, -1),
  ArrowRight: (date) => addDays(date, 1),
  ArrowUp: (date) => addDays(date, -7),
  ArrowDown: (date) => addDays(date, 7),
  Home: (date) => addDays(date, -weekdayIndex(date)),
  End: (date) => addDays(date, 6 - weekdayIndex(date)),
  PageUp: (date) => sameDayInMonth(date, -1),
  PageDown: (date) => sameDayInMonth(date, 1),
};

// The day a calendar key press moves to, kept between `min` and `max`, or
// null for keys the calendar doesn't use.
export function calendarMove(date, key, { min, max }) {
  const move = MOVES[key];
  if (!move) return null;
  const target = move(date);
  if (target < min) return min;
  if (target > max) return max;
  return target;
}
