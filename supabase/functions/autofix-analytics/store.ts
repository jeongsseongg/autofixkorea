import { problem } from './contract.js';
type Query = { start: string; end: string; mode: string; device?: string };
type Event = Record<string, unknown>;
export function createStore(env: (name: string) => string, fetcher: typeof fetch = fetch) {
  const base = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
  async function db(path: string, method = 'GET', body?: unknown) {
    if (!base || !key) throw problem('ANALYTICS_NOT_CONFIGURED', 503);
    let response: Response;
    try {
      response = await fetcher(`${base}/rest/v1/${path}`, { method,
        headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json', prefer:'return=representation' },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    } catch { throw problem('DATABASE_UNAVAILABLE', 503); }
    if (!response.ok) {
      let code = '';
      try { code = (await response.json()).message ?? ''; } catch { /* Never expose server responses. */ }
      if (code === 'ANALYTICS_VISIT_LIMIT') throw problem('VISIT_EVENT_LIMIT', 429);
      if (code === 'ANALYTICS_ID_MODE_CONFLICT') throw problem('EVENT_MODE_CONFLICT', 409);
      throw problem(`DATABASE_${response.status}`, 503);
    }
    return response.json();
  }
  async function read(query: Query) {
    const events: Event[] = [], pageSize = 1000, cap = 100000;
    const params = new URLSearchParams({ select: '*', mode: `eq.${query.mode}`,
      received_at: `gte.${query.start}`, and: `(received_at.lt.${query.end})`,
      order: 'received_at.asc,id.asc', limit: String(pageSize) });
    // Read complete visits before the report applies its stable device filter.
    while (events.length < cap) {
      params.set('offset', String(events.length));
      params.set('limit', String(Math.min(pageSize, cap - events.length)));
      const rows = await db(`autofix_analytics_events?${params}`);
      if (!Array.isArray(rows)) throw problem('DATABASE_INVALID_RESPONSE', 503);
      if (!rows.length) return { events, truncated: false };
      events.push(...rows.map(row => ({ id: row.id, visit: row.visit, view: row.view, ts: row.event_ts, seq: row.client_seq ?? 0,
        received_at: row.received_at, mode: row.mode, page: row.page, device: row.device,
        source: row.source, type: row.event_type, data: row.data })));
    }
    params.set('offset', String(cap)); params.set('limit', '1');
    const extra = await db(`autofix_analytics_events?${params}`);
    return { events, truncated: extra.length > 0 };
  }
  return {
    async insert(events: Event[], mode: string) {
      const result = await db('rpc/autofix_analytics_insert', 'POST', { p_events: events, p_mode: mode });
      return { inserted: result.inserted, duplicates: result.duplicates };
    },
    async session(token: string) {
      try { return await db('rpc/ofa_validate_session','POST',{p_token:token}); }
      catch { throw problem('LOGIN_REQUIRED',401); }
    },
    loginPermit:()=>db('rpc/autofix_analytics_access_permit','POST',{}),
    async passwordRecord(){
      const rows=await db('autofix_analytics_access?singleton=eq.true&enabled=eq.true&select=salt,password_hash,iterations,version');
      return rows[0]??null;
    },
    createAnalyticsSession:(hash:string,version:string,expiresAt:string)=>db('autofix_analytics_access_sessions','POST',
      {token_hash:hash,password_version:version,expires_at:expiresAt}),
    validateAnalyticsSession:(hash:string)=>db('rpc/autofix_analytics_access_valid','POST',{p_hash:hash}),
    revokeAnalyticsSession:(hash:string)=>db('autofix_analytics_access_sessions?token_hash=eq.'+hash,'PATCH',{revoked:true}),
    cumulative:(mode:string,end:string)=>db('rpc/autofix_analytics_cumulative','POST',{p_mode:mode,p_end:end}),
    read,
  };
}
