// Time arithmetic and wording. Entries hold minutes plus optional seconds; totals are in seconds.
import { plural } from './plural.js';

/** Entries made before seconds existed have none. */
export const entrySeconds = e => e.minutes * 60 + (e.seconds ?? 0);
export const totalSeconds = entries => entries.reduce((sum, e) => sum + entrySeconds(e), 0);

/** 5442 -> "1h 30m 42s". Shown for case totals and entries in the app. */
export function formatDurationSeconds(sec) {
  const t = Math.max(0, Math.round(sec));
  return `${Math.floor(t / 3600)}h ${Math.floor((t % 3600) / 60)}m ${t % 60}s`;
}

/** 73 -> "1 hour and 13 minutes". Used for the total in the CSV. */
export function durationInWords(min) {
  const m = Math.max(0, Math.round(min));
  const hours = Math.floor(m / 60);
  const minutes = m % 60;
  if (hours === 0) return plural(minutes, 'minute');
  if (minutes === 0) return plural(hours, 'hour');
  return `${plural(hours, 'hour')} and ${plural(minutes, 'minute')}`;
}

/** 75 -> "1 hr 15 min". Compact form for the per-day list in the CSV. */
export function durationShort(min) {
  const m = Math.max(0, Math.round(min));
  const hours = Math.floor(m / 60);
  const minutes = m % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

export const decimalHours = min => (min / 60).toFixed(2);
