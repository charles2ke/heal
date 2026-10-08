import { KINDNESS_IDEAS } from '../data/kindness-ideas.js';
import { formatDay } from '../dates.js';
import { hasDoneIdea, ideaIndexForDay } from '../kindness.js';
import { el, startPage } from '../ui.js';
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

startPage(render);
