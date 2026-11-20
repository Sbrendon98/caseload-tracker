// @vitest-environment happy-dom
// The whole app, rendered against an in-memory database. These lock in the flows that were checked
// by hand in a real browser: name rules, the 50-case limit, swipe-free archiving, entries, export.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../src/App.jsx';
import { createStore } from '../js/store.js';
import { TOPICS } from '../js/tutorials.js';
import { createMemoryDb } from './memory-db.mjs';

const NOON = new Date(2026, 10, 20, 12).getTime(); // Friday 2026-11-20

let clock;
beforeEach(() => { clock = 1_000; window.location.hash = '#/'; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/** A store with `cases` active cases (B-1000, B-1001, ...) already in it, oldest first. */
async function setup({ cases = 0, tutorialsSeen = true } = {}) {
  const store = createStore(createMemoryDb(), { now: () => (clock += 10) });
  if (tutorialsSeen) await store.setMeta('tutorialsSeen', Object.fromEntries(TOPICS.map(t => [t.id, true])));
  for (let i = 0; i < cases; i++) await store.addCase({ initials: 'B', caseNumber: String(1000 + i) });
  const ui = render(<App store={store} now={() => NOON} update={false} />);
  return { store, ...ui };
}

const sheets = () => [...document.querySelectorAll('dialog[open]')];
const sheet = () => sheets().at(-1); // the topmost one
const go = hash => { window.location.hash = hash; fireEvent(window, new Event('hashchange')); };
const type = (el, value) => fireEvent.input(el, { target: { value } });
const click = (name, root = document.body) => fireEvent.click(within(root).getByRole('button', { name }));

async function createCase(name, number) {
  click('+ New case');
  const form = await waitFor(() => { expect(sheet()).toBeTruthy(); return sheet(); });
  type(within(form).getByPlaceholderText('Jane D. or J.D'), name);
  type(within(form).getByPlaceholderText('122445543'), number);
  fireEvent.click(within(form).getByRole('button', { name: 'Create case' }));
}

test('first launch shows the Welcome tutorial once, and it does not come back', async () => {
  const { store, unmount } = await setup({ tutorialsSeen: false });
  await waitFor(() => expect(within(sheet()).getByText('Your caseload, in your pocket')).toBeTruthy());
  for (let i = 0; i < 3; i++) fireEvent.click(within(sheet()).getByRole('button', { name: 'Next' }));
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Got it' }));
  await waitFor(() => expect(sheets()).toHaveLength(0));
  expect(store.getMeta('tutorialsSeen').welcome).toBe(true);

  unmount();
  render(<App store={store} now={() => NOON} update={false} />);
  await new Promise(r => setTimeout(r, 50));
  expect(sheets()).toHaveLength(0);
});

test('a full last name is refused with the reason; a first name and last initial is accepted', async () => {
  await setup();
  await createCase('Jane Doe', '5551');
  await waitFor(() => expect(screen.getByText(/A full last name is not accepted/)).toBeTruthy());
  expect(screen.queryByText('Jane Doe-5551')).toBeNull();

  const form = sheet();
  type(within(form).getByPlaceholderText('Jane D. or J.D'), 'jane d');
  fireEvent.click(within(form).getByRole('button', { name: 'Create case' }));
  await waitFor(() => expect(screen.getByText('Jane D.-5551')).toBeTruthy());
  await waitFor(() => expect(sheets()).toHaveLength(0));
});

test('a duplicate ID is blocked with a clear message, ignoring capitalization', async () => {
  await setup();
  await createCase('a s', '122');
  await waitFor(() => expect(sheets()).toHaveLength(0));
  await createCase('A.S.', '122');
  await waitFor(() => expect(screen.getByText('A case with ID A.S-122 already exists.')).toBeTruthy());
});

test('search narrows the list, ignoring dots and dashes', async () => {
  await setup({ cases: 3 });
  type(screen.getByLabelText('Search cases by ID'), 'b1001');
  await waitFor(() => expect(screen.queryByText('B-1000')).toBeNull());
  expect(screen.getByText('B-1001')).toBeTruthy();
  type(screen.getByLabelText('Search cases by ID'), 'zzz');
  await waitFor(() => expect(screen.getByText('No cases match your search.')).toBeTruthy());
});

test('the 51st case opens the archive sheet; archiving the oldest creates the new case by itself', async () => {
  const { store } = await setup({ cases: 50 });
  await createCase('z z', '999');
  await waitFor(() => expect(sheet()?.textContent).toContain('Archive completed cases'));
  const limit = sheet();
  expect(within(limit).getByText(/Archive 1 more to continue/)).toBeTruthy();
  const oldest = limit.querySelector('.case-id');
  expect(oldest.textContent).toBe('B-1000'); // oldest first

  fireEvent.click(within(limit).getByRole('button', { name: 'Archive B-1000' }));
  await waitFor(() => expect(sheets()).toHaveLength(0)); // limit sheet and form both closed
  expect(store.cases().find(c => c.displayId === 'Z.Z-999')).toBeTruthy();
  expect(store.getCase(store.cases().find(c => c.displayId === 'B-1000').id).archived).toBe(true);
  expect(store.activeNewestFirst()).toHaveLength(50);
  expect(store.getMeta('draft:newCase')).toBeUndefined();
});

test('closing the limit sheet without archiving keeps the new-case form filled in', async () => {
  const { store } = await setup({ cases: 50 });
  await createCase('z z', '999');
  await waitFor(() => expect(sheets()).toHaveLength(2));
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(sheets()).toHaveLength(1));
  expect(within(sheet()).getByPlaceholderText('Jane D. or J.D').value).toBe('z z');
  expect(store.cases()).toHaveLength(50);
});

test('the ⋯ menu archives without any swipe, and Undo brings the case back', async () => {
  const { store } = await setup({ cases: 2 });
  fireEvent.click(screen.getByRole('button', { name: 'More actions for B-1001' }));
  await waitFor(() => expect(within(sheet()).getByRole('button', { name: 'Archive' })).toBeTruthy());
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Archive' }));
  await waitFor(() => expect(screen.getByText('Archived B-1001')).toBeTruthy());
  expect(store.activeNewestFirst().map(c => c.displayId)).toEqual(['B-1000']);

  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(store.activeNewestFirst()).toHaveLength(2));
});

test('unarchiving at 50 active cases goes through the same archive sheet and then completes', async () => {
  const { store } = await setup({ cases: 50 });
  const archived = store.activeOldestFirst()[0];
  await store.archive(archived.id);
  await store.addCase({ initials: 'X', caseNumber: '1' }); // back to 50 active
  go('#/archived');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Unarchive B-1000' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Unarchive B-1000' }));
  await waitFor(() => expect(sheet()?.textContent).toContain('Archive completed cases'));
  fireEvent.click(within(sheet()).getByRole('button', { name: /^Archive B-1001$/ }));
  await waitFor(() => expect(store.getCase(archived.id).archived).toBe(false));
  expect(store.activeNewestFirst()).toHaveLength(50);
});

test('time: a quick button fills the form, adding updates the total, zero time is refused', async () => {
  const { store } = await setup({ cases: 1 });
  const id = store.cases()[0].id;
  go(`#/case/${id}`);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'B-1000' })).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'Add time' }));
  await waitFor(() => expect(screen.getByText('Enter a time greater than 0.')).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: '1.5 hr' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add time' }));
  await waitFor(() => expect(store.getCase(id).entries).toHaveLength(1));
  expect(store.getCase(id).entries[0].minutes).toBe(90);
  expect(store.getCase(id).entries[0].date).toBe('2026-11-20'); // defaults to "today"
  await waitFor(() => expect(document.querySelector('.total').textContent).toBe('1h 30m'));
  expect(screen.getByLabelText('Hours').value).toBe(''); // form reset for the next entry
});

test('deleting an entry asks first', async () => {
  const { store } = await setup({ cases: 1 });
  const id = store.cases()[0].id;
  await store.addEntry(id, { date: '2026-11-17', hours: '0', minutes: '30' });
  go(`#/case/${id}`);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(screen.getByText('Delete this entry?')).toBeTruthy());
  expect(store.getCase(id).entries).toHaveLength(1); // nothing deleted yet
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(store.getCase(id).entries).toHaveLength(0));
});

test('export hands one consolidated row per case to the share sheet in the same tick as the tap (iOS needs that)', async () => {
  const { store } = await setup({ cases: 2 });
  const id = store.cases()[0].id;
  await store.addEntry(id, { date: '2026-11-17', hours: '1', minutes: '15', note: 'a, "b"' });
  await store.addEntry(id, { date: '2026-11-19', hours: '0', minutes: '28' });
  const share = vi.fn(() => Promise.resolve());
  vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share });
  go('#/options');
  await waitFor(() => expect(screen.getByText(/1 case with time in this range/)).toBeTruthy());
  expect(screen.getByText(/\(2 entries\)/)).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  expect(share).toHaveBeenCalledTimes(1); // no await between the tap and share()
  const [{ files }] = share.mock.calls[0];
  expect(files[0].name).toBe('caseload-week-2026-11-15.csv');
  const rows = (await files[0].text()).slice(1).split('\r\n').slice(1, -1);
  expect(rows).toEqual([
    'B-1000,B,1000,1 hour and 43 minutes,1.72,"Nov 17, 2026: 1 hr 15 min (a, ""b""); Nov 19, 2026: 28 min",,',
  ]);
});

test('Monday week start changes the export range', async () => {
  await setup({ cases: 1 });
  go('#/options');
  await waitFor(() => expect(screen.getByText(/Nov 15, 2026 to Nov 21, 2026/)).toBeTruthy());
  fireEvent.click(screen.getByLabelText('Monday'));
  await waitFor(() => expect(screen.getByText(/Nov 16, 2026 to Nov 22, 2026/)).toBeTruthy());
});

test('the calendar marks days with time and lists the cases for a tapped day', async () => {
  const { store } = await setup({ cases: 2 });
  const [a, b] = store.cases();
  await store.addEntry(a.id, { date: '2026-11-16', hours: '0', minutes: '45' });
  await store.addEntry(b.id, { date: '2026-11-16', hours: '0', minutes: '30' });
  go('#/calendar');
  await waitFor(() => expect(screen.getByText('November 2026')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Mon, Nov 16, 2026, 1h 15m logged' }));
  await waitFor(() => expect(within(sheet()).getByText('1h 15m')).toBeTruthy());
  expect(within(sheet()).getAllByText(/^B-100\d$/)).toHaveLength(2);
});

test('a storage failure shows the red banner instead of failing silently, and the app keeps working', async () => {
  const db = createMemoryDb();
  const store = createStore(db, { now: () => (clock += 10) });
  await store.setMeta('tutorialsSeen', Object.fromEntries(TOPICS.map(t => [t.id, true])));
  render(<App store={store} now={() => NOON} update={false} />);
  db.failNext('Your storage is full.');
  await createCase('a s', '1');
  await waitFor(() => expect(screen.getByText('Your storage is full.').closest('[role="alert"]')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  await createCase('a s', '1');
  await waitFor(() => expect(screen.getByText('A.S-1')).toBeTruthy());
});
