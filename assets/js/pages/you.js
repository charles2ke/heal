import { addDays, dayLabel, formatDay, formatLongDay, lastNDays } from '../dates.js';
import { LIMITS } from '../store.js';
import { announce, el, hiddenText, startPage } from '../ui.js';
import {
  BREATHING_PATTERNS,
  LOW_MOOD,
  addGratitude,
  breathingStep,
  canCheckIn,
  checkinDays,
  checkinFor,
  gratitudeFor,
  moodFor,
  removeGratitude,
  sessionRounds,
  setCheckin,
} from '../wellbeing.js';

const checkinForm = document.getElementById('checkin-form');
const daySelect = document.getElementById('checkin-day');
const legend = document.getElementById('checkin-legend');
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
const patternDescription = document.getElementById('breathing-description');
const lengthSelect = document.getElementById('breathing-length');
const breathingToggle = document.getElementById('breathing-toggle');
const circle = document.getElementById('breath-circle');
const countLabel = document.getElementById('breath-count');
const phaseLabel = document.getElementById('breath-phase');
const cyclesLabel = document.getElementById('breath-cycles');

const moodInputs = [...checkinForm.querySelectorAll('input[name="mood"]')];

// The day being checked in for, the day the list of days to choose from was
// made on, the day the form was last filled in for, and whether it has changes
// that aren't saved yet.
let checkinDate = null;
let choicesDate = null;
let formDate = null;
let formEdited = false;

// When the day changes, "Today" moves on to the new day and starts blank. An
// earlier day stays chosen while it's still in the list, and so does a day with
// unsaved changes, so a note started just before midnight isn't lost.
function updateDayChoices(today) {
  if (choicesDate === today) return;
  const days = checkinDays(today);
  if ((checkinDate === choicesDate && !formEdited) || !days.includes(checkinDate)) checkinDate = today;
  choicesDate = today;
  daySelect.replaceChildren(...days.map((date) => el('option', { attrs: { value: date }, text: dayLabel(date, today) })));
  daySelect.value = checkinDate;
}

function fillCheckinForm(data, date) {
  const checkin = checkinFor(data, date);
  for (const input of moodInputs) input.checked = Number(input.value) === checkin?.mood;
  noteInput.value = checkin?.note ?? '';
  formDate = date;
  formEdited = false;
}

function feelingQuestion(date, today) {
  if (date === today) return 'How are you feeling today?';
  if (date === addDays(today, -1)) return 'How did you feel yesterday?';
  return `How did you feel on ${formatLongDay(date)}?`;
}

// For the middle of a sentence: "yesterday" or "Sunday 8 March".
function inSentence(date, today) {
  return date === addDays(today, -1) ? 'yesterday' : formatLongDay(date);
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
  updateDayChoices(today);
  if (formDate !== checkinDate) fillCheckinForm(data, checkinDate);
  const checkin = checkinFor(data, checkinDate);
  legend.textContent = feelingQuestion(checkinDate, today);
  checkinSubmit.textContent = checkin ? 'Update check-in' : 'Save check-in';
  nudge.hidden = !(checkin && checkin.mood <= LOW_MOOD);
  renderWeek(data, today);
  renderGratitude(data, today);
}

const page = startPage(render);

checkinForm.addEventListener('input', (event) => {
  if (event.target !== daySelect) formEdited = true;
});

daySelect.addEventListener('change', () => {
  checkinDate = daySelect.value;
  checkinStatus.textContent = '';
  page.refresh();
});

checkinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const selected = moodInputs.find((input) => input.checked);
  if (!selected) {
    announce(checkinStatus, checkinDate === page.today() ? "Choose how you're feeling first." : 'Choose how you felt first.');
    moodInputs[0].focus();
    return;
  }
  const today = page.today();
  const date = checkinDate;
  // Only reachable if the clock moves on (or back) between renders.
  if (!canCheckIn(date, today)) {
    page.refresh();
    announce(checkinStatus, 'Choose a day from the last week.');
    daySelect.focus();
    return;
  }
  const existed = Boolean(checkinFor(page.store.data, date));
  const saved = await page.update((data) => setCheckin(data, { date, mood: Number(selected.value), note: noteInput.value }));
  formEdited = false;
  if (!saved) announce(checkinStatus, "Check-in noted, but this browser can't save it.");
  else if (date !== today) {
    const day = inSentence(date, today);
    announce(checkinStatus, existed ? `Check-in for ${day} updated.` : `Check-in saved for ${day}.`);
  } else announce(checkinStatus, existed ? 'Check-in updated.' : 'Check-in saved. Thank you for taking a moment for yourself.');
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
// Rounds in this session, or 0 to keep going until Stop.
let rounds = 0;

function breathingPattern() {
  return BREATHING_PATTERNS[patternSelect.value] ?? BREATHING_PATTERNS.box;
}

function describePattern() {
  patternDescription.textContent = breathingPattern().description;
}

function roundsDone(count) {
  return count ? `Rounds completed: ${count}` : '';
}

function tick() {
  const step = breathingStep(breathingPattern(), performance.now() - startedAt);
  if (rounds && step.cycles >= rounds) {
    stopBreathing(rounds, 'Session complete. Well done.');
    return;
  }
  const phaseKey = `${step.cycles}:${step.index}`;
  if (phaseKey !== shownPhase) {
    shownPhase = phaseKey;
    circle.style.setProperty('--phase-seconds', `${step.phase.seconds}s`);
    circle.dataset.motion = step.phase.motion;
    phaseLabel.textContent = step.phase.label;
    cyclesLabel.textContent = rounds ? `Round ${step.cycles + 1} of ${rounds}` : roundsDone(step.cycles);
  }
  countLabel.textContent = String(step.secondsLeft);
}

function startBreathing() {
  rounds = sessionRounds(breathingPattern(), Number(lengthSelect.value));
  startedAt = performance.now();
  shownPhase = '';
  breathingToggle.textContent = 'Stop';
  patternSelect.disabled = true;
  lengthSelect.disabled = true;
  tick();
  timer = setInterval(tick, 200);
}

function stopBreathing(completed, message) {
  clearInterval(timer);
  timer = null;
  breathingToggle.textContent = 'Start';
  patternSelect.disabled = false;
  lengthSelect.disabled = false;
  delete circle.dataset.motion;
  countLabel.textContent = '';
  cyclesLabel.textContent = roundsDone(completed);
  phaseLabel.textContent = message;
}

breathingToggle.addEventListener('click', () => {
  if (!timer) {
    startBreathing();
    return;
  }
  const { cycles } = breathingStep(breathingPattern(), performance.now() - startedAt);
  stopBreathing(cycles, 'Well done. Press Start whenever you need another moment.');
});
patternSelect.addEventListener('change', describePattern);
describePattern();
