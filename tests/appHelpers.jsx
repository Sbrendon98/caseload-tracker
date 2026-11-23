// @vitest-environment happy-dom
// Shared setup for the whole-app tests (tests/app.*.test.jsx): the app rendered against an in-memory
// database, with a clock the test can move and small helpers for sheets, typing and navigation.
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../src/App.jsx';
import { createStore } from '../js/store.js';
import { TOPICS } from '../js/tutorials.js';
import { createMemoryDb } from './memory-db.mjs';

export const NOON = new Date(2026, 10, 20, 12).getTime(); // Friday 2026-11-20
export const MIN = 60_000;
export const HOUR = 60 * MIN;

let clock;

/** Call once at the top of each app test file. */
export function installAppTestLifecycle() {
  beforeEach(() => { clock = 1_000; window.location.hash = '#/'; });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
}

/** A store with `cases` active cases (B-1000, B-1001, ...) already in it, oldest first. */
export async function setup({ cases = 0, tutorialsSeen = true, db = createMemoryDb() } = {}) {
  const store = createStore(db, { now: () => (clock += 10) });
  if (tutorialsSeen) await store.setMeta('tutorialsSeen', Object.fromEntries(TOPICS.map(t => [t.id, true])));
  for (let i = 0; i < cases; i++) await store.addCase({ initials: 'B', caseNumber: String(1000 + i) });
  const time = { now: NOON }; // the app's "current time"; tests move it forward with time.now += ...
  const ui = render(<App store={store} now={() => time.now} update={false} />);
  return { store, time, ...ui };
}

export const sheets = () => [...document.querySelectorAll('dialog[open]')];
export const sheet = () => sheets().at(-1); // the topmost one
export const go = hash => { window.location.hash = hash; fireEvent(window, new Event('hashchange')); };
export const type = (el, value) => fireEvent.input(el, { target: { value } });
export const click = (name, root = document.body) => fireEvent.click(within(root).getByRole('button', { name }));

export async function createCase(name, number) {
  click('+ New case');
  const form = await waitFor(() => { expect(sheet()).toBeTruthy(); return sheet(); });
  type(within(form).getByPlaceholderText('Jane D. or J.D'), name);
  type(within(form).getByPlaceholderText('122445543'), number);
  fireEvent.click(within(form).getByRole('button', { name: 'Create case' }));
}

/** A case page with the timer already started. */
export async function openCaseWithRunningTimer() {
  const ctx = await setup({ cases: 1 });
  const id = ctx.store.cases()[0].id;
  go(`#/case/${id}`);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start timer' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Start timer' }));
  await waitFor(() => expect(screen.getByText('Timer running')).toBeTruthy());
  return { ...ctx, id };
}
