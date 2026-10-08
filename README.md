# heal
Heal the world, make it a better place, for you and me and the entire human race. 

Heal turns that mission into small, steady, private actions, in four feature sets:

| Feature set | Page | What you can do |
|---|---|---|
| **For you** | `you.html` | Check in with your mood each day, note three good things and follow a guided breathing exercise. Low days point you to free support. |
| **For each other** | `together.html` | Get an act-of-kindness idea each day, log your own kind acts and keep a streak going. |
| **For everyone** | `world.html` | Browse practical actions for the 17 UN Global Goals, search and filter them, pledge the ones you'll do and mark them done. |
| **Your impact** | `impact.html` | See what your small steps add up to, and export, import or delete all of your data. |

## Privacy

Heal has no accounts, no analytics and no tracking. Everything stays in your browser's local storage, and you can export or delete it at any time from **Your impact**.

Heal is a self-care companion, not a medical or crisis service. If you or someone else is in immediate danger, call your local emergency number.

## Run it locally

Heal is a static site with no build step. Serve the folder over HTTP (browsers won't load its JavaScript modules from `file://`):

```sh
npm start   # needs Python 3; serves http://127.0.0.1:4173
```

## Test it

```sh
npm ci
npx playwright install chromium   # first time only
npm test                          # unit tests (Node's built-in test runner)
npm run test:e2e                  # Playwright tests on desktop Chrome and Pixel 7
```

The Playwright run starts its own server and saves full-page screenshots of every page, in light and dark themes, to `screenshots/`. On each pull request, CI runs both test suites and comments with links to the screenshots and the Playwright report.

## Licence

[GNU AGPL v3.0](LICENSE)
