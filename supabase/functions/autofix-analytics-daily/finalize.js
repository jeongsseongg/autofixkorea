import { buildReport } from '../autofix-analytics/report.js';
import { problem } from '../autofix-analytics/contract.js';
import { dailyMessage } from './message.js';
import { messageHash, knownCode } from './contract.js';

export async function finalizeDaily(input, { store, transport, now, traceId }) {
  if (+now < Date.parse(input.query.range.end)) throw problem('DAY_NOT_CLOSED', 425);
  if (!transport?.edit) throw problem('TELEGRAM_NOT_CONFIGURED', 503);
  const claim = await store.claimFinal({ ...input, traceId });
  if (claim.status !== 'claimed') return { status: claim.status, date: input.date, mode: input.mode };
  const key = { date: input.date, mode: input.mode, token: claim.final_token, traceId };
  try {
    let text = claim.final_text;
    if (text && claim.final_hash !== await messageHash(text)) throw problem('DAILY_PAYLOAD_CHANGED', 422);
    if (!text) {
      const query = { ...input.query, now: new Date(input.query.range.end) };
      const result = await store.read({ ...query.range, mode: input.mode });
      const report=buildReport(result.events, { ...query, truncated: result.truncated });
      if(store.cumulative)report.cumulative=await store.cumulative(input.mode,query.range.end);
      text = dailyMessage(report,
        { date: input.date, cutoff: query.range.end, final: true });
      await store.prepareFinal({ ...key, message: text, hash: await messageHash(text) });
    }
    await store.beginFinal(key);
    const result = await transport.edit({ text, id: claim.message_id });
    const status = result?.accepted ? 'finalized' : result?.retryable ? 'retryable' : 'blocked';
    await store.finishFinal({ ...key, status, code: result?.accepted ? null : 'PROVIDER_REJECTED',
      retryAfter: result?.retryAfter ?? 300 });
    return { status, date: input.date, mode: input.mode, messageId: claim.message_id };
  } catch (error) {
    const code = knownCode(error, 'FINALIZATION_RETRY'), blocked = ['REPORT_TRUNCATED', 'DAILY_PAYLOAD_CHANGED'].includes(code);
    await store.finishFinal({ ...key, status: blocked ? 'blocked' : 'retryable', code, retryAfter: 300 });
    if (blocked) throw problem(code, 422);
    return { status: 'retryable', date: input.date, mode: input.mode, code };
  }
}
