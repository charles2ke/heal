import { expect, test } from './fixtures.js';

const PAGES = [
  { path: '/index.html', title: /^Heal/, heading: 'Heal', nav: 'Home' },
  { path: '/you.html', title: 'For you · Heal', heading: 'For you', nav: 'For you' },
  { path: '/together.html', title: 'For each other · Heal', heading: 'For each other', nav: 'For each other' },
  { path: '/world.html', title: 'For everyone · Heal', heading: 'For everyone', nav: 'For everyone' },
  { path: '/impact.html', title: 'Your impact · Heal', heading: 'Your impact', nav: 'Your impact' },
];

for (const { path, title, heading, nav } of PAGES) {
  test(`${path} loads cleanly`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    const current = page.getByRole('navigation', { name: 'Main' }).locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText(nav);
    await expect(page.locator('#storage-warning')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Read the source code' })).toHaveAttribute('href', 'https://github.com/charles2ke/heal');
  });
}

test('the skip link moves focus to the main content', async ({ page }) => {
  await page.goto('/you.html');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await skip.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('the navigation reaches every page', async ({ page }) => {
  await page.goto('/index.html');
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const { heading, nav: name } of PAGES.slice(1)) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  }
});

test('the home page links to every feature set', async ({ page }) => {
  await page.goto('/index.html');
  for (const name of ['For you', 'For each other', 'For everyone', 'Your impact']) {
    await expect(page.locator('.cards').getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(page.locator('#today-date')).toHaveText(/^Tuesday,? 10 March 2026$/);
  await expect(page.locator('#today-grid > li')).toHaveCount(3);
  await expect(page.locator('#today-grid')).toContainText("You haven't checked in yet today.");
});

test('the theme toggle switches to dark and remembers it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/index.html');
  const toggle = page.getByRole('button', { name: 'Dark theme' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/world.html');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Dark theme' })).toHaveAttribute('aria-pressed', 'true');
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe('rgb(14, 23, 25)');

  await page.getByRole('button', { name: 'Dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('the toggle follows the system theme until you choose', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/index.html');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  await expect(page.getByRole('button', { name: 'Dark theme' })).toHaveAttribute('aria-pressed', 'true');
});

test.describe('when the browser blocks storage', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('Storage is blocked', 'SecurityError');
        },
      });
    });
  });

  test('pages warn that nothing will be saved and still work', async ({ page }) => {
    await page.goto('/together.html');
    await expect(page.locator('#storage-warning')).toBeVisible();
    await page.getByLabel('What did you do?').fill('Held the door');
    await page.getByRole('button', { name: 'Log it' }).click();
    await expect(page.locator('#act-status')).toHaveText("Logged, but this browser can't save it.");
    await expect(page.locator('#recent-acts')).toContainText('Held the door');

    await page.getByRole('button', { name: 'Dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
