// Draws Heal's app icons from assets/icon.svg with Playwright's Chromium.
// Run it with `npm run icons` after changing the icon, then `npm run sw:version`.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from '@playwright/test';

import { ROOT } from './sw-version.js';

const icon = readFileSync(join(ROOT, 'assets/icon.svg'), 'utf8');
// Platforms crop maskable and Apple icons to their own shape, so these fill the
// whole square. The heart stays well inside the central safe zone.
const fullBleed = icon.replace(/<circle [^>]*\/>/, '<rect width="64" height="64" fill="#0f766e"/>');
if (fullBleed === icon) throw new Error('assets/icon.svg no longer starts with a circle: update scripts/make-icons.js.');

const ICONS = [
  { file: 'icon-192.png', size: 192, svg: icon },
  { file: 'icon-512.png', size: 512, svg: icon },
  { file: 'icon-maskable-512.png', size: 512, svg: fullBleed },
  // iOS turns transparent corners black.
  { file: 'apple-touch-icon.png', size: 180, svg: fullBleed },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const { file, size, svg } of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html, body { margin: 0 } svg { display: block; width: ${size}px; height: ${size}px }</style>${svg}`);
    writeFileSync(join(ROOT, 'assets/icons', file), await page.screenshot({ omitBackground: true }));
    console.log(`Drew assets/icons/${file}`);
  }
} finally {
  await browser.close();
}
