import { readFile } from 'node:fs/promises';

import { TODAY, demoData, expect, savedData, seed, test } from './fixtures.js';

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
  await expect(card(page, 'Acts of kindness').locator('.stat-detail')).toHaveText('3 in the last 7 days, 2 days in a row');
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

test('asks before replacing data, and rejects files that are not Heal exports', async ({ page }) => {
  await seed(page, demoData());
  await page.goto('/impact.html');
  const input = page.locator('#import-file');

  await input.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.locator('#data-status')).toHaveText("That file isn't valid JSON, so it can't be a Heal export.");

  await input.setInputFiles({ name: 'other.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"other","data":{}}') });
  await expect(page.locator('#data-status')).toHaveText("That file isn't a Heal export.");

  const replacement = { app: 'heal', version: 1, data: { checkins: [{ date: TODAY, mood: 1 }, { date: 'nope', mood: 1 }] } };
  page.once('dialog', (dialog) => dialog.dismiss());
  await input.setInputFiles({ name: 'heal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) });
  await expect(page.locator('#data-status')).toHaveText('Import cancelled. Nothing was changed.');
  expect((await savedData(page)).checkins).toHaveLength(6);

  page.once('dialog', (dialog) => dialog.accept());
  await input.setInputFiles({ name: 'heal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) });
  await expect(page.locator('#data-status')).toHaveText('Imported 1 entry. 1 entry was skipped because it was invalid or repeated.');
  expect((await savedData(page)).checkins).toEqual([{ date: TODAY, mood: 1, note: '' }]);
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
});
