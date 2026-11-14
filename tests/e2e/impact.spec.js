import { readFile } from 'node:fs/promises';

import { TODAY, daysAgo, demoData, expect, savedData, seed, test, themeColour } from './fixtures.js';

function card(page, label) {
  return page.locator('#stat-grid .stat-card', { has: page.locator('.stat-label', { hasText: label }) });
}

test('adds up everything you have done', async ({ page }) => {
  await seed(page, demoData());
  await page.goto('/impact.html');

  await expect(card(page, 'Days checked in').locator('.stat-value')).toHaveText('6');
  await expect(card(page, 'Average mood this week').locator('.stat-value')).toHaveText('3.7 / 5');
  await expect(card(page, 'Average mood this week').locator('.stat-detail')).toHaveText('Mostly good');
  await expect(card(page, 'Good things noted').locator('.stat-value')).toHaveText('3');
  await expect(card(page, 'Check-in streak').locator('.stat-value')).toHaveText('3 days');
  await expect(card(page, 'Check-in streak').locator('.stat-detail')).toHaveText('Longest: 3 days');
  await expect(card(page, 'Acts of kindness').locator('.stat-detail')).toHaveText('3 in the last 7 days');
  await expect(card(page, 'Kindness streak').locator('.stat-value')).toHaveText('2 days');
  await expect(card(page, 'Kindness streak').locator('.stat-detail')).toHaveText('Longest: 2 days');
  await expect(card(page, 'Pledges kept').locator('.stat-value')).toHaveText('1');
  await expect(card(page, 'Global Goals you are helping').locator('.stat-value')).toHaveText('3 of 17');

  const rows = page.locator('#week-body tr');
  await expect(rows).toHaveCount(7);
  await expect(rows.first().locator('th')).toHaveText('Today');
  await expect(rows.first().locator('td')).toHaveText(['🙂 Good', '2', '1']);
  await expect(rows.nth(3).locator('td').first()).toHaveText('–No check-in');
});

test('shows an empty state with no data', async ({ page }) => {
  await page.goto('/impact.html');
  await expect(card(page, 'Average mood this week').locator('.stat-value')).toHaveText('–');
  await expect(card(page, 'Global Goals you are helping').locator('.stat-detail')).toHaveText('Make a pledge to start');
  await expect(card(page, 'Check-in streak').locator('.stat-detail')).toHaveText('Check in today to start one');
  await expect(page.locator('#month-summary')).toHaveText('Nothing recorded in March 2026 yet.');
  await expect(page.locator('#day-empty')).toBeVisible();
});

test('exports your data as a file that imports again', async ({ page }) => {
  await seed(page, demoData());
  await page.goto('/impact.html');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my data' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`heal-data-${TODAY}.json`);
  await expect(page.locator('#data-status')).toHaveText('Exported 15 entries.');

  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported).toMatchObject({ app: 'heal', version: 1 });
  expect(exported.data.pledges).toHaveLength(3);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete all my data' }).click();
  await expect(page.locator('#data-status')).toHaveText('All of your Heal data has been deleted from this browser.');
  await expect(card(page, 'Days checked in').locator('.stat-value')).toHaveText('0');

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import data' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'heal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect(page.locator('#data-status')).toHaveText('Imported 15 entries.');
  await expect(card(page, 'Days checked in').locator('.stat-value')).toHaveText('6');
  expect((await savedData(page)).pledges).toHaveLength(3);
});

test('asks how to import into data that is already here, and rejects files that are not Heal exports', async ({ page }) => {
  await seed(page, demoData());
  await page.goto('/impact.html');
  const input = page.locator('#import-file');
  const dialog = page.getByRole('dialog', { name: 'Import this file?' });
  const status = page.locator('#data-status');

  await input.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(status).toHaveText("That file isn't valid JSON, so it can't be a Heal export.");

  await input.setInputFiles({ name: 'other.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"other","data":{}}') });
  await expect(status).toHaveText("That file isn't a Heal export.");
  await expect(dialog).toBeHidden();

  const replacement = { app: 'heal', version: 1, data: { checkins: [{ date: TODAY, mood: 1 }, { date: 'nope', mood: 1 }] } };
  const file = { name: 'heal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) };
  await input.setInputFiles(file);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('The file has 1 entry. This browser already has 15 entries.');
  await expect(dialog.getByRole('button', { name: 'Combine with my data' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(status).toHaveText('Import cancelled. Nothing was changed.');
  await expect(page.getByRole('button', { name: 'Import data' })).toBeFocused();

  await input.setInputFiles(file);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(status).toHaveText('Import cancelled. Nothing was changed.');
  expect((await savedData(page)).checkins).toHaveLength(6);

  await input.setInputFiles(file);
  await dialog.getByRole('button', { name: 'Replace my data' }).click();
  await expect(status).toHaveText('Imported 1 entry. 1 entry was skipped because it was invalid or repeated.');
  expect((await savedData(page)).checkins).toEqual([{ date: TODAY, mood: 1, note: '' }]);
});

test('combines a file with the data already here', async ({ page }) => {
  await seed(page, demoData());
  await page.goto('/impact.html');
  const fromPhone = {
    app: 'heal',
    version: 1,
    data: {
      checkins: [
        { date: TODAY, mood: 1, note: 'From my phone' },
        { date: daysAgo(3), mood: 3, note: 'From my phone' },
      ],
      gratitude: [
        { id: 'g1', date: daysAgo(1), text: 'A long chat with my sister' },
        { id: 'x1', date: TODAY, text: 'Phone good thing' },
        { id: 'x2', date: TODAY, text: 'One too many for today' },
      ],
      pledges: [
        {
          id: 'q2',
          goal: 2,
          actionId: 'g2-food-bank',
          text: 'Add a few items to a food bank collection point when you shop.',
          createdAt: daysAgo(4),
          doneAt: daysAgo(2),
        },
      ],
    },
  };
  await page.locator('#import-file').setInputFiles({ name: 'phone.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fromPhone)) });
  const dialog = page.getByRole('dialog', { name: 'Import this file?' });
  await expect(dialog).toContainText('The file has 6 entries. This browser already has 15 entries.');
  await dialog.getByRole('button', { name: 'Combine with my data' }).click();

  await expect(page.locator('#data-status')).toHaveText(
    "Added 2 new entries from the file. Marked 1 pledge as kept. 1 entry was already here. 1 check-in from the file wasn't added, because this browser already has a different one for that day. 1 entry was left out to stay within Heal's limits, such as three good things a day.",
  );
  const saved = await savedData(page);
  expect(saved.checkins).toHaveLength(7);
  expect(saved.checkins.find((checkin) => checkin.date === TODAY)).toEqual({ date: TODAY, mood: 4, note: 'Calm morning' });
  expect(saved.gratitude.filter((entry) => entry.date === TODAY).map((entry) => entry.text)).toEqual([
    'Sunshine on the walk to work',
    'A neighbour fixed my bike',
    'Phone good thing',
  ]);
  expect(saved.pledges.find((pledge) => pledge.actionId === 'g2-food-bank').doneAt).toBe(daysAgo(2));
  await expect(card(page, 'Pledges kept').locator('.stat-value')).toHaveText('2');
});

test('exports a spreadsheet copy', async ({ page }) => {
  await seed(page, demoData());
  await page.goto('/impact.html');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export as a spreadsheet (CSV)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`heal-data-${TODAY}.csv`);
  await expect(page.locator('#data-status')).toHaveText('Exported 15 entries as a spreadsheet.');

  const lines = (await readFile(await download.path(), 'utf8')).split('\r\n');
  expect(lines[0]).toBe('\uFEFFDate,Type,Mood,Mood label,Text,Goal,Done on');
  expect(lines).toHaveLength(17);
  expect(lines.at(-1)).toBe('');
  expect(lines).toContain('2026-03-05,Check-in,4,Good,Good walk at lunch,,');
  expect(lines).toContain('2026-03-05,Pledge,,,Join a local tree-planting or rewilding day.,13: Climate Action,2026-03-09');
  expect(lines).toContain('2026-03-08,Pledge,,,"Mentor, tutor or read with a young person.",4: Quality Education,');
  expect(lines).toContain('2026-03-10,Act of kindness,,,Called my grandad,,');
});

test.describe('look back', () => {
  test('shows everything from a chosen day', async ({ page }) => {
    await seed(page, demoData());
    await page.goto('/impact.html');
    const lookBack = page.locator('#look-back');
    const details = page.locator('#day-list');

    await expect(page.locator('#month-heading')).toHaveText('March 2026');
    await expect(page.locator('#month-summary')).toHaveText(
      'In March 2026 you checked in on 6 days (average mood 3.7 / 5), noted 3 good things, shared 3 acts of kindness, kept 1 pledge and made 3 pledges.',
    );
    await expect(page.locator('#month-prev')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#month-next')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#calendar-days th')).toHaveText(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    // 1 March 2026 was a Sunday, and days after today can't be chosen.
    await expect(page.locator('#calendar-body tr').first().locator('td').last()).toContainText('1');
    await expect(lookBack.locator('button.calendar-day')).toHaveCount(10);
    await expect(lookBack.locator('.calendar-day.future')).toHaveCount(21);

    const today = lookBack.getByRole('button', { name: 'Tuesday 10 March: Good, 2 good things, 1 act of kindness', exact: true });
    await expect(today).toHaveAttribute('aria-pressed', 'true');
    await expect(today).toHaveAttribute('aria-current', 'date');
    await expect(page.locator('#day-heading')).toHaveText('Tuesday 10 March');
    await expect(details.locator('dt')).toHaveText(['Mood', 'Note', 'Good things', 'Acts of kindness']);
    await expect(details.locator('dd')).toHaveText([
      '🙂 Good',
      'Calm morning',
      'Sunshine on the walk to workA neighbour fixed my bike',
      'Called my grandad',
    ]);

    await lookBack.getByRole('button', { name: 'Monday 9 March: Great, 1 good thing, 1 act of kindness, 1 pledge kept', exact: true }).click();
    await expect(page.locator('#day-heading')).toHaveText('Monday 9 March');
    await expect(today).toHaveAttribute('aria-pressed', 'false');
    await expect(details.locator('dt')).toHaveText(['Mood', 'Note', 'Good things', 'Acts of kindness', 'Pledges kept']);
    await expect(details.locator('dd').last()).toHaveText('Join a local tree-planting or rewilding day.');

    // The calendar is a single tab stop, moved with the arrow keys.
    await lookBack.getByRole('button', { pressed: true }).focus();
    await page.keyboard.press('ArrowLeft');
    const sunday = lookBack.getByRole('button', { name: 'Sunday 8 March: Good, 1 pledge made', exact: true });
    await expect(sunday).toBeFocused();
    await expect(sunday).toHaveAttribute('tabindex', '0');
    await expect(lookBack.locator('button.calendar-day[tabindex="0"]')).toHaveCount(1);
    await expect(details.locator('dt')).toHaveText(['Mood', 'Good things', 'Acts of kindness', 'Pledges made']);
    await expect(details).toContainText('Mentor, tutor or read with a young person.');

    await page.keyboard.press('ArrowUp');
    await expect(lookBack.getByRole('button', { name: 'Sunday 1 March: nothing recorded', exact: true })).toBeFocused();
    await expect(page.locator('#day-empty')).toBeVisible();
    await expect(details).toBeHidden();

    await page.keyboard.press('PageDown');
    await expect(page.locator('#day-heading')).toHaveText('Tuesday 10 March');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#day-heading')).toHaveText('Tuesday 10 March');
    await expect(today).toBeFocused();
  });

  test('moves between months', async ({ page }) => {
    await seed(page, {
      checkins: [
        { date: '2026-01-15', mood: 3, note: 'A quiet one' },
        { date: TODAY, mood: 4, note: '' },
      ],
      gratitude: [{ id: 'g1', date: '2025-12-24', text: 'Wrapping presents' }],
      pledges: [{ id: 'p1', goal: 13, actionId: 'g13-plant-trees', text: 'Join a local tree-planting or rewilding day.', createdAt: '2026-01-20', doneAt: null }],
    });
    await page.goto('/impact.html');
    const heading = page.locator('#month-heading');
    const previous = page.getByRole('button', { name: 'Previous month' });
    const next = page.getByRole('button', { name: 'Next month' });
    await expect(previous).toHaveAttribute('aria-disabled', 'false');
    await expect(next).toHaveAttribute('aria-disabled', 'true');

    await previous.click();
    await expect(heading).toHaveText('February 2026');
    await expect(page.locator('#month-status')).toHaveText('February 2026');
    await expect(page.locator('#month-summary')).toHaveText('Nothing recorded in February 2026.');
    await expect(page.locator('#day-heading')).toHaveText('Tuesday 10 February');
    await expect(page.locator('#look-back button.calendar-day')).toHaveCount(28);
    await expect(next).toHaveAttribute('aria-disabled', 'false');

    await previous.click();
    await expect(heading).toHaveText('January 2026');
    await expect(page.locator('#month-summary')).toHaveText('In January 2026 you checked in on 1 day (average mood 3 / 5) and made 1 pledge.');
    await page.getByRole('button', { name: 'Thursday 15 January: Okay', exact: true }).click();
    await expect(page.locator('#day-list')).toContainText('A quiet one');
    const pledgeDay = page.getByRole('button', { name: 'Tuesday 20 January: 1 pledge made', exact: true });
    await expect(pledgeDay.locator('.calendar-mark')).toHaveText('•');
    await pledgeDay.click();
    await expect(page.locator('#day-list')).toContainText('Join a local tree-planting or rewilding day.');

    await previous.click();
    await expect(heading).toHaveText('December 2025');
    await expect(previous).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#month-summary')).toHaveText('In December 2025 you noted 1 good thing.');
    // aria-disabled keeps the button focusable, so pressing it must do nothing.
    await previous.click({ force: true });
    await expect(heading).toHaveText('December 2025');

    const christmasEve = page.getByRole('button', { name: /^Wednesday,? 24 December 2025: 1 good thing$/ });
    await expect(christmasEve.locator('.calendar-mark')).toHaveText('•');
    await christmasEve.click();
    await expect(page.locator('#day-list')).toContainText('Wrapping presents');

    await christmasEve.press('PageDown');
    await expect(heading).toHaveText('January 2026');
    await expect(page.getByRole('button', { name: 'Saturday 24 January: nothing recorded', exact: true })).toBeFocused();

    await next.click();
    await next.click();
    await expect(heading).toHaveText('March 2026');
    await expect(page.locator('#day-heading')).toHaveText('Tuesday 10 March');
    await expect(next).toHaveAttribute('aria-disabled', 'true');
  });

  test('can be reached from the For you page', async ({ page }) => {
    await seed(page, demoData());
    await page.goto('/you.html');
    await page.getByRole('link', { name: 'Look back at earlier days' }).click();
    await expect(page).toHaveURL(/impact\.html#look-back$/);
    await expect(page.getByRole('heading', { name: 'Look back' })).toBeInViewport();
  });
});

test('deleting everything also forgets the theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await seed(page, demoData());
  await page.goto('/impact.html');
  await page.getByRole('button', { name: 'Dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete all my data' }).click();
  expect((await savedData(page)).checkins).toHaveLength(6);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete all my data' }).click();
  await expect(page.locator('#data-status')).toHaveText('All of your Heal data has been deleted from this browser.');
  expect(await savedData(page)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('heal:theme'))).toBeNull();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  await expect(page.getByRole('button', { name: 'Dark theme' })).toHaveAttribute('aria-pressed', 'false');
  expect(await themeColour(page)).toBe('#ffffff');
  // Follows the system theme again.
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await themeColour(page)).toBe('#152226');
});
