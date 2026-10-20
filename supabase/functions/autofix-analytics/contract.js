export const CHANNELS = ['google', 'naver', 'meta', 'kakao', 'youtube', 'blog', 'referral', 'unknown'];
export const DEVICES = ['mobile', 'tablet', 'desktop'];
export const SECTIONS = ['hero', 'brands', 'campaigns', 'trade-board', 'why', 'guide', 'comparison',
  'reviews', 'journal', 'faq', 'location', 'contact', 'form', 'other'];
export const STEPS = {sale:['service', 'accidentType', 'manufacturer', 'group', 'model', 'plate', 'year', 'mileage', 'region', 'fuel', 'owner', 'finance', 'ignition', 'driving', 'airbag', 'priorHistory', 'condition', 'photos', 'repair', 'fault', 'insuranceRepair', 'settlement', 'insuredValue', 'otherQuote', 'desired', 'budget', 'contact', 'review', 'complete'], purchase:['service', 'accidentType', 'manufacturer', 'group', 'model', 'plate', 'year', 'mileage', 'region', 'fuel', 'owner', 'finance', 'ignition', 'driving', 'airbag', 'priorHistory', 'condition', 'photos', 'repair', 'fault', 'insuranceRepair', 'settlement', 'insuredValue', 'otherQuote', 'desired', 'budget', 'contact', 'review', 'complete'], repair:['service', 'accidentType', 'manufacturer', 'group', 'model', 'plate', 'year', 'mileage', 'region', 'fuel', 'owner', 'finance', 'ignition', 'driving', 'airbag', 'priorHistory', 'condition', 'photos', 'repair', 'fault', 'insuranceRepair', 'settlement', 'insuredValue', 'otherQuote', 'desired', 'budget', 'contact', 'review', 'complete']};
export const FIELDS = ['service', 'accidentType', 'manufacturer', 'group', 'model', 'plate', 'year', 'mileage', 'region', 'fuel', 'owner', 'finance', 'ignition', 'driving', 'airbag', 'priorHistory', 'condition', 'photos', 'repair', 'fault', 'insuranceRepair', 'settlement', 'insuredValue', 'otherQuote', 'desired', 'budget', 'contact', 'damagePart', 'symptoms', 'diagnosis', 'repairScope', 'onset', 'consent'];
export const ITEMS = ['sale', 'purchase', 'repair', 'warranty', 'photos', 'price', 'process', 'faq', 'location', 'trade', 'comparison', 'review', 'blog', 'campaign', 'other', 'accidentSale', 'accidentRepair', 'breakdownSale'];
export const MAX_BYTES = 50 * 1024;
export const MAX_BATCH = 40;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const DAY = 86400000;

export function problem(code, status = 400) {
  return Object.assign(new Error(code), { code, status });
}
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw problem('INVALID_EVENT');
  return value;
}
function member(value, allowed) {
  if (!allowed.includes(value)) throw problem('INVALID_EVENT');
  return value;
}
function number(value, min, max, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw problem('INVALID_EVENT');
  }
  return value;
}
function uuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw problem('INVALID_EVENT');
  return value.toLowerCase();
}
function token(value = '') {
  // Free text and contact-like tokens cannot become campaign labels.
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{0,80}$/.test(value) ||
      /(?:\d[ _-]*){8,}/.test(value)) throw problem('INVALID_SOURCE');
  return value;
}
export function sanitizeSource(value) {
  const s = object(value);
  const channel = member(s.channel, CHANNELS);
  const medium = member(s.medium, ['paid', 'search', 'social', 'referral', 'unknown']);
  const confidence = member(s.confidence, ['tagged', 'referrer', 'unknown']);
  if (typeof s.tagged !== 'boolean' || s.tagged !== (confidence === 'tagged')) throw problem('INVALID_SOURCE');
  const campaign = token(s.campaign), content = token(s.content);
  if (!s.tagged && (campaign || content)) throw problem('INVALID_SOURCE');
  let term = '';
  if(s.term !== undefined) {
    if(typeof s.term !== 'string' || s.term.length > 60 || !/^[\p{L}\p{N} _-]+$/u.test(s.term) || /(?:\d[ _-]*){8,}/.test(s.term)) throw problem('INVALID_SOURCE');
    if(s.tagged) term = s.term;
  }
  return { channel, medium, campaign, content, tagged: s.tagged, confidence, ...(term ? {term} : {}) };
}
function formData(value, step = false) {
  const form = member(value.form, ['sale', 'purchase', 'repair']);
  return step ? { form, step: member(value.step, STEPS[form]) } : { form };
}
function eventData(type, value) {
  const d = object(value);
  switch (type) {
    case 'page_view': return {};
    case 'contact_click': return { kind: member(d.kind, ['phone', 'kakao', 'form']), section: member(d.section, SECTIONS),
      ...(d.placement ? {placement:member(d.placement,['header','hero','footer','floating','form','inline'])} : {}) };
    case 'section_time': return { section: member(d.section, SECTIONS), seconds: number(d.seconds, 0, 15) };
    case 'scroll_depth': return { depth: member(d.depth, [25, 50, 75, 90, 100]) };
    case 'pointer_cell': return { section: member(d.section, SECTIONS), kind: member(d.kind, ['move', 'click']),
      col: number(d.col, 0, 11, true), row: number(d.row, 0, 11, true) };
    case 'form_start': case 'form_attempt': case 'form_success': return formData(d);
    case 'form_step': return formData(d, true);
    case 'form_progress': {
      const result = { ...formData(d, true), filled: number(d.filled, 0, 40, true),
        total: number(d.total, 1, 40, true), percent: number(d.percent, 0, 100) };
      if (result.filled > result.total || Math.abs(result.percent - result.filled / result.total * 100) > 1) {
        throw problem('INVALID_EVENT');
      }
      return result;
    }
    case 'field_state': return { ...formData(d), field: member(d.field, FIELDS),
      action: member(d.action, ['focus', 'filled', 'cleared']) };
    case 'form_error': return { ...formData(d), code: member(d.code, ['server', 'network', 'validation', 'unknown']) };
    case 'interest': return { section: member(d.section, SECTIONS), item: member(d.item, ITEMS) };
    default: throw problem('INVALID_EVENT_TYPE');
  }
}
export function sanitizeEvent(value, now = new Date()) {
  const e = object(value), timestamp = typeof e.ts === 'string' && ISO.test(e.ts) ? Date.parse(e.ts) : NaN;
  const age = +new Date(now) - timestamp;
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 19) !== e.ts.slice(0, 19) ||
      age < -300000 || age > DAY) throw problem('INVALID_TIMESTAMP');
  return { id: uuid(e.id), visit: uuid(e.visit), view: uuid(e.view), ts: new Date(timestamp).toISOString(),
    seq: number(e.seq ?? 0, 0, 1000000, true),
    page: member(e.page, ['home', 'sale', 'purchase']), device: member(e.device, DEVICES), source: sanitizeSource(e.source),
    type: e.type, data: eventData(e.type, e.data) };
}
export function sanitizeBatch(body, now = new Date()) {
  const b = object(body), mode = member(b.mode ?? 'live', ['live', 'test']);
  if (!Array.isArray(b.events) || !b.events.length || b.events.length > MAX_BATCH) throw problem('INVALID_BATCH');
  return { mode, events: b.events.map(event => sanitizeEvent(event, now)) };
}
function dateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) throw problem('INVALID_DATE_RANGE');
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw problem('INVALID_DATE_RANGE');
  return ms;
}
export function parseReportQuery(params, now = new Date()) {
  const allowed = ['days', 'from', 'to', 'mode', 'device', 'channel'];
  for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) throw problem('INVALID_QUERY');
  const today = new Date(+new Date(now) + 9 * 3600000).toISOString().slice(0, 10);
  const days = Number(params.get('days') ?? 7);
  if (params.has('days') && (params.has('from') || params.has('to'))) throw problem('INVALID_QUERY');
  if ((!params.has('from') && params.has('to')) || (params.has('from') && !params.has('to'))) throw problem('INVALID_DATE_RANGE');
  if (!params.has('from') && ![1, 7, 30].includes(days)) throw problem('INVALID_DATE_RANGE');
  const to = params.get('to') ?? today, endDay = dateValue(to);
  const from = params.get('from') ?? new Date(endDay - (days - 1) * DAY).toISOString().slice(0, 10);
  const startDay = dateValue(from), span = (endDay - startDay) / DAY + 1;
  if (span < 1 || span > 90 || to > today) throw problem('INVALID_DATE_RANGE');
  return { range: { from, to, days: span, start: new Date(startDay - 9 * 3600000).toISOString(),
    end: new Date(endDay + DAY - 9 * 3600000).toISOString() },
    mode: member(params.get('mode') ?? 'live', ['live', 'test']),
    device: params.has('device') && params.get('device') !== 'all' ? member(params.get('device'), DEVICES) : undefined,
    channel: params.has('channel') && params.get('channel') !== 'all' ? member(params.get('channel'), CHANNELS) : undefined };
}
