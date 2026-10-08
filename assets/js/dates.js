// Calendar-day helpers. A "date key" is a local-time YYYY-MM-DD string, so a
// day always means the user's own day regardless of their timezone.

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDateKey(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_KEY.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

// Noon avoids daylight-saving transitions that skip or repeat midnight.
export function fromDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function addDays(key, days) {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

// The last `count` days ending with `today`, oldest first.
export function lastNDays(count, today = toDateKey()) {
  return Array.from({ length: count }, (_, index) => addDays(today, index - (count - 1)));
}

// Whole days since 1970-01-01 for a calendar date, independent of timezone.
export function dayNumber(key) {
  const [year, month, day] = key.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

// Consecutive days with activity, ending today. A streak that ended yesterday
// is still alive until the end of today, so it is counted from yesterday.
export function currentStreak(dateKeys, today = toDateKey()) {
  const days = new Set(dateKeys);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function formatDay(key, options = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return fromDateKey(key).toLocaleDateString(undefined, options);
}
