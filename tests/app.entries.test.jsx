// @vitest-environment happy-dom
// Time entries: adding and deleting.
import { expect, test } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { installAppTestLifecycle, setup, sheet, go, click } from './appHelpers.jsx';

installAppTestLifecycle();

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
  await waitFor(() => expect(document.querySelector('.total').textContent).toBe('1h 30m 0s'));
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
