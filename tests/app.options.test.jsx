// @vitest-environment happy-dom
// Options: CSV export and the week start.
import { expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/preact';
import { installAppTestLifecycle, setup, sheet, go, click } from './appHelpers.jsx';

installAppTestLifecycle();

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
    'B,1000,1 hour and 43 minutes,1.72,"Nov 17, 2026: 1 hr 15 min (a, ""b""); Nov 19, 2026: 28 min",,',
  ]);
});

test('Monday week start changes the export range', async () => {
  await setup({ cases: 1 });
  go('#/options');
  await waitFor(() => expect(screen.getByText(/Nov 15, 2026 to Nov 21, 2026/)).toBeTruthy());
  fireEvent.click(screen.getByLabelText('Monday'));
  await waitFor(() => expect(screen.getByText(/Nov 16, 2026 to Nov 22, 2026/)).toBeTruthy());
});
