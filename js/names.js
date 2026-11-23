// How a student is named in the app: initials ("A.S") or a first name plus last initial ("Jane D.").
// Never a full last name.

const NAME_HELP = 'Enter a first name and last initial (Jane D.) or initials (J.D). A full last name is not accepted.';
const MAX_INITIALS = 4;
const MAX_FIRST_NAME_LETTERS = 20;

const letterCount = token => (token.match(/\p{L}/gu) ?? []).length;
const isAllUpper = token => token === token.toUpperCase() && token !== token.toLowerCase();
const capitalizeName = token =>
  token.toLowerCase().replace(/(^|[-'])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());

/**
 * How a student is shown: initials ("A.S") or a first name plus last initial ("Jane D.").
 * Returns { ok, value, error }. A full last name, a lone first name, more than 4 initials,
 * or no letters is rejected. Short ALL-CAPS words ("AL D") count as initials, not a name.
 */
export function parseName(raw) {
  const fail = { ok: false, value: '', error: NAME_HELP };
  const cleaned = String(raw ?? '').replace(/’/g, "'").replace(/[^\p{L}\s.'-]/gu, '');
  const tokens = cleaned.split(/[\s.]+/).map(t => t.replace(/^[-']+|[-']+$/g, '')).filter(t => letterCount(t) > 0);
  if (tokens.length === 0) return fail;

  const [first, second] = tokens;
  const shortCaps = tokens.length === 2 && isAllUpper(first) && letterCount(first) <= 3;
  if (tokens.length === 2 && letterCount(second) === 1 && letterCount(first) >= 2 && !shortCaps) {
    if (letterCount(first) > MAX_FIRST_NAME_LETTERS) return fail;
    return { ok: true, value: `${capitalizeName(first)} ${second.toUpperCase()}.`, error: null };
  }

  const looksLikeInitials = tokens.every(t => letterCount(t) === 1)
    || tokens.every(isAllUpper)
    || (tokens.length === 1 && letterCount(first) <= 3);
  const letters = tokens.join('').match(/\p{L}/gu) ?? [];
  if (looksLikeInitials && letters.length <= MAX_INITIALS) {
    return { ok: true, value: letters.map(c => c.toUpperCase()).join('.'), error: null };
  }
  return fail;
}
