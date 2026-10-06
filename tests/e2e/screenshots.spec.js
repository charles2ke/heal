import { demoData, expect, seed, test } from './fixtures.js';

// Full-page screenshots of every page in both themes, saved to
// screenshots/<project>/ and uploaded by CI so reviewers can see each change.
const PAGES = ['index', 'you', 'together', 'world', 'impact'];

for (const theme of ['light', 'dark']) {
  for (const name of PAGES) {
    test(`screenshot ${name} (${theme})`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await seed(page, demoData());
      await page.goto(`/${name}.html`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (name === 'world') await expect(page.locator('#goal-list > li')).toHaveCount(17);
      await page.screenshot({ path: `screenshots/${testInfo.project.name}/${name}-${theme}.png`, fullPage: true });
    });
  }
}
