// Feature set 3, "For everyone": practical actions for each of the 17 Global
// Goals, searchable and filterable, and pledges you can track to completion.

import { ACTION_TYPES, GOALS } from './data/goals.js';
import { LIMITS, cleanText, makeId } from './store.js';

export const MAX_QUERY = 100;

// Lower-case and strip accents so "cafe" finds "café".
export function fold(text) {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

export function normalizeFilters({ query = '', type = 'all' } = {}) {
  return {
    query: cleanText(query, MAX_QUERY),
    type: typeof type === 'string' && Object.hasOwn(ACTION_TYPES, type) ? type : 'all',
  };
}

export function parseFilters(search) {
  const params = new URLSearchParams(search);
  return normalizeFilters({ query: params.get('q') ?? '', type: params.get('type') ?? 'all' });
}

export function filtersToSearch({ query, type }) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (type && type !== 'all') params.set('type', type);
  const search = params.toString();
  return search ? `?${search}` : '';
}

// Every word must match. A number on its own matches that goal number exactly;
// other words match the goal's name or summary, or the action's text or type.
export function filterGoals({ query = '', type = 'all' } = {}, goals = GOALS) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const results = [];
  for (const goal of goals) {
    const actions = goal.actions.filter((action) => {
      if (type !== 'all' && action.type !== type) return false;
      const haystack = fold(`${goal.name} ${goal.summary} ${action.text} ${ACTION_TYPES[action.type]}`);
      return words.every((word) => (/^\d+$/.test(word) ? Number(word) === goal.number : haystack.includes(word)));
    });
    if (actions.length) results.push({ goal, actions });
  }
  return results;
}

export function findAction(actionId, goals = GOALS) {
  for (const goal of goals) {
    const action = goal.actions.find((item) => item.id === actionId);
    if (action) return { goal, action };
  }
  return null;
}

export function pledgeFor(data, actionId) {
  return data.pledges.find((pledge) => pledge.actionId === actionId) ?? null;
}

export function canPledge(data) {
  return data.pledges.length < LIMITS.pledges;
}

export function addPledge(data, { goal, action, date, id = makeId() }) {
  if (pledgeFor(data, action.id) || !canPledge(data)) return data;
  const pledge = {
    id,
    goal: goal.number,
    actionId: action.id,
    text: cleanText(action.text, LIMITS.text),
    createdAt: date,
    doneAt: null,
  };
  return { ...data, pledges: [...data.pledges, pledge] };
}

export function removePledge(data, id) {
  return { ...data, pledges: data.pledges.filter((pledge) => pledge.id !== id) };
}

export function setPledgeDone(data, id, doneAt) {
  return {
    ...data,
    pledges: data.pledges.map((pledge) => (pledge.id === id ? { ...pledge, doneAt } : pledge)),
  };
}

export function goalsTouched(data) {
  return new Set(data.pledges.map((pledge) => pledge.goal));
}
