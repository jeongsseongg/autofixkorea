const LABELS = {'google': '구글', 'naver': '네이버', 'meta': '인스타그램·페이스북', 'kakao': '카카오', 'youtube': '유튜브', 'blog': '블로그', 'referral': '다른 사이트', 'unknown': '확인되지 않은 유입', 'hero': '첫 화면', 'brands': '제조사', 'campaigns': '서비스', 'trade-board': '거래 사례', 'why': '오토픽스 선택 이유', 'guide': '매입 절차', 'comparison': '수리 비교', 'reviews': '고객 후기', 'journal': '차량 매거진', 'faq': '자주 묻는 질문', 'location': '거점 안내', 'contact': '연락처', 'form': '매입 입력폼', 'other': '기타 구간', 'sale': '사고차 매입', 'purchase': '고장차 매입', 'repair': '수리 견적', 'price': '차량 견적', 'process': '매입 절차', 'trade': '거래 사례', 'review': '내용 확인', 'complete': '접수 완료', 'campaign': '서비스', 'service': '매입 종류', 'accidentType': '사고 유형', 'manufacturer': '제조사', 'group': '차종', 'model': '세부 등급', 'plate': '차량번호', 'year': '연식', 'mileage': '주행거리', 'region': '차량 위치', 'fuel': '연료', 'owner': '차량 명의', 'finance': '할부·저당', 'ignition': '시동', 'driving': '주행 가능 여부', 'airbag': '에어백', 'priorHistory': '기존 사고 이력', 'condition': '차량 상태', 'photos': '차량 사진', 'fault': '과실 비율', 'insuranceRepair': '보험 수리 견적', 'settlement': '미수선 금액', 'insuredValue': '차량가액', 'otherQuote': '타 업체 견적', 'desired': '판매 희망가', 'budget': '수리 예산', 'damagePart': '손상 부위', 'symptoms': '손상 증상', 'diagnosis': '진단 상태', 'repairScope': '수리 범위', 'onset': '발생 시점', 'consent': '접수 동의', 'accidentSale': '사고차 매입', 'breakdownSale': '고장차 매입', 'accidentRepair': '수리 비교'};
const rate = (n, d) => d ? Math.round(n / d * 1000) / 10 : 0;
const unique = values => new Set(values).size;
const date = e => new Date(Date.parse(e.received_at) + 9 * 3600000).toISOString().slice(0, 10);
const journey = e => `${e.visit}:${e.data.form}`;
const is = (e, type) => e.type === type;
const touched = (e, kind) => is(e, 'contact_click') && e.data.kind === kind;
function groups(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = key(row);
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  }
  return map;
}
function selectRows(events, options) {
  const ids = new Set(), { start, end } = options.range;
  return events.filter(e => {
    const time = Date.parse(e.received_at);
    if (ids.has(e.id) || !Number.isFinite(time) || time < Date.parse(start) || time >= Date.parse(end) ||
        (e.mode ?? 'live') !== options.mode) return false;
    ids.add(e.id);
    return true;
  }).sort((a, b) => Date.parse(a.received_at) - Date.parse(b.received_at));
}
function attribution(rows, channel) {
  const first = new Map();
  for (const e of rows) if (!first.has(e.visit)) first.set(e.visit, e.source);
  return { first, rows: channel ? rows.filter(e => first.get(e.visit).channel === channel) : rows };
}
function activityOrder(a, b) {
  return Date.parse(a.ts) - Date.parse(b.ts) || (a.seq ?? 0) - (b.seq ?? 0) ||
    Date.parse(a.received_at) - Date.parse(b.received_at);
}
function summary(rows) {
  const starts = new Set(rows.filter(e => is(e, 'form_start')).map(journey));
  const success = new Set(rows.filter(e => is(e, 'form_success')).map(journey));
  const completed = [...starts].filter(key => success.has(key)).length;
  const visits = unique(rows.map(e => e.visit));
  const time = rows.filter(e => is(e, 'section_time')).reduce((sum, e) => sum + e.data.seconds, 0);
  return { visits, pageViews: unique(rows.filter(e => is(e, 'page_view')).map(e => e.view)),
    phoneClicks: rows.filter(e => touched(e, 'phone')).length, kakaoClicks: rows.filter(e => touched(e, 'kakao')).length,
    formStarts: starts.size, formAttempts: unique(rows.filter(e => is(e, 'form_attempt')).map(journey)),
    formSuccesses: success.size, formErrors: rows.filter(e => is(e, 'form_error')).length,
    formCompletionRate: rate(completed, starts.size), avgEngagedSeconds: visits ? Math.round(time / visits) : 0,
    unknownRate: 0 };
}
function channelRows(rows, first) {
  return [...groups(rows, e => first.get(e.visit).channel)].map(([channel, events]) => {
    const s = summary(events), conversions = unique(events.filter(e => is(e, 'form_success')).map(e => e.visit));
    return { channel, label: LABELS[channel], visits: s.visits, phoneClicks: s.phoneClicks, kakaoClicks: s.kakaoClicks,
      formStarts: s.formStarts, formSuccesses: s.formSuccesses, conversionRate: rate(conversions, s.visits) };
  }).sort((a, b) => b.visits - a.visits);
}
function campaignRows(rows, first) {
  const tagged = rows.filter(e => first.get(e.visit).tagged && first.get(e.visit).campaign);
  return [...groups(tagged, e => {
    const s = first.get(e.visit);
    return JSON.stringify([s.campaign, s.channel, s.content]);
  })].map(([key, events]) => {
    const [campaign, channel, content] = JSON.parse(key), visits = unique(events.map(e => e.visit));
    const leads = unique(events.filter(e => is(e, 'form_success')).map(e => e.visit));
    return { campaign, channel, content, visits, leads, rate: rate(leads, visits) };
  }).sort((a, b) => b.visits - a.visits);
}
function funnelRows(rows, visits) {
  const definitions = [ ['visits', '방문', () => true], ['contact', '문의 버튼 클릭', e => is(e, 'contact_click')],
    ['form_start', '입력 시작', e => is(e, 'form_start')], ['form_attempt', '접수 시도', e => is(e, 'form_attempt')],
    ['form_success', '접수 완료', e => is(e, 'form_success')] ];
  return definitions.map(([key, label, match]) => {
    const count = unique(rows.filter(match).map(e => e.visit));
    return { key, label, count, rate: rate(count, visits) };
  });
}
function stepRows(rows, now) {
  const forms = groups(rows.filter(e => e.data.form), journey), activity = new Map();
  for (const e of rows) activity.set(e.visit, Math.max(activity.get(e.visit) ?? -Infinity, Date.parse(e.received_at)));
  const result = new Map();
  for (const events of forms.values()) {
    const entries = events.filter(e => is(e, 'form_step') || is(e, 'form_progress'));
    const last = entries.at(-1), success = events.some(e => is(e, 'form_success'));
    for (const step of new Set(entries.map(e => e.data.step))) {
      const after = entries.findLastIndex(e => e.data.step === step);
      // completed means an observed move to another step (including back), or submission; not a filled answer.
      const complete = success || entries.slice(after + 1).some(e => e.data.step !== step);
      const abandoned = !success && last?.data.step === step && +new Date(now) - activity.get(last.visit) >= 1800000;
      const r = result.get(step) ?? { step, label: LABELS[step], reached: 0, completed: 0, abandoned: 0 };
      r.reached++; r.completed += Number(complete); r.abandoned += Number(abandoned && !complete);
      result.set(step, r);
    }
  }
  return [...result.values()].map(r => ({ ...r, dropRate: rate(r.abandoned, r.reached) }));
}
function fieldRows(rows) {
  const result = new Map();
  for (const [field, events] of groups(rows.filter(e => is(e, 'field_state')), e => e.data.field)) {
    const forms = groups(events, journey), focused = unique(events.filter(e => e.data.action === 'focus').map(journey));
    let filled = 0;
    for (const form of forms.values()) {
      if (form.filter(e => e.data.action !== 'focus').at(-1)?.data.action === 'filled') filled++;
    }
    result.set(field, { field, label: LABELS[field], focused, filled, completionRate: rate(filled, forms.size) });
  }
  return [...result.values()];
}
function progressRows(rows) {
  const counts = new Map();
  for (const events of groups(rows.filter(e => e.data.form), journey).values()) {
    if (!events.some(e => is(e, 'form_start'))) continue;
    const success = events.some(e => is(e, 'form_success'));
    const percent = success ? 100 : events.filter(e => is(e, 'form_progress')).at(-1)?.data.percent ?? 0;
    const bucket = percent === 100 ? '100' : percent >= 75 ? '75-99' : percent >= 50 ? '50-74' : percent >= 25 ? '25-49' : '0-24';
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return ['0-24', '25-49', '50-74', '75-99', '100'].filter(bucket => counts.has(bucket))
    .map(bucket => ({ bucket, label: `${bucket}%`, count: counts.get(bucket) }));
}
function sectionRows(rows) {
  return [...groups(rows.filter(e => e.data.section), e => e.data.section)].map(([section, events]) => {
    const visits = unique(events.map(e => e.visit));
    const seconds = Math.round(events.filter(e => is(e, 'section_time')).reduce((sum, e) => sum + e.data.seconds, 0));
    const clicks = events.filter(e => is(e, 'pointer_cell') && e.data.kind === 'click').length;
    return { section, label: LABELS[section], visits, seconds, avgSeconds: visits ? Math.round(seconds / visits) : 0, clicks };
  }).sort((a, b) => b.seconds - a.seconds);
}
function heatmapRows(rows) {
  return [...groups(rows.filter(e => is(e, 'pointer_cell')), e => JSON.stringify([e.data.section,
    e.device, e.data.kind, e.data.col, e.data.row]))].map(([key, events]) => {
    const [section, device, kind, col, row] = JSON.parse(key);
    return { section, device, kind, col, row, count: events.length };
  });
}
function interestRows(rows) {
  return [...groups(rows.filter(e => is(e, 'interest')), e => e.data.item)].map(([item, events]) => ({
    item, label: item === 'other' ? '기타 항목' : LABELS[item], visits: unique(events.map(e => e.visit)), clicks: events.length,
  })).sort((a, b) => b.visits - a.visits || b.clicks - a.clicks);
}
function scrollRows(rows) {
  const denominator = unique(rows.map(e => e.visit));
  return [25, 50, 75, 90, 100].filter(depth => rows.some(e =>
    is(e, 'scroll_depth') && e.data.depth >= depth)).map(depth => {
    const visits = unique(rows.filter(e => is(e, 'scroll_depth') && e.data.depth >= depth).map(e => e.visit));
    return { depth, visits, rate: rate(visits, denominator) };
  });
}
function signalsFor(report) {
  const signals = [];
  if (!report.summary.visits) return [{ title: '아직 수집된 방문이 없습니다', detail: '수집이 시작되면 실제 방문 기록이 표시됩니다.', tone: 'neutral' }];
  const top = report.sections[0];
  if (top?.seconds > 0) signals.push({ title: `${top.label}에 오래 머물렀습니다`,
    detail: `관찰된 머문 시간 ${top.seconds}초 · 방문당 평균 ${top.avgSeconds}초`, tone: 'positive' });
  const interests = report.interests;
  if (interests[0]) signals.push({ title: `${LABELS[interests[0].item] ?? '해당 항목'} 클릭이 가장 많습니다`,
    detail: `해당 항목 클릭이 관찰된 방문 ${interests[0].visits}회 · 실제 매입 접수와는 다를 수 있습니다.`, tone: 'positive' });
  const drop = report.steps.filter(s => s.abandoned).sort((a, b) => b.abandoned - a.abandoned)[0];
  if (drop) signals.push({ title: `${drop.label}에서 작성 중단 추정`,
    detail: `마지막 활동 후 30분이 지난 미완료 ${drop.abandoned}건`, tone: 'warning' });
  if (report.summary.unknownRate > 0) signals.push({ title: '유입 경로를 확인할 수 없는 방문이 있습니다',
    detail: `전체 방문의 ${report.summary.unknownRate}% · 광고 링크에 구분 태그를 넣으면 확인이 쉬워집니다.`, tone: 'neutral' });
  if (report.quality.truncated) signals.push({ title: '조회량 한도에 도달했습니다',
    detail: '일부 기록만 집계했습니다. 날짜 범위를 줄여 다시 확인하세요.', tone: 'warning' });
  return signals;
}
function deviceRows(rows, options) {
  return ['mobile','desktop','tablet'].filter(device => !options.device || device === options.device).map(device => {
    const data = rows.filter(e => e.device === device), stats = summary(data);
    const home = data.filter(e => e.page === 'home'), homeVisits = unique(home.map(e => e.visit));
    const completed = unique(data.filter(e => is(e, 'form_success')).map(e => e.visit));
    return { device, label: { mobile:'모바일', desktop:'PC', tablet:'태블릿' }[device], ...stats,
      conversionRate: rate(completed, stats.visits),
      abandoned: stepRows(data, options.now ?? Date.now()).reduce((sum, step) => sum + step.abandoned, 0),
      homeScroll90Rate: rate(unique(home.filter(e => is(e, 'scroll_depth') && e.data.depth >= 90).map(e => e.visit)), homeVisits) };
  });
}
function deviceAttribution(events, options) {
  const selected = selectRows(events, options);
  const { first, rows: attributed } = attribution(selected, options.channel);
  const devices = new Map(), mixed = new Set();
  for (const e of attributed) {
    if (!devices.has(e.visit)) devices.set(e.visit, e.device);
    else if (devices.get(e.visit) !== e.device) mixed.add(e.visit);
  }
  const receipts = attributed.filter(e => !options.device || devices.get(e.visit) === options.device)
    .map(e => ({ ...e, device: devices.get(e.visit) }));
  return { first, receipts, mixed };
}
import {acquisitionReport} from './acquisition-report.js';
export function buildReport(events, options) {
  const { first, receipts, mixed } = deviceAttribution(events, options);
  // Attribution follows first server observation. Input state follows the actual browser activity sequence.
  const rows = [...receipts].sort(activityOrder);
  const s = summary(rows), channels = channelRows(rows, first);
  s.unknownRate = rate(channels.find(c => c.channel === 'unknown')?.visits ?? 0, s.visits);
  const report = { range: { from: options.range.from, to: options.range.to, days: options.range.days },
    updatedAt: new Date(options.now ?? Date.now()).toISOString(), mode: options.mode, summary: s,
    daily: [...groups(rows, date)].map(([day, data]) => ({ date: day, visits: unique(data.map(e => e.visit)),
      formSuccesses: unique(data.filter(e => is(e, 'form_success')).map(journey)) })).sort((a, b) => a.date.localeCompare(b.date)),
    channels, campaigns: campaignRows(rows, first), funnel: rows.length ? funnelRows(rows, s.visits) : [],
    filters: { device: options.device ?? 'all', channel: options.channel ?? 'all' },
    devices: deviceRows(rows, options),
    deviceChannels: ['mobile','desktop','tablet'].flatMap(device => channelRows(rows.filter(e => e.device === device), first).map(row => ({ ...row, device }))),
    steps: stepRows(rows, options.now ?? Date.now()), fields: fieldRows(rows), progress: progressRows(rows),
    sections: sectionRows(rows), interests: interestRows(rows), scroll: scrollRows(rows),
    scrollByPage: Object.fromEntries(['home', 'sale', 'purchase'].map(page =>
      [page, scrollRows(rows.filter(e => e.page === page))])),
    heatmap: heatmapRows(rows), signals: [], quality: { events: rows.length, mixedDeviceVisits: mixed.size,
      latestEventAt: receipts.at(-1)?.received_at ?? null, truncated: Boolean(options.truncated), notes: [
        '방문은 세션 기준이며 같은 사람이 다시 방문하면 새 방문으로 집계될 수 있습니다.',
        '기기는 브라우저 정보로 추정하며 창 크기 변경으로 같은 방문의 기기를 바꾸지 않습니다.',
        '과거에 기기가 섞인 방문은 조회 기간 내 처음 수신한 기기로 통일합니다. 과거 원본 기록은 보존합니다.',
        '전화·카카오 클릭은 실제 통화·상담 완료를 뜻하지 않습니다.',
        '접수 완료는 브라우저에서 성공 응답을 확인한 기록이며 실제 거래 완료와 다릅니다.',
        '접수는 같은 방문의 같은 종류 문의를 한 번으로 집계합니다.',
        '입력 완료율은 조회 기간 안에 시작한 입력 중 같은 기간에 접수 완료한 비율입니다.',
        '작성 중단은 마지막 활동 후 30분이 지난 미완료 입력의 추정입니다.',
        '입력 항목 완료율은 해당 항목에서 활동이 관찰된 입력 중 현재 값이 채워진 비율입니다.',
        '자동 방문·차단 프로그램·네트워크 실패에 따라 실제 사람의 활동과 차이가 날 수 있습니다.',
      ] } };
  Object.assign(report,acquisitionReport(rows,first,options.now ?? Date.now()));
  report.signals = signalsFor(report);
  return report;
}
