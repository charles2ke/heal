import { TODAY, expect, savedData, test } from './fixtures.js';

const TREES = 'Join a local tree-planting or rewilding day.';

test('lists all 17 goals and 51 actions', async ({ page }) => {
  await page.goto('/world.html');
  await expect(page.locator('#goal-list > li')).toHaveCount(17);
  await expect(page.locator('#goal-list .action')).toHaveCount(51);
  await expect(page.locator('#results-count')).toHaveText('Showing 51 actions across 17 goals.');
  await expect(page.getByRole('heading', { name: 'Goal 13: Climate Action' })).toBeVisible();
  await expect(page.locator('#pledges-empty')).toBeVisible();
});

test('links each goal to the UN safely', async ({ page }) => {
  await page.goto('/world.html');
  const link = page.getByRole('link', { name: 'Learn more about Goal 6 from the UN (opens in a new tab)' });
  await expect(link).toHaveAttribute('href', 'https://sdgs.un.org/goals/goal6');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test('searches and filters, and keeps the filters in the address', async ({ page }) => {
  await page.goto('/world.html');
  const search = page.getByLabel('Search actions');

  await search.fill('tree');
  await expect(page.locator('#goal-list > li')).toHaveCount(1);
  await expect(page.locator('#results-count')).toHaveText('Showing 1 action across 1 goal.');
  await expect(page).toHaveURL(/\/world\.html\?q=tree$/);

  await search.fill('');
  await page.getByLabel('Type of action').selectOption('give');
  await expect(page).toHaveURL(/\?type=give$/);
  const tags = page.locator('#goal-list .tag');
  await expect(tags.first()).toBeVisible();
  for (const tag of await tags.allTextContents()) expect(tag).toBe('Donate');

  await search.fill('zzzz');
  await expect(page.locator('#results-count')).toHaveText('No actions match. Try another word or type of action.');
  await expect(page.locator('#goal-list > li')).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await expect(page.locator('#goal-list > li')).toHaveCount(17);
  await expect(page).toHaveURL(/\/world\.html$/);
});

test('opens with filters from a shared link', async ({ page }) => {
  await page.goto('/world.html?q=water&type=habit');
  await expect(page.getByLabel('Search actions')).toHaveValue('water');
  await expect(page.getByLabel('Type of action')).toHaveValue('habit');
  await expect(page.locator('#goal-list > li .goal-head h3')).toHaveText(['Goal 6: Clean Water and Sanitation', 'Goal 14: Life Below Water']);
});

test('ignores a nonsense type in the address', async ({ page }) => {
  await page.goto('/world.html?type=<script>');
  await expect(page.getByLabel('Type of action')).toHaveValue('all');
  await expect(page.locator('#goal-list > li')).toHaveCount(17);
});

test('pledges, completes and removes an action', async ({ page }) => {
  await page.goto('/world.html');
  const pledge = page.getByRole('button', { name: `Pledge “${TREES}”` });
  await expect(pledge).toHaveAttribute('aria-pressed', 'false');

  await pledge.click();
  await expect(pledge).toHaveAttribute('aria-pressed', 'true');
  await expect(pledge).toBeFocused();
  await expect(page.locator('#pledge-list > li')).toHaveCount(1);
  await expect(page.locator('#pledges-summary')).toHaveText("1 in progress, 0 done. Tick a pledge when you've done it.");

  const checkbox = page.getByRole('checkbox', { name: TREES });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeFocused();
  await expect(page.locator('#pledge-list > li')).toContainText('done Tue 10 Mar');
  expect((await savedData(page)).pledges[0]).toMatchObject({ goal: 13, actionId: 'g13-plant-trees', createdAt: TODAY, doneAt: TODAY });

  await page.reload();
  await expect(page.getByRole('checkbox', { name: TREES })).toBeChecked();
  await expect(page.getByRole('button', { name: `Pledge “${TREES}”` })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('checkbox', { name: TREES }).uncheck();
  expect((await savedData(page)).pledges[0].doneAt).toBeNull();

  await page.getByRole('button', { name: `Remove “${TREES}”` }).click();
  await expect(page.locator('#pledge-list > li')).toHaveCount(0);
  await expect(page.locator('#pledges-heading')).toBeFocused();
  await expect(page.getByRole('button', { name: `Pledge “${TREES}”` })).toHaveAttribute('aria-pressed', 'false');
});

test('pressing a pledge again takes it back', async ({ page }) => {
  await page.goto('/world.html');
  const pledge = page.getByRole('button', { name: `Pledge “${TREES}”` });
  await pledge.click();
  await pledge.click();
  await expect(pledge).toHaveAttribute('aria-pressed', 'false');
  expect((await savedData(page)).pledges).toEqual([]);
});
