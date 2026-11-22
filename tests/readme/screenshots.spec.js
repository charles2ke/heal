import { devices, expect, test } from '@playwright/test';

import { NOW, demoData, seed } from '../e2e/fixtures.js';

// The pictures in the README, saved to docs/images/: the home page in a
// browser window beside a phone, and each feature set on a phone, in light and
// dark themes, with the tests' demo data. Run with `npm run readme:screenshots`.

const OUT = 'docs/images';
const ADDRESS = 'charles2ke.github.io/heal';
const FEATURES = ['you', 'together', 'world', 'impact'];

// Twice the pixels, so the pictures stay sharp on high-resolution screens.
const SCALE = 2;
const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: SCALE };
const PHONE = { ...devices['Pixel 7'], deviceScaleFactor: SCALE };

// The browser window and phone drawn around the screenshots, in Heal's colours.
const FRAME = {
  light: { bar: '#e3ebe8', address: '#ffffff', text: '#4b5e63', edge: 'rgb(23 37 42 / 0.14)', phone: '#17252a' },
  dark: { bar: '#1c2d32', address: '#0e1719', text: '#a8bbb8', edge: 'rgb(231 240 238 / 0.2)', phone: '#3b5157' },
};

const STYLE = `
  html, body { margin: 0; background: transparent; }
  #stage { position: relative; display: inline-block; padding: 24px 32px 56px; }
  .window, .phone { box-shadow: 0 0 0 1px var(--edge), 0 16px 32px rgb(0 0 0 / 0.2); }
  .window { width: 1000px; margin-right: 170px; border-radius: 12px; overflow: hidden; background: var(--bar); }
  .bar { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 16px; }
  .bar i { width: 12px; height: 12px; border-radius: 50%; background: #ff5f57; }
  .bar i + i { background: #febc2e; }
  .bar i + i + i { background: #28c840; }
  .bar span { flex: 0 1 420px; margin-left: 16px; padding: 5px 14px; border-radius: 999px; background: var(--address); color: var(--text); font: 14px/1.3 system-ui, sans-serif; }
  .phone { width: 240px; padding: 10px; border-radius: 40px; background: var(--phone); }
  .window + .phone { position: absolute; right: 32px; bottom: 32px; }
  img { display: block; width: 100%; }
  .phone img { border-radius: 30px; }
`;

const browserWindow = (src) => `<div class="window"><div class="bar"><i></i><i></i><i></i><span>${ADDRESS}</span></div><img src="${src}" alt=""></div>`;
const phone = (src) => `<div class="phone"><img src="${src}" alt=""></div>`;

// What fits on the screen, as a data: URL.
async function capture({ browser, baseURL, locale, timezoneId }, device, theme, name) {
  const context = await browser.newContext({ ...device, baseURL, locale, timezoneId, colorScheme: theme, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  await seed(page, demoData());
  await page.goto(`/${name}.html`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const png = await page.screenshot();
  await context.close();
  return `data:image/png;base64,${png.toString('base64')}`;
}

for (const theme of ['light', 'dark']) {
  test(`README pictures (${theme})`, async ({ browser, baseURL, locale, timezoneId }) => {
    const shot = (device, name) => capture({ browser, baseURL, locale, timezoneId }, device, theme, name);
    const colours = Object.entries(FRAME[theme]).map(([name, value]) => `--${name}: ${value}`).join('; ');

    const context = await browser.newContext({ deviceScaleFactor: SCALE });
    const page = await context.newPage();
    const save = async (html, name) => {
      await page.setContent(`<!doctype html><style>${STYLE}</style><div id="stage" style="${colours}">${html}</div>`);
      await page.locator('#stage').screenshot({ path: `${OUT}/${name}-${theme}.png`, omitBackground: true });
    };

    await save(browserWindow(await shot(DESKTOP, 'index')) + phone(await shot(PHONE, 'index')), 'home');
    for (const name of FEATURES) await save(phone(await shot(PHONE, name)), name);
    await context.close();
  });
}
