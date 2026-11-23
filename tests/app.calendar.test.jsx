// @vitest-environment happy-dom
// The calendar and what shows up on it.
import { expect, test } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { installAppTestLifecycle, setup, sheet, go, click, openCaseWithRunningTimer } from './appHelpers.jsx';

installAppTestLifecycle();

test('the calendar marks days with time and lists the cases for a tapped day', async () => {
  const { store } = await setup({ cases: 2 });
  const [a, b] = store.cases();
  await store.addEntry(a.id, { date: '2026-11-16', hours: '0', minutes: '45' });
  await store.addEntry(b.id, { date: '2026-11-16', hours: '0', minutes: '30' });
  go('#/calendar');
  await waitFor(() => expect(screen.getByText('November 2026')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Mon, Nov 16, 2026, 1h 15m 0s logged' }));
  await waitFor(() => expect(within(sheet()).getByText('1h 15m 0s')).toBeTruthy());
  expect(within(sheet()).getAllByText(/^B-100\d$/)).toHaveLength(2);
});

test('a 4 second timer entry still gets a calendar dot, a day-sheet row, and counts in This week', async () => {
  const { store, time, id } = await openCaseWithRunningTimer();
  time.now += 4_000;
  fireEvent.click(screen.getByRole('button', { name: 'Stop timer and save' }));
  await waitFor(() => expect(store.getCase(id).entries).toHaveLength(1));
  expect(store.getCase(id).entries[0]).toMatchObject({ minutes: 0, seconds: 4 });
  go('#/');
  await waitFor(() => expect(screen.getByText('This week: 0h 0m 4s')).toBeTruthy());
  go('#/calendar');
  const day = await screen.findByRole('button', { name: 'Fri, Nov 20, 2026, 0h 0m 4s logged' });
  expect(day.querySelector('.dot')).toBeTruthy();
  fireEvent.click(day);
  await waitFor(() => expect(within(sheet()).getByText('B-1000')).toBeTruthy());
  expect(within(sheet()).getAllByText('0h 0m 4s').length).toBeGreaterThan(0);
});
