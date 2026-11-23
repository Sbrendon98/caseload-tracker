// @vitest-environment happy-dom
// Cases: names, duplicates, search, the 50-case limit, archiving, and storage failure.
import { expect, test } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../src/App.jsx';
import { createMemoryDb } from './memory-db.mjs';
import { installAppTestLifecycle, NOON, setup, sheets, sheet, go, type, click, createCase } from './appHelpers.jsx';

installAppTestLifecycle();

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

test('a storage failure shows the red banner instead of failing silently, and the app keeps working', async () => {
  const db = createMemoryDb();
  await setup({ db });
  db.failNext('Your storage is full.');
  await createCase('a s', '1');
  await waitFor(() => expect(screen.getByText('Your storage is full.').closest('[role="alert"]')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  await createCase('a s', '1');
  await waitFor(() => expect(screen.getByText('A.S-1')).toBeTruthy());
});
