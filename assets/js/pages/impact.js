import { addDays, formatDay, formatMonth, monthOf } from '../dates.js';
import { calendarMove, dayDetails, isEmptyDay, monthRange, monthView } from '../history.js';
import {
  MAX_IMPORT_BYTES,
  csvFilename,
  exportFilename,
  exportPayload,
  hasAnyData,
  mergeData,
  parseImport,
  summarize,
  toCsv,
} from '../impact.js';
import { countEntries } from '../store.js';
import { forgetTheme } from '../theme.js';
import { announce, el, hiddenText, startPage } from '../ui.js';
import { moodFor } from '../wellbeing.js';

const statGrid = document.getElementById('stat-grid');
const weekBody = document.getElementById('week-body');

const monthHeading = document.getElementById('month-heading');
const monthPrev = document.getElementById('month-prev');
const monthNext = document.getElementById('month-next');
const monthStatus = document.getElementById('month-status');
const monthSummary = document.getElementById('month-summary');
const calendarDays = document.getElementById('calendar-days');
const calendarBody = document.getElementById('calendar-body');
const dayHeading = document.getElementById('day-heading');
const dayEmpty = document.getElementById('day-empty');
const dayList = document.getElementById('day-list');

const exportButton = document.getElementById('export-data');
const csvButton = document.getElementById('export-csv');
const importButton = document.getElementById('import-data');
const importInput = document.getElementById('import-file');
const deleteButton = document.getElementById('delete-data');
const dataStatus = document.getElementById('data-status');
const importDialog = document.getElementById('import-dialog');
const importDialogText = document.getElementById('import-dialog-text');

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

// "a", "a and b", "a, b and c"
function listing(parts) {
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : (parts[0] ?? '');
}

function statCard(label, value, detail) {
  return el(
    'li',
    { className: 'stat-card' },
    el('p', { className: 'stat-label', text: label }),
    el('p', { className: 'stat-value', text: String(value) }),
    el('p', { className: 'stat-detail', text: detail }),
  );
}

function streakCard(label, streak, longest, start) {
  return statCard(label, plural(streak, 'day', 'days'), longest ? `Longest: ${plural(longest, 'day', 'days')}` : start);
}

function renderStats(summary) {
  const { checkins, gratitude, kindness, pledges } = summary;
  const averageMood = checkins.averageMood === null ? null : moodFor(Math.round(checkins.averageMood));

  statGrid.replaceChildren(
    statCard('Days checked in', checkins.total, `${checkins.week} in the last 7 days`),
    streakCard('Check-in streak', checkins.streak, checkins.longest, 'Check in today to start one'),
    statCard(
      'Average mood this week',
      averageMood ? `${checkins.averageMood} / 5` : '–',
      averageMood ? `Mostly ${averageMood.label.toLowerCase()}` : 'Check in to see your week',
    ),
    statCard('Good things noted', gratitude.total, `${gratitude.week} in the last 7 days`),
    statCard('Acts of kindness', kindness.total, `${kindness.week} in the last 7 days`),
    streakCard('Kindness streak', kindness.streak, kindness.longest, 'Do something kind to start one'),
    statCard('Pledges kept', pledges.done, `${pledges.active} still in progress`),
    statCard('Global Goals you are helping', `${pledges.goals} of 17`, pledges.goals ? 'Thank you' : 'Make a pledge to start'),
  );
}

function renderWeek(summary, today) {
  weekBody.replaceChildren(
    ...summary.days
      .slice()
      .reverse()
      .map((day) => {
        const mood = moodFor(day.mood);
        return el(
          'tr',
          {},
          el('th', { attrs: { scope: 'row' }, text: day.date === today ? 'Today' : formatDay(day.date) }),
          el(
            'td',
            {},
            ...(mood
              ? [el('span', { attrs: { 'aria-hidden': 'true' }, text: `${mood.emoji} ` }), mood.label]
              : [el('span', { attrs: { 'aria-hidden': 'true' }, text: '–' }), hiddenText('No check-in')]),
          ),
          el('td', { text: String(day.gratitude) }),
          el('td', { text: String(day.kindness) }),
        );
      }),
  );
}

// Look back: a month at a time, with everything from the chosen day.
// The chosen day is always in the month on show.
let selectedDate = null;
let focusSelectedDay = false;

function dayName(date, today) {
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  if (date.slice(0, 4) !== today.slice(0, 4)) options.year = 'numeric';
  return formatDay(date, options);
}

function dayOverview(day) {
  const parts = [
    moodFor(day.mood)?.label,
    day.gratitude && plural(day.gratitude, 'good thing', 'good things'),
    day.kindness && plural(day.kindness, 'act of kindness', 'acts of kindness'),
    day.pledgesKept && plural(day.pledgesKept, 'pledge kept', 'pledges kept'),
    day.pledgesMade && plural(day.pledgesMade, 'pledge made', 'pledges made'),
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'nothing recorded';
}

function monthOverview({ totals }, month, today) {
  const parts = [
    totals.checkins && `checked in on ${plural(totals.checkins, 'day', 'days')} (average mood ${totals.averageMood} / 5)`,
    totals.gratitude && `noted ${plural(totals.gratitude, 'good thing', 'good things')}`,
    totals.kindness && `shared ${plural(totals.kindness, 'act of kindness', 'acts of kindness')}`,
    totals.pledgesKept && `kept ${plural(totals.pledgesKept, 'pledge', 'pledges')}`,
    totals.pledgesMade && `made ${plural(totals.pledgesMade, 'pledge', 'pledges')}`,
  ].filter(Boolean);
  if (parts.length) return `In ${formatMonth(month)} you ${listing(parts)}.`;
  return `Nothing recorded in ${formatMonth(month)}${month === monthOf(today) ? ' yet' : ''}.`;
}

function renderCalendarDays() {
  // Any Monday will do: Heal's weeks start on a Monday.
  const monday = '2026-03-09';
  calendarDays.replaceChildren(
    ...Array.from({ length: 7 }, (_, index) => {
      const date = addDays(monday, index);
      return el('th', { attrs: { scope: 'col', abbr: formatDay(date, { weekday: 'long' }) }, text: formatDay(date, { weekday: 'short' }) });
    }),
  );
}

function dayCell(day, today) {
  if (day.date > today) {
    return el('td', {}, el('span', { className: 'calendar-day future', text: String(Number(day.date.slice(8))) }));
  }
  const mood = moodFor(day.mood);
  const busy = day.gratitude + day.kindness + day.pledgesKept + day.pledgesMade > 0;
  const selected = day.date === selectedDate;
  return el(
    'td',
    {},
    el(
      'button',
      {
        className: 'calendar-day',
        attrs: {
          type: 'button',
          tabindex: selected ? '0' : '-1',
          'aria-pressed': String(selected),
          'aria-current': day.date === today && 'date',
          'data-date': day.date,
        },
        on: { click: () => showDay(day.date) },
      },
      el('span', { className: 'calendar-number', attrs: { 'aria-hidden': 'true' }, text: String(Number(day.date.slice(8))) }),
      el('span', { className: 'calendar-mark', attrs: { 'aria-hidden': 'true' }, text: mood ? mood.emoji : busy ? '•' : '' }),
      hiddenText(`${dayName(day.date, today)}: ${dayOverview(day)}`),
    ),
  );
}

function renderCalendar(view, today) {
  const cells = [...Array.from({ length: view.offset }, () => el('td')), ...view.days.map((day) => dayCell(day, today))];
  while (cells.length % 7) cells.push(el('td'));
  const rows = [];
  for (let index = 0; index < cells.length; index += 7) rows.push(el('tr', {}, cells.slice(index, index + 7)));
  calendarBody.replaceChildren(...rows);
}

function textList(texts, none) {
  return texts.length ? el('ul', { className: 'detail-list' }, texts.map((text) => el('li', { text }))) : none;
}

function detail(term, content) {
  return [el('dt', { text: term }), el('dd', {}, content)];
}

function renderDay(data, today) {
  const day = dayDetails(data, selectedDate);
  dayHeading.textContent = dayName(selectedDate, today);
  const empty = isEmptyDay(day);
  dayEmpty.hidden = !empty;
  dayList.hidden = empty;
  if (empty) {
    dayList.replaceChildren();
    return;
  }
  const mood = moodFor(day.checkin?.mood);
  const texts = (list) => list.map((item) => item.text);
  dayList.replaceChildren(
    ...[
      detail('Mood', mood ? [el('span', { attrs: { 'aria-hidden': 'true' }, text: `${mood.emoji} ` }), mood.label] : 'No check-in'),
      day.checkin?.note ? detail('Note', el('span', { className: 'entry-text', text: day.checkin.note })) : [],
      detail('Good things', textList(texts(day.gratitude), 'None')),
      detail('Acts of kindness', textList(texts(day.kindness), 'None')),
      day.pledgesKept.length ? detail('Pledges kept', textList(texts(day.pledgesKept))) : [],
      day.pledgesMade.length ? detail('Pledges made', textList(texts(day.pledgesMade))) : [],
    ].flat(),
  );
}

function calendarRange(data, today) {
  return { min: `${monthRange(data, today).first}-01`, max: today };
}

function renderLookBack(data, today) {
  const focus = focusSelectedDay || calendarBody.contains(document.activeElement);
  focusSelectedDay = false;
  const { min, max } = calendarRange(data, today);
  if (!selectedDate || selectedDate < min || selectedDate > max) selectedDate = today;
  const month = monthOf(selectedDate);
  const view = monthView(data, month);

  monthHeading.textContent = formatMonth(month);
  monthPrev.setAttribute('aria-disabled', String(month <= monthOf(min)));
  monthNext.setAttribute('aria-disabled', String(month >= monthOf(max)));
  monthSummary.textContent = monthOverview(view, month, today);
  renderCalendar(view, today);
  renderDay(data, today);
  if (focus) calendarBody.querySelector('[aria-pressed="true"]')?.focus();
}

function render(store, today) {
  const summary = summarize(store.data, today);
  renderStats(summary);
  renderWeek(summary, today);
  renderLookBack(store.data, today);
}

renderCalendarDays();
const page = startPage(render);

function showDay(date, focus = false) {
  selectedDate = date;
  focusSelectedDay = focus;
  page.refresh();
}

calendarBody.addEventListener('keydown', (event) => {
  const from = event.target.closest?.('[data-date]')?.dataset.date;
  if (!from || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = calendarMove(from, event.key, calendarRange(page.store.data, page.today()));
  if (!target) return;
  event.preventDefault();
  showDay(target, true);
});

function changeMonth(button, key) {
  if (button.getAttribute('aria-disabled') === 'true') return;
  showDay(calendarMove(selectedDate, key, calendarRange(page.store.data, page.today())));
  announce(monthStatus, monthHeading.textContent);
}

monthPrev.addEventListener('click', () => changeMonth(monthPrev, 'PageUp'));
monthNext.addEventListener('click', () => changeMonth(monthNext, 'PageDown'));

// Your data.
function download(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = el('a', { attrs: { href: url, download: filename } });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

exportButton.addEventListener('click', () => {
  const data = page.store.reload();
  download(`${JSON.stringify(exportPayload(data), null, 2)}\n`, 'application/json', exportFilename(page.today()));
  const count = countEntries(data);
  announce(dataStatus, count ? `Exported ${plural(count, 'entry', 'entries')}.` : 'Exported an empty file: there is nothing saved yet.');
});

csvButton.addEventListener('click', () => {
  const data = page.store.reload();
  download(toCsv(data), 'text/csv;charset=utf-8', csvFilename(page.today()));
  const count = countEntries(data);
  announce(
    dataStatus,
    count ? `Exported ${plural(count, 'entry', 'entries')} as a spreadsheet.` : 'Exported an empty spreadsheet: there is nothing saved yet.',
  );
});

importButton.addEventListener('click', () => importInput.click());

// Resolves to "merge", "replace", or "" if the person cancels.
function askHowToImport(fileCount, hereCount) {
  importDialogText.textContent = `The file has ${plural(fileCount, 'entry', 'entries')}. This browser already has ${plural(hereCount, 'entry', 'entries')}.`;
  importDialog.returnValue = '';
  return new Promise((resolve) => {
    importDialog.addEventListener('close', () => resolve(importDialog.returnValue), { once: true });
    importDialog.showModal();
  });
}

for (const [id, choice] of [
  ['import-merge', 'merge'],
  ['import-replace', 'replace'],
  ['import-cancel', ''],
]) {
  document.getElementById(id).addEventListener('click', () => importDialog.close(choice));
}

function skippedMessage(skipped) {
  const reason = skipped === 1 ? 'it was invalid or repeated' : 'they were invalid or repeated';
  return `${plural(skipped, 'entry was', 'entries were')} skipped because ${reason}.`;
}

function mergeMessage({ added, markedDone, alreadyHere, differentCheckins, overLimit }) {
  const parts = [added ? `Added ${plural(added, 'new entry', 'new entries')} from the file.` : 'Nothing new to add from that file.'];
  if (markedDone) parts.push(`Marked ${plural(markedDone, 'pledge', 'pledges')} as kept.`);
  if (alreadyHere) parts.push(`${plural(alreadyHere, 'entry was', 'entries were')} already here.`);
  if (differentCheckins) {
    const days = differentCheckins === 1 ? 'a different one for that day' : 'different ones for those days';
    parts.push(`${plural(differentCheckins, "check-in from the file wasn't", "check-ins from the file weren't")} added, because this browser already has ${days}.`);
  }
  if (overLimit) {
    parts.push(`${plural(overLimit, 'entry was', 'entries were')} left out to stay within Heal's limits, such as three good things a day.`);
  }
  return parts;
}

importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0];
  if (!file) return;
  let text;
  try {
    if (file.size > MAX_IMPORT_BYTES) {
      announce(dataStatus, 'That file is too large to be a Heal export.');
      return;
    }
    text = await file.text();
  } catch {
    announce(dataStatus, "That file couldn't be read.");
    return;
  } finally {
    // Lets the same file be chosen again.
    importInput.value = '';
  }

  const result = parseImport(text);
  if (!result.ok) {
    announce(dataStatus, result.error);
    return;
  }
  const current = page.store.reload();
  let choice = 'replace';
  if (hasAnyData(current)) {
    choice = await askHowToImport(countEntries(result.data), countEntries(current));
    importButton.focus();
  }
  if (!choice) {
    announce(dataStatus, 'Import cancelled. Nothing was changed.');
    return;
  }

  let parts;
  let saved;
  if (choice === 'merge') {
    let merged;
    saved = await page.update((data) => {
      merged = mergeData(data, result.data);
      return merged.data;
    });
    parts = mergeMessage(merged);
  } else {
    saved = await page.update(() => result.data);
    parts = [`Imported ${plural(countEntries(result.data), 'entry', 'entries')}.`];
  }
  if (result.skipped) parts.push(skippedMessage(result.skipped));
  if (!saved) parts.push("This browser can't save them, though.");
  announce(dataStatus, parts.join(' '));
});

deleteButton.addEventListener('click', async () => {
  if (!globalThis.confirm('Delete all of your Heal data from this browser? This cannot be undone.')) return;
  const cleared = await page.store.clear();
  forgetTheme();
  page.refresh();
  announce(dataStatus, cleared ? 'All of your Heal data has been deleted from this browser.' : "Your data couldn't be deleted. Try clearing this site's data in your browser settings.");
});
