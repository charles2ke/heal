import { ACTION_TYPES, GOALS, goalUrl } from '../data/goals.js';
import { formatDay } from '../dates.js';
import { announce, el, externalLink, hiddenText, startPage } from '../ui.js';
import {
  addPledge,
  canPledge,
  filterGoals,
  filtersToSearch,
  normalizeFilters,
  parseFilters,
  pledgeFor,
  removePledge,
  setPledgeDone,
} from '../world.js';

const filtersForm = document.getElementById('filters');
const searchInput = document.getElementById('search');
const typeSelect = document.getElementById('type');
const clearButton = document.getElementById('clear-filters');
const resultsCount = document.getElementById('results-count');
const goalList = document.getElementById('goal-list');
const pledgesHeading = document.getElementById('pledges-heading');
const pledgesSummary = document.getElementById('pledges-summary');
const pledgeList = document.getElementById('pledge-list');
const pledgesEmpty = document.getElementById('pledges-empty');

// A quiet live region for pledge changes, which happen far from "My pledges".
const pledgeStatus = el('p', { className: 'visually-hidden', attrs: { role: 'status' } });
document.getElementById('goals').append(pledgeStatus);

let filters = parseFilters(globalThis.location.search);
searchInput.value = filters.query;
typeSelect.value = filters.type;

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

function syncPledgeButtons(data) {
  for (const button of goalList.querySelectorAll('button[data-action]')) {
    button.setAttribute('aria-pressed', String(Boolean(pledgeFor(data, button.dataset.action))));
  }
}

function renderGoals(data) {
  const results = filterGoals(filters);
  goalList.replaceChildren(
    ...results.map(({ goal, actions }) =>
      el(
        'li',
        { className: 'goal', attrs: { id: `goal-${goal.number}` } },
        el(
          'div',
          { className: 'goal-head' },
          el('span', { className: 'goal-number', attrs: { 'aria-hidden': 'true' }, text: String(goal.number) }),
          el('h3', {}, hiddenText(`Goal ${goal.number}: `), goal.name),
        ),
        el('p', { className: 'goal-summary', text: goal.summary }),
        el(
          'ul',
          { className: 'actions' },
          ...actions.map((action) =>
            el(
              'li',
              { className: 'action' },
              el('span', { className: `tag tag-${action.type}`, text: ACTION_TYPES[action.type] }),
              el('p', { className: 'action-text', text: action.text }),
              el(
                'button',
                {
                  className: 'pledge-button',
                  attrs: { type: 'button', 'aria-pressed': 'false', 'data-action': action.id },
                  on: { click: () => togglePledge(goal, action) },
                },
                el('span', { className: 'check', attrs: { 'aria-hidden': 'true' }, text: '✓ ' }),
                'Pledge',
                hiddenText(`: ${action.text}`),
              ),
            ),
          ),
        ),
        externalLink(goalUrl(goal.number), `Learn more about Goal ${goal.number} from the UN`, 'goal-link'),
      ),
    ),
  );
  syncPledgeButtons(data);
  const count = results.reduce((total, result) => total + result.actions.length, 0);
  resultsCount.textContent = count
    ? `Showing ${plural(count, 'action', 'actions')} across ${plural(results.length, 'goal', 'goals')}.`
    : 'No actions match. Try another word or type of action.';
}

function renderPledges(data) {
  // Re-rendering replaces the checkboxes, so keep focus on the same one.
  const focusedId = pledgeList.contains(document.activeElement) ? document.activeElement.id : '';
  pledgeList.replaceChildren(
    ...data.pledges.map((pledge) => {
      const goal = GOALS.find((item) => item.number === pledge.goal);
      const checkboxId = `pledge-${pledge.id}`;
      const meta = `Goal ${pledge.goal}: ${goal?.name ?? ''}`;
      return el(
        'li',
        { className: pledge.doneAt ? 'pledge done' : 'pledge' },
        el('input', {
          attrs: { type: 'checkbox', id: checkboxId, checked: Boolean(pledge.doneAt) },
          on: { change: (event) => markDone(pledge.id, event.target.checked) },
        }),
        el(
          'div',
          { className: 'pledge-body' },
          el('label', { attrs: { for: checkboxId }, text: pledge.text }),
          el('span', { className: 'pledge-meta', text: pledge.doneAt ? `${meta} · done ${formatDay(pledge.doneAt)}` : meta }),
        ),
        el(
          'button',
          { className: 'link-button', attrs: { type: 'button' }, on: { click: () => unpledge(pledge.id) } },
          'Remove',
          hiddenText(`: ${pledge.text}`),
        ),
      );
    }),
  );
  if (focusedId) document.getElementById(focusedId)?.focus();

  const done = data.pledges.filter((pledge) => pledge.doneAt).length;
  const active = data.pledges.length - done;
  pledgesEmpty.hidden = data.pledges.length > 0;
  pledgesSummary.hidden = data.pledges.length === 0;
  pledgesSummary.textContent = `${active} in progress, ${done} done. Tick a pledge when you've done it.`;
}

function render(store) {
  renderPledges(store.data);
  // Rebuilding the goal list would move focus off the button just pressed.
  if (goalList.childElementCount) syncPledgeButtons(store.data);
  else renderGoals(store.data);
}

const page = startPage(render);

function togglePledge(goal, action) {
  const existing = pledgeFor(page.store.data, action.id);
  if (existing) {
    page.update((data) => {
      const pledge = pledgeFor(data, action.id);
      return pledge ? removePledge(data, pledge.id) : data;
    });
    announce(pledgeStatus, 'Pledge removed.');
    return;
  }
  if (!canPledge(page.store.data)) {
    announce(pledgeStatus, 'You have reached the limit of 200 pledges. Remove one before adding another.');
    return;
  }
  const saved = page.update((data) => addPledge(data, { goal, action, date: page.today() }));
  announce(pledgeStatus, saved ? 'Pledged. You can find it under My pledges.' : "Pledged, but this browser can't save it.");
}

function markDone(id, done) {
  page.update((data) => setPledgeDone(data, id, done ? page.today() : null));
  announce(pledgeStatus, done ? 'Marked as done. Well done!' : 'Marked as not done yet.');
}

function unpledge(id) {
  page.update((data) => removePledge(data, id));
  announce(pledgeStatus, 'Pledge removed.');
  pledgesHeading.focus();
}

function applyFilters() {
  filters = normalizeFilters({ query: searchInput.value, type: typeSelect.value });
  const url = new URL(globalThis.location.href);
  url.search = filtersToSearch(filters);
  globalThis.history.replaceState(null, '', url);
  renderGoals(page.store.data);
}

searchInput.addEventListener('input', applyFilters);
typeSelect.addEventListener('change', applyFilters);
filtersForm.addEventListener('submit', (event) => {
  event.preventDefault();
  applyFilters();
});
clearButton.addEventListener('click', () => {
  searchInput.value = '';
  typeSelect.value = 'all';
  applyFilters();
  searchInput.focus();
});
