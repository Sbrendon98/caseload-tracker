// Rules for one time entry: hours + minutes (+ seconds from the timer) on a date.
import { parseISO } from './dates.js';

export const MAX_ENTRY_SECONDS = 24 * 60 * 60;

function toWhole(v) {
  if (v === '' || v == null) return 0;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

export function validateEntry(input) {
  const errors = {};
  const hours = toWhole(input.hours);
  const minutes = toWhole(input.minutes);
  if (!(hours >= 0)) errors.hours = 'Hours must be a whole number, 0 or more.';
  if (!(minutes >= 0 && minutes <= 59)) errors.minutes = 'Minutes must be a whole number from 0 to 59.';

  const date = String(input.date ?? '').trim();
  try { parseISO(date); } catch { errors.date = 'Enter a valid date.'; }

  const seconds = toWhole(input.seconds);
  if (!(seconds >= 0 && seconds <= 59)) errors.seconds = 'Seconds must be a whole number from 0 to 59.';

  const total = hours * 60 + minutes;
  if (!errors.hours && !errors.minutes && !errors.seconds) {
    const totalSec = total * 60 + seconds;
    if (totalSec <= 0) errors.total = 'Enter a time greater than 0.';
    else if (totalSec > MAX_ENTRY_SECONDS) errors.total = 'A single entry cannot be more than 24 hours.';
  }
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { date, minutes: total, seconds, note: String(input.note ?? '').trim() },
  };
}
