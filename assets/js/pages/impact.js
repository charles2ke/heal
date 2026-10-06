import { formatDay } from '../dates.js';
import { MAX_IMPORT_BYTES, exportFilename, exportPayload, hasAnyData, parseImport, summarize } from '../impact.js';
import { countEntries } from '../store.js';
import { forgetTheme } from '../theme.js';
import { announce, el, hiddenText, startPage } from '../ui.js';
import { moodFor } from '../wellbeing.js';

const statGrid = document.getElementById('stat-grid');
const weekBody = document.getElementById('week-body');
const exportButton = document.getElementById('export-data');
const importButton = document.getElementById('import-data');
const importInput = document.getElementById('import-file');
const deleteButton = document.getElementById('delete-data');
const dataStatus = document.getElementById('data-status');

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
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

function render(store, today) {
  const summary = summarize(store.data, today);
  const { checkins, gratitude, kindness, pledges } = summary;
  const averageMood = checkins.averageMood === null ? null : moodFor(Math.round(checkins.averageMood));

  statGrid.replaceChildren(
    statCard('Days checked in', checkins.total, `${checkins.week} in the last 7 days`),
    statCard(
      'Average mood this week',
      averageMood ? `${checkins.averageMood} / 5` : '–',
      averageMood ? `Mostly ${averageMood.label.toLowerCase()}` : 'Check in to see your week',
    ),
    statCard('Good things noted', gratitude.total, `${gratitude.week} in the last 7 days`),
    statCard('Acts of kindness', kindness.total, `${kindness.week} in the last 7 days, ${plural(kindness.streak, 'day', 'days')} in a row`),
    statCard('Pledges kept', pledges.done, `${pledges.active} still in progress`),
    statCard('Global Goals you are helping', `${pledges.goals} of 17`, pledges.goals ? 'Thank you' : 'Make a pledge to start'),
  );

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

const page = startPage(render);

exportButton.addEventListener('click', () => {
  const data = page.store.reload();
  const blob = new Blob([`${JSON.stringify(exportPayload(data), null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = el('a', { attrs: { href: url, download: exportFilename(page.today()) } });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  const count = countEntries(data);
  announce(dataStatus, count ? `Exported ${plural(count, 'entry', 'entries')}.` : 'Exported an empty file: there is nothing saved yet.');
});

importButton.addEventListener('click', () => importInput.click());

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
  if (hasAnyData(page.store.reload()) && !globalThis.confirm('Replace all of your Heal data in this browser with the data in this file? This cannot be undone.')) {
    announce(dataStatus, 'Import cancelled. Nothing was changed.');
    return;
  }
  const saved = page.update(() => result.data);
  const parts = [`Imported ${plural(countEntries(result.data), 'entry', 'entries')}.`];
  if (result.skipped) {
    const reason = result.skipped === 1 ? 'it was invalid or repeated' : 'they were invalid or repeated';
    parts.push(`${plural(result.skipped, 'entry was', 'entries were')} skipped because ${reason}.`);
  }
  if (!saved) parts.push("This browser can't save them, though.");
  announce(dataStatus, parts.join(' '));
});

deleteButton.addEventListener('click', () => {
  if (!globalThis.confirm('Delete all of your Heal data from this browser? This cannot be undone.')) return;
  const cleared = page.store.clear();
  forgetTheme();
  page.refresh();
  announce(dataStatus, cleared ? 'All of your Heal data has been deleted from this browser.' : "Your data couldn't be deleted. Try clearing this site's data in your browser settings.");
});
