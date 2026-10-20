import { createStore } from '../autofix-analytics/store.ts';
import { problem } from '../autofix-analytics/contract.js';
type Key = { date: string; mode: string; token?: string; traceId?: string };
export function createDailyStore(env: (name: string) => string, fetcher: typeof fetch = fetch) {
  const base = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
  const analytics = createStore(env, fetcher);
  async function rpc(name: string, body: unknown) {
    if (!base || !key) throw problem('DAILY_NOT_CONFIGURED', 503);
    let response: Response;
    try {
      response = await fetcher(`${base}/rest/v1/rpc/autofix_analytics_daily_${name}`, { method: 'POST',
        headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    } catch { throw problem('DAILY_DATABASE_UNAVAILABLE', 503); }
    if (!response.ok) throw problem(`DAILY_DATABASE_${response.status}`, 503);
    const result = await response.json();
    if (result === false && name !== 'authorize') throw problem('DAILY_LEASE_LOST', 409);
    return result;
  }
  const params = (input: Key) => ({ p_date: input.date, p_mode: input.mode, p_token: input.token });
  return {
    read: analytics.read,cumulative:analytics.cumulative,
    claimFinal: (input: Key) => rpc('final_claim', {p_date:input.date,p_mode:input.mode,p_trace_id:input.traceId??null}),
    prepareFinal: (input: Key & {message:string;hash:string}) => rpc('final_prepare', {...params(input),p_message:input.message,p_hash:input.hash}),
    beginFinal: (input: Key) => rpc('final_begin',params(input)),
    finishFinal: (input: Key & {status:string;code?:string;retryAfter?:number}) => rpc('final_finish', {
      ...params(input),p_status:input.status,p_code:input.code??null,p_retry_after:input.retryAfter??300}),
    authorize: (credential: string) => /^[a-f0-9]{64}$/.test(credential) ? rpc('authorize', {p_secret:credential}) : Promise.resolve(false),
    claim: (input: Key) => rpc('claim', { p_date: input.date, p_mode: input.mode, p_trace_id: input.traceId ?? null }),
    prepare: (input: Key & { message: string; hash: string }) => rpc('prepare', {
      ...params(input), p_message: input.message, p_hash: input.hash }),
    begin: (input: Key) => rpc('begin', params(input)),
    finish: (input: Key & { status: string; code?: string; retryAfter?: number; messageId?: string }) => rpc('finish', {
      ...params(input), p_status: input.status, p_code: input.code ?? null,
      p_retry_after: input.retryAfter ?? 300, p_message_id: input.messageId ?? null, p_trace_id: input.traceId ?? null }),
  };
}
