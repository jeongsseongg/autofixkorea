import { buildReport } from '../autofix-analytics/report.js';
import { problem } from '../autofix-analytics/contract.js';
import { dailyRequest, dailyQuery, messageHash, knownCode } from './contract.js';
import { dailyMessage } from './message.js';
import { finalizeDaily } from './finalize.js';

async function inputBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) throw problem('JSON_REQUIRED', 415);
  const reader = request.body?.getReader(); if (!reader) throw problem('INVALID_DAILY_REQUEST');
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 1024) { await reader.cancel(); throw problem('BODY_TOO_LARGE', 413); }
    chunks.push(value);
  }
  const data = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data)); }
  catch { throw problem('INVALID_JSON'); }
}
async function createMessage(store, input, cutoff, now) {
  const query = dailyQuery(input, cutoff, now);
  const result = await store.read({ start: query.range.start, end: query.range.end, mode: input.mode });
  const report = buildReport(result.events, { ...query, truncated: result.truncated });
  if(store.cumulative)report.cumulative=await store.cumulative(input.mode,query.range.end);
  return dailyMessage(report, { date: input.date, cutoff: query.range.end });
}
async function runDaily(input, { store, transport, now, traceId }) {
  const claim = await store.claim({ ...input, traceId });
  if (claim.status !== 'claimed') return { status: claim.status, date: input.date, mode: input.mode };
  const key = { date: input.date, mode: input.mode, token: claim.claim_token, traceId };
  let message = claim.message_text;
  try {
    if (message && claim.message_hash !== await messageHash(message)) throw problem('DAILY_PAYLOAD_CHANGED', 422);
    if (!message) {
      message = await createMessage(store, input, claim.cutoff_at, now);
      await store.prepare({ ...key, message, hash: await messageHash(message) });
    }
  } catch (error) {
    const code = knownCode(error, 'REPORT_PREPARATION_FAILED'), blocked = ['REPORT_TRUNCATED', 'DAILY_PAYLOAD_CHANGED'].includes(code);
    await store.finish({ ...key, status: blocked ? 'blocked' : 'retryable', code, retryAfter: 300 });
    if (blocked) throw problem(code, 422);
    return { status: 'retryable', date: input.date, mode: input.mode, code };
  }
  await store.begin(key); // Durable sending marker must succeed before contacting Telegram.
  let result;
  try { result = await transport.send({ text: message }); }
  catch {
    await store.finish({ ...key, status: 'uncertain', code: 'PROVIDER_OUTCOME_UNKNOWN' });
    return { status: 'uncertain', date: input.date, mode: input.mode, code: 'PROVIDER_OUTCOME_UNKNOWN' };
  }
  if (!result?.accepted || !Number.isSafeInteger(result.id) || result.id <= 0) {
    const status = result?.retryable ? 'retryable' : result?.accepted ? 'uncertain' : 'blocked';
    await store.finish({ ...key, status, code: 'PROVIDER_REJECTED', retryAfter: result?.retryAfter ?? 300 });
    return { status, date: input.date, mode: input.mode, code: 'PROVIDER_REJECTED' };
  }
  await store.finish({ ...key, status: 'sent', messageId: String(result.id) });
  return { status: 'sent', date: input.date, mode: input.mode, messageId: String(result.id) };
}
export function createDailyHandler({ store, transport, secret, authorize, now = () => new Date(),
  log = entry => console.error(JSON.stringify(entry)) }) {
  return async request => {
    const traceId = crypto.randomUUID(), respond = (status, body) => Response.json({ ...body, traceId },
      { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
    try {
      const credential = request.headers.get('x-autofix-analytics-secret');
      if (!credential || !(authorize ? await authorize(credential) : Boolean(secret && credential === secret))) throw problem('UNAUTHORIZED', 401);
      if (request.method !== 'POST') throw problem('METHOD_NOT_ALLOWED', 405);
      const url = new URL(request.url), path = /\/autofix-analytics-daily\/(run|preview|finalize)\/?$/.exec(url.pathname)?.[1];
      if (!path || url.search) throw problem('NOT_FOUND', 404);
      const input = dailyRequest(await inputBody(request), now());
      if (path === 'finalize') return respond(200, await finalizeDaily(input, {store, transport, now:now(), traceId}));
      if (path === 'preview') return respond(200, { date: input.date, mode: input.mode,
        text: await createMessage(store, input, input.scheduled, now()) });
      if (!transport) throw problem('TELEGRAM_NOT_CONFIGURED', 503);
      if (input.mode === 'live' && +now() < Date.parse(input.scheduled)) throw problem('REPORT_NOT_DUE', 425);
      return respond(200, await runDaily(input, { store, transport, now: now(), traceId }));
    } catch (error) {
      const code = knownCode(error), status = Number.isInteger(error?.status) ? error.status : 503;
      if (status >= 500) log({ code, traceId });
      return respond(status, { code });
    }
  };
}
