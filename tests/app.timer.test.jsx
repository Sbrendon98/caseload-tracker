// @vitest-environment happy-dom
// The timer: stop saves, correcting the start or the saved entry, long and double taps.
import { expect, test } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../src/App.jsx';
import { installAppTestLifecycle, MIN, HOUR, sheets, sheet, type, click, openCaseWithRunningTimer } from './appHelpers.jsx';

installAppTestLifecycle();

test('Stop saves the time right away: a 1 min 31 s timer adds exactly 1m 31s and the total shows the seconds', async () => {
  const { store, time, id } = await openCaseWithRunningTimer();
  time.now += 91_000;
  fireEvent.click(screen.getByRole('button', { name: 'Stop timer and save' }));
  await waitFor(() => expect(store.getCase(id).entries).toHaveLength(1));
  const entry = store.getCase(id).entries[0];
  expect(entry.minutes).toBe(1);
  expect(entry.seconds).toBe(31);
  expect(entry.date).toBe('2026-11-20');
  await waitFor(() => expect(store.getMeta('timer')).toBeUndefined());
  await waitFor(() => expect(document.querySelector('.total').textContent).toBe('0h 1m 31s'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start timer' })).toBeTruthy()); // back to ready
  expect(screen.getByText('Saved 0h 1m 31s')).toBeTruthy();
});

test('the toast after stopping has an Edit button that opens that entry to correct the time', async () => {
  const { store, time, id } = await openCaseWithRunningTimer();
  time.now += 5 * HOUR; // she stopped it way too late
  fireEvent.click(screen.getByRole('button', { name: 'Stop timer and save' }));
  await waitFor(() => expect(store.getCase(id).entries[0]?.minutes).toBe(300));
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await waitFor(() => expect(sheet()?.textContent).toContain('Edit time entry'));
  const form = sheet();
  type(within(form).getByLabelText('Hours'), '0');
  type(within(form).getByLabelText('Minutes'), '25');
  fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(store.getCase(id).entries[0].minutes).toBe(25));
  await waitFor(() => expect(document.querySelector('.total').textContent).toBe('0h 25m 0s'));
});

test('a saved entry can be edited later from the list, to fix a forgotten timer', async () => {
  const { store, time, id } = await openCaseWithRunningTimer();
  time.now += 3 * HOUR;
  fireEvent.click(screen.getByRole('button', { name: 'Stop timer and save' }));
  await waitFor(() => expect(store.getCase(id).entries).toHaveLength(1));
  await waitFor(() => expect(document.querySelector('.entry-actions')).toBeTruthy());
  fireEvent.click(within(document.querySelector('.entry-actions')).getByRole('button', { name: 'Edit' }));
  await waitFor(() => expect(sheet()?.textContent).toContain('Edit time entry'));
  type(within(sheet()).getByLabelText('Hours'), '1');
  type(within(sheet()).getByLabelText('Minutes'), '10');
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(store.getCase(id).entries[0].minutes).toBe(70));
});

test('a timer left running for over 24 hours is NOT saved or capped; she is asked to fix the start time', async () => {
  const { store, time, id } = await openCaseWithRunningTimer();
  time.now += 30 * HOUR;
  fireEvent.click(screen.getByRole('button', { name: 'Stop timer and save' }));
  await waitFor(() => expect(sheet()?.textContent).toContain('Set the start time'));
  expect(sheet().textContent).toMatch(/more than 24 hours/);
  expect(store.getCase(id).entries).toHaveLength(0);
  expect(store.getMeta('timer')).toBeTruthy(); // still running, nothing lost
});

test('Edit start time moves the start, so the saved time is right; a future time is refused', async () => {
  const { store, time, id } = await openCaseWithRunningTimer();
  time.now += 10 * MIN;
  fireEvent.click(screen.getByRole('button', { name: 'Edit start time' }));
  await waitFor(() => expect(sheet()?.textContent).toContain('Set the start time'));
  const input = within(sheet()).getByLabelText('Started at');
  type(input, '2026-11-20T13:00'); // after "now" (12:10)
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Save start time' }));
  await waitFor(() => expect(within(sheet()).getByText('The start time cannot be in the future.')).toBeTruthy());

  type(input, '2026-11-20T11:00'); // started an hour before noon: 1h 10m ago
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Save start time' }));
  await waitFor(() => expect(store.getMeta('timer').startedAt).toBe(new Date(2026, 10, 20, 11, 0).getTime()));
  await waitFor(() => expect(sheets()).toHaveLength(0));
  fireEvent.click(screen.getByRole('button', { name: 'Stop timer and save' }));
  await waitFor(() => expect(store.getCase(id).entries[0]?.minutes).toBe(70));
});

test('the timer survives a reload and keeps counting from its real start time', async () => {
  const { store, time, id, unmount } = await openCaseWithRunningTimer();
  time.now += 7 * MIN;
  unmount();
  window.location.hash = `#/case/${id}`;
  render(<App store={store} now={() => time.now} update={false} />);
  await waitFor(() => expect(screen.getByText('Timer running')).toBeTruthy());
  expect(document.querySelector('.clock').textContent).toBe('7:00');
});

test('tapping Stop twice quickly saves ONE entry, not two', async () => {
  const { store, time, id } = await openCaseWithRunningTimer();
  time.now += 5 * MIN;
  const stop = screen.getByRole('button', { name: 'Stop timer and save' });
  fireEvent.click(stop);
  fireEvent.click(stop); // second tap before the first save has finished
  await waitFor(() => expect(store.getMeta('timer')).toBeUndefined());
  await new Promise(r => setTimeout(r, 50));
  expect(store.getCase(id).entries).toHaveLength(1);
  expect(store.getCase(id).entries[0].minutes).toBe(5);
});

test('editing only the note of a timer entry keeps its seconds; changing the minutes resets them', async () => {
  const { store, time, id } = await openCaseWithRunningTimer();
  time.now += 91_000;
  fireEvent.click(screen.getByRole('button', { name: 'Stop timer and save' }));
  await waitFor(() => expect(store.getCase(id).entries).toHaveLength(1));
  await waitFor(() => expect(document.querySelector('.entry-actions')).toBeTruthy());
  fireEvent.click(within(document.querySelector('.entry-actions')).getByRole('button', { name: 'Edit' }));
  await waitFor(() => expect(sheet()?.textContent).toContain('Edit time entry'));
  type(within(sheet()).getByLabelText('Note (optional)'), 'phone call');
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(store.getCase(id).entries[0].note).toBe('phone call'));
  expect(store.getCase(id).entries[0].seconds).toBe(31);

  fireEvent.click(within(document.querySelector('.entry-actions')).getByRole('button', { name: 'Edit' }));
  await waitFor(() => expect(sheet()?.textContent).toContain('Edit time entry'));
  type(within(sheet()).getByLabelText('Minutes'), '10');
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(store.getCase(id).entries[0].minutes).toBe(10));
  expect(store.getCase(id).entries[0].seconds).toBe(0);
});
