// Stopping and correcting a running timer.
import { MAX_ENTRY_SECONDS } from './entries.js';

/**
 * Stopping a timer. Returns { ok: true, minutes } or { ok: false, reason: 'too-long' } when it has run
 * past the 24-hour entry limit (she probably forgot it), so the caller can ask instead of guessing.
 */
export function timerStop(startMs, nowMs) {
  const total = Math.max(1, Math.floor((nowMs - startMs) / 1000)); // whole seconds, never a zero-length entry
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return total > MAX_ENTRY_SECONDS ? { ok: false, reason: 'too-long', minutes, seconds } : { ok: true, minutes, seconds };
}

/** A corrected timer start must be a real time and cannot be in the future. */
export function validateTimerStart(startMs, nowMs) {
  if (!Number.isFinite(startMs)) return { ok: false, error: 'Enter a valid date and time.' };
  if (startMs > nowMs) return { ok: false, error: 'The start time cannot be in the future.' };
  return { ok: true, error: null };
}
