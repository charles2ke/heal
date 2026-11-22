import { defineConfig } from '@playwright/test';

import config from './playwright.config.js';

// Retakes the pictures in the README (see tests/readme/). Kept apart from the
// tests, so running them never changes files in docs/.
export default defineConfig({
  ...config,
  testDir: './tests/readme',
  reporter: 'list',
  projects: [{ name: 'readme' }],
});
