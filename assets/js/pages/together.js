import { KINDNESS_IDEAS } from '../data/kindness-ideas.js';
import { formatDay } from '../dates.js';
import { hasDoneIdea, ideaIndexForDay, kindnessStats, logAct, recentActs, removeAct } from '../kindness.js';
import { announce, el, hiddenText, startPage } from '../ui.js';

const ideaText = document.getElementById('idea-text');
const doneButton = document.getElementById('idea-done');
const nextButton = document.getElementById('idea-next');
const ideaStatus = document.getElementById('idea-status');
const actForm = document.getElementById('act-form');
const actInput = document.getElementById('act-text');
const actStatus = document.getElementById('act-status');
const statsList = document.getElementById('kindness-stats');
const recentHeading = document.getElementById('recent-heading');
const recentList = document.getElementById('recent-acts');
const recentEmpty = document.getElementById('recent-empty');

// How many ideas past today's the reader has skipped, and for which day.
let offset = 0;
let offsetDay = null;

function shownIdea(today) {
  if (offsetDay !== today) {
    offset = 0;
    offsetDay = today;
  }
  return KINDNESS_IDEAS[(ideaIndexForDay(today) + offset) % KINDNESS_IDEAS.length];
}

function renderIdea(data, today) {
  const idea = shownIdea(today);
  // Only touch the live region when the idea really changes.
  if (ideaText.textContent !== idea.text) ideaText.textContent = idea.text;
  const done = hasDoneIdea(data, today, idea.id);
  doneButton.replaceChildren(...(done ? [el('span', { attrs: { 'aria-hidden': 'true' }, text: '✓ ' }), 'Done today'] : ['I did it']));
  doneButton.setAttribute('aria-disabled', String(done));
}

function renderStats(data, today) {
  const stats = kindnessStats(data, today);
  const rows = [
    ['Today', stats.today],
    ['Last 7 days', stats.week],
    ['Day streak', stats.streak],
    ['All time', stats.total],
  ];
  statsList.replaceChildren(
    ...rows.map(([label, value]) => el('div', { className: 'stat' }, el('dt', { text: label }), el('dd', { text: String(value) }))),
  );
}

function renderRecent(data, today) {
  const acts = recentActs(data, 10);
  recentList.replaceChildren(
    ...acts.map((act) =>
      el(
        'li',
        { className: 'entry' },
        el('span', { className: 'entry-date', text: act.date === today ? 'Today' : formatDay(act.date) }),
        el('span', { className: 'entry-text', text: act.text }),
        el(
          'button',
          { className: 'link-button', attrs: { type: 'button' }, on: { click: () => removeLogged(act.id) } },
          'Remove',
          hiddenText(` “${act.text}”`),
        ),
      ),
    ),
  );
  recentEmpty.hidden = acts.length > 0;
}

function render(store, today) {
  renderIdea(store.data, today);
  renderStats(store.data, today);
  renderRecent(store.data, today);
}

const page = startPage(render);

// Logs an act and reports whether it was new and whether it was saved.
async function log(entry) {
  let logged = false;
  const saved = await page.update((data) => {
    const next = logAct(data, entry);
    logged = next !== data;
    return next;
  });
  return { logged, saved };
}

doneButton.addEventListener('click', async () => {
  const today = page.today();
  const idea = shownIdea(today);
  const { logged, saved } = await log({ date: today, ideaId: idea.id, text: idea.text });
  if (!logged) announce(ideaStatus, "You've already logged this one today. Thank you!");
  else if (!saved) announce(ideaStatus, "Logged, but this browser can't save it.");
  else announce(ideaStatus, 'Logged. Thank you for making the world a little kinder.');
});

nextButton.addEventListener('click', () => {
  shownIdea(page.today());
  offset = (offset + 1) % KINDNESS_IDEAS.length;
  ideaStatus.textContent = '';
  renderIdea(page.store.data, page.today());
});

actForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!actInput.value.trim()) {
    announce(actStatus, 'Write what you did first.');
    actInput.focus();
    return;
  }
  const { saved } = await log({ date: page.today(), text: actInput.value });
  actInput.value = '';
  announce(actStatus, saved ? 'Logged. Every act counts.' : "Logged, but this browser can't save it.");
});

async function removeLogged(id) {
  await page.update((data) => removeAct(data, id));
  announce(actStatus, 'Removed.');
  recentHeading.focus();
}
