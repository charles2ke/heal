import { precacheList } from '../../scripts/sw-version.js';
import { expect, savedData, test } from './fixtures.js';

const READY = 'Heal is saved in this browser, so it works offline too.';

// Waits until Heal is saved for offline use and its service worker is in charge of the page.
async function saveForOffline(page) {
  await page.goto('/index.html');
  await expect(page.getByText(READY)).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

// Pretends the browser has decided Heal can be installed, as Chrome and Edge do.
async function offerInstall(page, outcome) {
  await page.evaluate((choice) => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => {
      globalThis.promptCount = (globalThis.promptCount ?? 0) + 1;
    };
    event.userChoice = Promise.resolve({ outcome: choice });
    globalThis.dispatchEvent(event);
  }, outcome);
}

test.describe('offline', () => {
  test('saves every page, script and style', async ({ page }) => {
    await saveForOffline(page);
    const saved = await page.evaluate(async () => {
      const names = (await caches.keys()).filter((name) => name.startsWith('heal-'));
      const cache = await caches.open(names[0]);
      return { names, paths: (await cache.keys()).map((request) => new URL(request.url).pathname.slice(1)).sort() };
    });
    expect(saved.names).toHaveLength(1);
    expect(saved.paths).toEqual(precacheList());
  });

  test('every page works without a connection, and still saves what you enter', async ({ page, context, consoleErrors }) => {
    await saveForOffline(page);
    // Empties the browser's ordinary cache, so pages can only come from Heal's saved copy.
    await (await context.newCDPSession(page)).send('Network.clearBrowserCache');
    await context.setOffline(true);

    // Something Heal hasn't saved fails, rather than the server saying it isn't
    // there, which shows the service worker's connection really is gone too.
    const unsaved = await page.evaluate(() => fetch('/nowhere.html').then((response) => response.status, () => 'failed'));
    expect(unsaved).toBe('failed');
    // The browser logs that failure, which is expected here.
    await expect.poll(() => consoleErrors.length).toBe(1);
    expect(consoleErrors.splice(0)).toEqual(['Failed to load resource: net::ERR_FAILED']);

    for (const [path, heading] of [
      ['/index.html', 'Heal'],
      ['/you.html', 'For you'],
      ['/together.html', 'For each other'],
      ['/world.html?goal=13', 'For everyone'],
      ['/impact.html', 'Your impact'],
      ['/', 'Heal'],
    ]) {
      const response = await page.goto(path);
      expect(response.fromServiceWorker(), path).toBe(true);
      await expect(page.getByRole('heading', { level: 1, name: heading }), path).toBeVisible();
    }

    await page.goto('/you.html');
    await page.locator('.mood-options label', { hasText: 'Good' }).click();
    await page.getByRole('button', { name: 'Save check-in' }).click();
    await expect(page.locator('#checkin-status')).toContainText('Check-in saved');
    expect((await savedData(page)).checkins).toHaveLength(1);
  });
});

test.describe('installing', () => {
  test('explains how to install where the browser offers no button', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.getByRole('heading', { name: 'Use Heal like an app' })).toBeVisible();
    await expect(page.getByText('No Install button?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Install Heal' })).toBeHidden();
    await expect(page.getByText('the app keeps its own data')).toBeVisible();
  });

  test('offers an Install button when the browser can install Heal', async ({ page }) => {
    await page.goto('/index.html');
    await offerInstall(page, 'accepted');
    const install = page.getByRole('button', { name: 'Install Heal' });
    await expect(install).toBeVisible();
    await expect(page.getByText('No Install button?')).toBeHidden();

    await install.click();
    await expect(install).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Use Heal like an app' })).toBeFocused();
    expect(await page.evaluate(() => globalThis.promptCount)).toBe(1);

    await page.evaluate(() => globalThis.dispatchEvent(new Event('appinstalled')));
    await expect(page.locator('#install-status')).toHaveText('Heal is installed. You can open it from your home screen or apps.');
    await expect(page.getByText('No Install button?')).toBeHidden();
  });

  test('says so if you decide not to install', async ({ page }) => {
    await page.goto('/index.html');
    await offerInstall(page, 'dismissed');
    await page.getByRole('button', { name: 'Install Heal' }).click();
    await expect(page.locator('#install-status')).toHaveText("Heal wasn't installed. You can still install it from your browser's menu.");
    await expect(page.getByRole('button', { name: 'Install Heal' })).toBeHidden();
    await expect(page.getByText('No Install button?')).toBeVisible();
  });

  test('is not offered inside the installed app', async ({ page }) => {
    // How Safari says a page is open from the home screen.
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }));
    await page.goto('/index.html');
    await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Use Heal like an app' })).toBeHidden();
  });
});
