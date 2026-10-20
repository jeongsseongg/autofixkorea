import { parseReportQuery, problem } from '../autofix-analytics/contract.js';
const DAY = 86400000;
export function dailyRequest(body, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['date', 'mode'].includes(key))) throw problem('INVALID_DAILY_REQUEST');
  const today = new Date(+new Date(now) + 9 * 3600000).toISOString().slice(0, 10);
  const date = body.date ?? today, mode = body.mode ?? 'live';
  const query = parseReportQuery(new URLSearchParams({ from: date, to: date, mode }), now);
  if (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`) > 89 * DAY) throw problem('INVALID_DATE_RANGE');
  const scheduled = new Date(`${date}T23:59:00+09:00`).toISOString();
  return { date, mode, scheduled, query };
}
export function dailyQuery(input, cutoff, now = new Date()) {
  const end = new Date(Math.min(Date.parse(cutoff ?? input.scheduled), +new Date(now), Date.parse(input.scheduled))).toISOString();
  return { ...input.query, range: { ...input.query.range, end }, now: new Date(end) };
}
export async function messageHash(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function knownCode(error, fallback = 'DAILY_OPERATION_FAILED') {
  return typeof error?.code === 'string' && /^[A-Z_0-9]{1,80}$/.test(error.code) ? error.code : fallback;
}
