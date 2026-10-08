import { test as base, expect } from '@playwright/test';

// A Tuesday. Playwright runs the browser in UTC (see playwright.config.js).
export const TODAY = '2026-03-10';
export const NOW = new Date(`${TODAY}T09:00:00Z`);
export const STORAGE_KEY = 'heal:v1';

export const test = base.extend({
  // Pin "now" so dates, streaks and the daily idea are predictable.
  // Tests that need to control timers set this to false and install the clock.
  fixedTime: [NOW, { option: true }],

  page: async ({ page, fixedTime }, use) => {
    if (fixedTime) await page.clock.setFixedTime(fixedTime);
    await use(page);
  },

  // Fails any test that logs a console error or throws, which also catches
  // Content Security Policy violations.
  consoleErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(String(error)));
      await use(errors);
      expect(errors, 'console errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

// Saves data the way the app would, then leaves the page on the home page.
export async function seed(page, data) {
  await page.goto('/index.html');
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, JSON.stringify(value)),
    [STORAGE_KEY, { version: 1, checkins: [], gratitude: [], kindness: [], pledges: [], ...data }],
  );
}

export async function savedData(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
}

export function daysAgo(count) {
  const date = new Date(`${TODAY}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - count);
  return date.toISOString().slice(0, 10);
}

// Realistic data for screenshots and the impact page.
export function demoData() {
  return {
    checkins: [
      { date: daysAgo(6), mood: 3, note: '' },
      { date: daysAgo(5), mood: 4, note: 'Good walk at lunch' },
      { date: daysAgo(4), mood: 2, note: 'Long day' },
      { date: daysAgo(2), mood: 4, note: '' },
      { date: daysAgo(1), mood: 5, note: 'Saw old friends' },
      { date: TODAY, mood: 4, note: 'Calm morning' },
    ],
    gratitude: [
      { id: 'g1', date: daysAgo(1), text: 'A long chat with my sister' },
      { id: 'g2', date: TODAY, text: 'Sunshine on the walk to work' },
      { id: 'g3', date: TODAY, text: 'A neighbour fixed my bike' },
    ],
    kindness: [
      { id: 'k1', date: daysAgo(3), ideaId: null, text: 'Helped a neighbour carry their shopping' },
      { id: 'k2', date: daysAgo(1), ideaId: 'thank-unnoticed', text: 'Thank someone whose work usually goes unnoticed.' },
      { id: 'k3', date: TODAY, ideaId: null, text: 'Called my grandad' },
    ],
    pledges: [
      { id: 'p1', goal: 13, actionId: 'g13-plant-trees', text: 'Join a local tree-planting or rewilding day.', createdAt: daysAgo(5), doneAt: daysAgo(1) },
      { id: 'p2', goal: 2, actionId: 'g2-food-bank', text: 'Add a few items to a food bank collection point when you shop.', createdAt: daysAgo(4), doneAt: null },
      { id: 'p3', goal: 4, actionId: 'g4-mentor', text: 'Mentor, tutor or read with a young person.', createdAt: daysAgo(2), doneAt: null },
    ],
  };
}
