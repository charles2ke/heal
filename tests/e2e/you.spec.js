import { TODAY, expect, savedData, seed, test } from './fixtures.js';

async function chooseMood(page, label) {
  await page.locator('.mood-options label', { hasText: label }).click();
}

test.describe('daily check-in', () => {
  test('asks for a mood before saving', async ({ page }) => {
    await page.goto('/you.html');
    await page.getByRole('button', { name: 'Save check-in' }).click();
    await expect(page.locator('#checkin-status')).toHaveText("Choose how you're feeling first.");
    await expect(page.getByRole('radio', { name: 'Struggling' })).toBeFocused();
    expect(await savedData(page)).toBeNull();
  });

  test('saves, shows and updates today', async ({ page }) => {
    await page.goto('/you.html');
    await chooseMood(page, 'Good');
    await page.getByLabel('Anything on your mind?').fill('  Slept well  ');
    await page.getByRole('button', { name: 'Save check-in' }).click();

    await expect(page.locator('#checkin-status')).toHaveText('Check-in saved. Thank you for taking a moment for yourself.');
    await expect(page.getByRole('button', { name: 'Update check-in' })).toBeVisible();
    await expect(page.locator('#mood-week > li')).toHaveCount(7);
    await expect(page.locator('#mood-week > li').last()).toHaveAttribute('aria-current', 'date');
    await expect(page.locator('#mood-week > li').last()).toContainText('Tue (today)');
    await expect(page.locator('#mood-week > li').last()).toContainText('Good');
    expect((await savedData(page)).checkins).toEqual([{ date: TODAY, mood: 4, note: 'Slept well' }]);

    await page.reload();
    await expect(page.getByRole('radio', { name: 'Good', exact: true })).toBeChecked();
    await expect(page.getByLabel('Anything on your mind?')).toHaveValue('Slept well');

    await chooseMood(page, 'Great');
    await page.getByRole('button', { name: 'Update check-in' }).click();
    await expect(page.locator('#checkin-status')).toHaveText('Check-in updated.');
    expect((await savedData(page)).checkins).toHaveLength(1);
  });

  test('can be used with the keyboard', async ({ page }) => {
    await page.goto('/you.html');
    await page.getByRole('radio', { name: 'Struggling' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Okay' })).toBeChecked();
    await page.getByRole('button', { name: 'Save check-in' }).press('Enter');
    await expect(page.locator('#checkin-status')).toContainText('Check-in saved');
  });

  test('offers support on a low day', async ({ page }) => {
    await page.goto('/you.html');
    const nudge = page.locator('#support-nudge');
    await expect(nudge).toBeHidden();
    await chooseMood(page, 'Struggling');
    await page.getByRole('button', { name: 'Save check-in' }).click();
    await expect(nudge).toBeVisible();
    await nudge.getByRole('link', { name: 'free, confidential support' }).click();
    await expect(page).toHaveURL(/#support$/);
    await expect(page.getByRole('heading', { name: 'Need support now?' })).toBeInViewport();

    await chooseMood(page, 'Okay');
    await page.getByRole('button', { name: 'Update check-in' }).click();
    await expect(nudge).toBeHidden();
  });

  test('shows the last seven days', async ({ page }) => {
    await seed(page, {
      checkins: [
        { date: '2026-03-04', mood: 1, note: '' },
        { date: '2026-03-09', mood: 5, note: '' },
        { date: '2026-03-03', mood: 3, note: 'too old to show' },
      ],
    });
    await page.goto('/you.html');
    const days = page.locator('#mood-week > li');
    await expect(days).toHaveCount(7);
    await expect(days.first()).toContainText('Wed');
    await expect(days.first()).toContainText('Struggling');
    await expect(days.nth(5)).toContainText('Great');
    await expect(days.last()).toContainText('no check-in');
  });
});

test.describe('three good things', () => {
  test('adds up to three a day and removes them', async ({ page }) => {
    await page.goto('/you.html');
    const input = page.getByLabel('Something good from today');
    const add = page.getByRole('button', { name: 'Add', exact: true });

    await add.click();
    await expect(page.locator('#gratitude-status')).toHaveText('Write something good first, however small.');

    for (const text of ['Fresh coffee', 'A kind email', 'Finished my book']) {
      await input.fill(text);
      await add.click();
    }
    await expect(page.locator('#gratitude-list > li')).toHaveCount(3);
    await expect(page.locator('#gratitude-status')).toHaveText("Added. That's your three good things for today.");
    await expect(input).toBeDisabled();
    await expect(page.locator('#gratitude-list-heading')).toBeFocused();

    await page.getByRole('button', { name: 'Remove “A kind email”' }).click();
    await expect(page.locator('#gratitude-list > li')).toHaveCount(2);
    await expect(input).toBeEnabled();
    await expect(page.locator('#gratitude-list-heading')).toBeFocused();
    expect((await savedData(page)).gratitude.map((entry) => entry.text)).toEqual(['Fresh coffee', 'Finished my book']);
  });

  test('shows text exactly as typed, never as HTML', async ({ page }) => {
    await page.goto('/you.html');
    await page.getByLabel('Something good from today').fill('<img src=x onerror=alert(1)> & friends');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('#gratitude-list .entry-text')).toHaveText('<img src=x onerror=alert(1)> & friends');
    await expect(page.locator('#gratitude-list img')).toHaveCount(0);
  });
});

test.describe('breathing', () => {
  test.use({ fixedTime: false });

  // Pausing the fake clock means only runFor() moves time, so phases change exactly on cue.
  async function openPaused(page) {
    await page.clock.install({ time: new Date(`${TODAY}T09:00:00Z`) });
    await page.goto('/you.html');
    await page.clock.pauseAt(new Date(`${TODAY}T09:00:05Z`));
  }

  test('guides each phase and stops', async ({ page }) => {
    await openPaused(page);
    const phase = page.locator('#breath-phase');
    await expect(phase).toHaveText("Press Start when you're ready.");

    await page.getByRole('button', { name: 'Start' }).click();
    await expect(phase).toHaveText('Breathe in');
    await expect(page.locator('#breath-count')).toHaveText('4');
    await expect(page.getByLabel('Pattern')).toBeDisabled();

    await page.clock.runFor(4_000);
    await expect(phase).toHaveText('Hold');
    await page.clock.runFor(4_000);
    await expect(phase).toHaveText('Breathe out');
    await page.clock.runFor(8_000);
    await expect(phase).toHaveText('Breathe in');
    await expect(page.locator('#breath-cycles')).toHaveText('Rounds completed: 1');

    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(phase).toHaveText('Well done. Press Start whenever you need another moment.');
    await expect(page.getByLabel('Pattern')).toBeEnabled();
  });

  test('supports 4-7-8 breathing', async ({ page }) => {
    await openPaused(page);
    await page.getByLabel('Pattern').selectOption('relax');
    await page.getByRole('button', { name: 'Start' }).click();
    await page.clock.runFor(4_000);
    await expect(page.locator('#breath-phase')).toHaveText('Hold');
    await expect(page.locator('#breath-count')).toHaveText('7');
    await page.clock.runFor(7_000);
    await expect(page.locator('#breath-phase')).toHaveText('Breathe out');
    await expect(page.locator('#breath-count')).toHaveText('8');
  });
});

test('the support panel links to free helplines safely', async ({ page }) => {
  await page.goto('/you.html');
  const support = page.locator('#support');
  await expect(support).toContainText('call your local emergency number now');
  await expect(support).toContainText("It isn't a medical or crisis service");
  const link = support.getByRole('link', { name: 'Find a Helpline (opens in a new tab)' });
  await expect(link).toHaveAttribute('href', 'https://findahelpline.com');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});
