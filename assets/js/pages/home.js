import { KINDNESS_IDEAS } from '../data/kindness-ideas.js';
import { formatDay } from '../dates.js';
import { hasDoneIdea, ideaIndexForDay } from '../kindness.js';
import { isStandalone, offlineReady } from '../pwa.js';
import { announce, el, startPage } from '../ui.js';
import { checkinFor, moodFor } from '../wellbeing.js';

const dateLine = document.getElementById('today-date');
const grid = document.getElementById('today-grid');

function tile(title, body, link) {
  return el(
    'li',
    { className: 'tile' },
    el('h3', { text: title }),
    ...body,
    el('a', { className: 'tile-link', attrs: { href: link.href }, text: link.text }),
  );
}

function render(store, today) {
  const { data } = store;
  dateLine.textContent = formatDay(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const checkin = checkinFor(data, today);
  const mood = checkin ? moodFor(checkin.mood) : null;
  const idea = KINDNESS_IDEAS[ideaIndexForDay(today)];
  const ideaDone = hasDoneIdea(data, today, idea.id);
  const active = data.pledges.filter((pledge) => !pledge.doneAt).length;
  const done = data.pledges.length - active;

  grid.replaceChildren(
    tile(
      'How you feel',
      mood
        ? [el('p', { className: 'tile-value' }, el('span', { attrs: { 'aria-hidden': 'true' }, text: `${mood.emoji} ` }), mood.label)]
        : [el('p', { text: "You haven't checked in yet today." })],
      { href: 'you.html#checkin', text: mood ? 'Update your check-in' : 'Check in now' },
    ),
    tile(
      "Today's act of kindness",
      [
        el('p', { text: idea.text }),
        ideaDone ? el('p', { className: 'done' }, el('span', { attrs: { 'aria-hidden': 'true' }, text: '✓ ' }), 'Done today') : null,
      ],
      { href: 'together.html', text: ideaDone ? 'See your kindness' : 'Try it today' },
    ),
    tile(
      'Your pledges',
      [el('p', { text: data.pledges.length ? `${active} in progress, ${done} done` : "You haven't made a pledge yet." })],
      data.pledges.length ? { href: 'world.html#my-pledges', text: 'See your pledges' } : { href: 'world.html', text: 'Make a pledge' },
    ),
  );
}

// Offers to install Heal where the browser allows it. Elsewhere, the hint
// explains how to do it from the browser's menu.
function setupInstall() {
  const section = document.getElementById('install');
  const heading = document.getElementById('install-heading');
  const actions = document.getElementById('install-actions');
  const button = document.getElementById('install-button');
  const hint = document.getElementById('install-hint');
  const status = document.getElementById('install-status');
  let installPrompt = null;

  // Already open as an app, so there's nothing to install.
  if (isStandalone()) {
    section.hidden = true;
    return;
  }

  offlineReady().then(() => {
    document.getElementById('offline-status').hidden = false;
  });

  const hideButton = () => {
    installPrompt = null;
    // Keeps keyboard focus in the section rather than losing it with the button.
    if (actions.contains(document.activeElement)) heading.focus();
    actions.hidden = true;
  };

  globalThis.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    actions.hidden = false;
    hint.hidden = true;
  });

  button.addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    let outcome = 'dismissed';
    try {
      await prompt.prompt();
      ({ outcome } = await prompt.userChoice);
    } catch {
      // The browser can show each prompt only once.
    }
    hideButton();
    if (outcome !== 'accepted') {
      hint.hidden = false;
      announce(status, "Heal wasn't installed. You can still install it from your browser's menu.");
    }
  });

  globalThis.addEventListener('appinstalled', () => {
    hideButton();
    hint.hidden = true;
    announce(status, 'Heal is installed. You can open it from your home screen or apps.');
  });
}

setupInstall();
startPage(render);
