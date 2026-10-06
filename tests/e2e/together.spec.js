import { KINDNESS_IDEAS } from '../../assets/js/data/kindness-ideas.js';
import { ideaIndexForDay } from '../../assets/js/kindness.js';
import { TODAY, expect, savedData, seed, test } from './fixtures.js';

const todaysIdea = KINDNESS_IDEAS[ideaIndexForDay(TODAY)];
const nextIdea = KINDNESS_IDEAS[(ideaIndexForDay(TODAY) + 1) % KINDNESS_IDEAS.length];

function stat(page, label) {
  return page.locator('#kindness-stats .stat', { has: page.locator('dt', { hasText: label }) }).locator('dd');
}

test("shows today's idea and logs it once", async ({ page }) => {
  await page.goto('/together.html');
  await expect(page.locator('#idea-text')).toHaveText(todaysIdea.text);

  const done = page.locator('#idea-done');
  await expect(done).toHaveText('I did it');
  await done.click();
  await expect(page.locator('#idea-status')).toHaveText('Logged. Thank you for making the world a little kinder.');
  await expect(done).toHaveText('✓ Done today');
  await expect(done).toHaveAttribute('aria-disabled', 'true');
  await expect(done).toBeFocused();
  await expect(stat(page, 'Today')).toHaveText('1');
  await expect(stat(page, 'Day streak')).toHaveText('1');
  await expect(page.locator('#recent-acts > li').first()).toContainText(todaysIdea.text);

  // aria-disabled keeps the button focusable, so a keyboard user can still press it.
  await done.press('Enter');
  await expect(page.locator('#idea-status')).toHaveText("You've already logged this one today. Thank you!");
  expect((await savedData(page)).kindness).toHaveLength(1);
});

test('shows another idea on request', async ({ page }) => {
  await page.goto('/together.html');
  await page.getByRole('button', { name: 'Show another idea' }).click();
  await expect(page.locator('#idea-text')).toHaveText(nextIdea.text);
  await page.getByRole('button', { name: 'I did it' }).click();
  expect((await savedData(page)).kindness[0]).toMatchObject({ date: TODAY, ideaId: nextIdea.id, text: nextIdea.text });
});

test('logs and removes your own acts', async ({ page }) => {
  await page.goto('/together.html');
  const input = page.getByLabel('What did you do?');

  await page.getByRole('button', { name: 'Log it' }).click();
  await expect(page.locator('#act-status')).toHaveText('Write what you did first.');

  await input.fill('Shovelled snow for a neighbour');
  await input.press('Enter');
  await expect(page.locator('#act-status')).toHaveText('Logged. Every act counts.');
  await expect(input).toHaveValue('');
  await expect(page.locator('#recent-acts > li')).toHaveCount(1);
  await expect(page.locator('#recent-acts > li').first()).toContainText('Today');

  await page.getByRole('button', { name: 'Remove “Shovelled snow for a neighbour”' }).click();
  await expect(page.locator('#recent-acts > li')).toHaveCount(0);
  await expect(page.locator('#recent-empty')).toBeVisible();
  await expect(page.locator('#recent-heading')).toBeFocused();
});

test('counts a streak of kind days', async ({ page }) => {
  await seed(page, {
    kindness: [
      { id: 'a', date: '2026-03-01', ideaId: null, text: 'Old one' },
      { id: 'b', date: '2026-03-08', ideaId: null, text: 'Sunday' },
      { id: 'c', date: '2026-03-09', ideaId: null, text: 'Monday' },
    ],
  });
  await page.goto('/together.html');
  await expect(stat(page, 'Day streak')).toHaveText('2');
  await expect(stat(page, 'Last 7 days')).toHaveText('2');
  await expect(stat(page, 'All time')).toHaveText('3');
  await expect(page.locator('#recent-acts > li').first()).toContainText('Monday');
});

test('stays in sync with other open tabs', async ({ page, context }) => {
  await page.goto('/together.html');
  const other = await context.newPage();
  await other.goto('/together.html');
  await other.getByLabel('What did you do?').fill('Sent a thank-you card');
  await other.getByRole('button', { name: 'Log it' }).click();
  await expect(page.locator('#recent-acts')).toContainText('Sent a thank-you card');
  await expect(stat(page, 'Today')).toHaveText('1');
  await other.close();
});
