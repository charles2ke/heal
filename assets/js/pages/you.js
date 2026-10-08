import { formatDay, lastNDays } from '../dates.js';
import { LIMITS } from '../store.js';
import { announce, el, hiddenText, startPage } from '../ui.js';
import {
  BREATHING_PATTERNS,
  LOW_MOOD,
  addGratitude,
  breathingStep,
  checkinFor,
  gratitudeFor,
  moodFor,
  removeGratitude,
  setCheckin,
} from '../wellbeing.js';

const checkinForm = document.getElementById('checkin-form');
const noteInput = document.getElementById('checkin-note');
const checkinSubmit = document.getElementById('checkin-submit');
const checkinStatus = document.getElementById('checkin-status');
const nudge = document.getElementById('support-nudge');
const weekList = document.getElementById('mood-week');

const gratitudeForm = document.getElementById('gratitude-form');
const gratitudeInput = document.getElementById('gratitude-text');
const gratitudeSubmit = document.getElementById('gratitude-submit');
const gratitudeStatus = document.getElementById('gratitude-status');
const gratitudeHeading = document.getElementById('gratitude-list-heading');
const gratitudeList = document.getElementById('gratitude-list');
const gratitudeEmpty = document.getElementById('gratitude-empty');

const patternSelect = document.getElementById('breathing-pattern');
const breathingToggle = document.getElementById('breathing-toggle');
const circle = document.getElementById('breath-circle');
const countLabel = document.getElementById('breath-count');
const phaseLabel = document.getElementById('breath-phase');
const cyclesLabel = document.getElementById('breath-cycles');

const moodInputs = [...checkinForm.querySelectorAll('input[name="mood"]')];

// The day the check-in form was filled in for, so a new day starts blank.
let formDate = null;

function fillCheckinForm(data, today) {
  const checkin = checkinFor(data, today);
  for (const input of moodInputs) input.checked = Number(input.value) === checkin?.mood;
  noteInput.value = checkin?.note ?? '';
  formDate = today;
}

function renderWeek(data, today) {
  weekList.replaceChildren(
    ...lastNDays(7, today).map((date) => {
      const mood = moodFor(checkinFor(data, date)?.mood);
      const isToday = date === today;
      // Today keeps its short day name so the strip fits a 320px screen, and is marked instead.
      return el(
        'li',
        { className: mood ? `day mood-${mood.value}` : 'day', attrs: { 'aria-current': isToday && 'date' } },
        el('span', { className: 'day-name', text: formatDay(date, { weekday: 'short' }) }, isToday && hiddenText(' (today)')),
        el('span', { className: 'day-mood', attrs: { 'aria-hidden': 'true' }, text: mood ? mood.emoji : '–' }),
        hiddenText(mood ? `: ${mood.label}` : ': no check-in'),
      );
    }),
  );
}

function renderGratitude(data, today) {
  const entries = gratitudeFor(data, today);
  gratitudeList.replaceChildren(
    ...entries.map((entry) =>
      el(
        'li',
        { className: 'entry' },
        el('span', { className: 'entry-text', text: entry.text }),
        el(
          'button',
          { className: 'link-button', attrs: { type: 'button' }, on: { click: () => removeEntry(entry.id) } },
          'Remove',
          hiddenText(` “${entry.text}”`),
        ),
      ),
    ),
  );
  gratitudeEmpty.hidden = entries.length > 0;
  const full = entries.length >= LIMITS.gratitudePerDay;
  gratitudeInput.disabled = full;
  gratitudeSubmit.disabled = full;
  gratitudeInput.placeholder = full ? "That's three good things today. Come back tomorrow!" : '';
}

function render(store, today) {
  const { data } = store;
  if (formDate !== today) fillCheckinForm(data, today);
  const checkin = checkinFor(data, today);
  checkinSubmit.textContent = checkin ? 'Update check-in' : 'Save check-in';
  nudge.hidden = !(checkin && checkin.mood <= LOW_MOOD);
  renderWeek(data, today);
  renderGratitude(data, today);
}

const page = startPage(render);

checkinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const selected = moodInputs.find((input) => input.checked);
  if (!selected) {
    announce(checkinStatus, "Choose how you're feeling first.");
    moodInputs[0].focus();
    return;
  }
  const today = page.today();
  const existed = Boolean(checkinFor(page.store.data, today));
  const saved = await page.update((data) => setCheckin(data, { date: today, mood: Number(selected.value), note: noteInput.value }));
  if (!saved) announce(checkinStatus, "Check-in noted, but this browser can't save it.");
  else announce(checkinStatus, existed ? 'Check-in updated.' : 'Check-in saved. Thank you for taking a moment for yourself.');
});

async function removeEntry(id) {
  await page.update((data) => removeGratitude(data, id));
  announce(gratitudeStatus, 'Removed.');
  gratitudeHeading.focus();
}

gratitudeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = gratitudeInput.value;
  if (!text.trim()) {
    announce(gratitudeStatus, 'Write something good first, however small.');
    gratitudeInput.focus();
    return;
  }
  const today = page.today();
  let added = false;
  const saved = await page.update((data) => {
    const next = addGratitude(data, { date: today, text });
    added = next !== data;
    return next;
  });
  if (!added) {
    announce(gratitudeStatus, "You've already noted three good things today.");
    return;
  }
  gratitudeInput.value = '';
  // The form is disabled once today's three are in, so move focus to the list.
  const full = gratitudeInput.disabled;
  if (!saved) announce(gratitudeStatus, "Added, but this browser can't save it.");
  else announce(gratitudeStatus, full ? "Added. That's your three good things for today." : 'Added.');
  if (full) gratitudeHeading.focus();
});

// Breathing. Each phase is worked out from the time since Start, so a slow or
// throttled timer never makes the guide drift.
let timer = null;
let startedAt = 0;
let shownPhase = '';

function breathingPattern() {
  return BREATHING_PATTERNS[patternSelect.value] ?? BREATHING_PATTERNS.box;
}

function tick() {
  const step = breathingStep(breathingPattern(), performance.now() - startedAt);
  const phaseKey = `${step.cycles}:${step.index}`;
  if (phaseKey !== shownPhase) {
    shownPhase = phaseKey;
    circle.style.setProperty('--phase-seconds', `${step.phase.seconds}s`);
    circle.dataset.motion = step.phase.motion;
    phaseLabel.textContent = step.phase.label;
    cyclesLabel.textContent = step.cycles ? `Rounds completed: ${step.cycles}` : '';
  }
  countLabel.textContent = String(step.secondsLeft);
}

function startBreathing() {
  startedAt = performance.now();
  shownPhase = '';
  breathingToggle.textContent = 'Stop';
  patternSelect.disabled = true;
  tick();
  timer = setInterval(tick, 200);
}

function stopBreathing() {
  clearInterval(timer);
  timer = null;
  breathingToggle.textContent = 'Start';
  patternSelect.disabled = false;
  delete circle.dataset.motion;
  countLabel.textContent = '';
  phaseLabel.textContent = 'Well done. Press Start whenever you need another moment.';
}

breathingToggle.addEventListener('click', () => (timer ? stopBreathing() : startBreathing()));
