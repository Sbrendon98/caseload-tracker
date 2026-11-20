// Hash routes: '#/', '#/archived', '#/case/:id', '#/calendar?case=:id&date=YYYY-MM-DD', '#/options'.
// Pure parsing and building; the app wires it to hashchange.

const SIMPLE = new Set(['archived', 'calendar', 'options']);
const LIST = { name: 'list', params: {}, query: {} };

export function parseHash(hash) {
  const raw = String(hash ?? '').replace(/^#/, '');
  const [path, queryString = ''] = raw.split('?');
  let parts;
  try { parts = path.split('/').filter(Boolean).map(decodeURIComponent); }
  catch { return { ...LIST }; }
  const query = Object.fromEntries(new URLSearchParams(queryString));
  if (parts[0] === 'case' && parts[1]) return { name: 'case', params: { id: parts[1] }, query };
  if (SIMPLE.has(parts[0])) return { name: parts[0], params: {}, query };
  return { ...LIST };
}

export const routes = {
  list: () => '#/',
  archived: () => '#/archived',
  options: () => '#/options',
  caseDetail: id => `#/case/${encodeURIComponent(id)}`,
  calendar({ caseId, date } = {}) {
    const q = new URLSearchParams();
    if (caseId) q.set('case', caseId);
    if (date) q.set('date', date);
    const s = q.toString();
    return s ? `#/calendar?${s}` : '#/calendar';
  },
};
