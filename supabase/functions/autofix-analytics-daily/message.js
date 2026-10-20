import { ITEMS, problem } from '../autofix-analytics/contract.js';
const number = value => Number.isFinite(value) && value >= 0 ? value.toLocaleString('ko-KR') : '0';
const actions = new Set(['other', 'sale', 'purchase', 'repair', 'warranty', 'photos', 'price', 'process',
  'faq', 'location', 'trade', 'comparison', 'review', 'blog', 'campaign']);
const brandIds = new Set(ITEMS.filter(item => !actions.has(item)));
export function dailyMessage(report, { date, cutoff, final = false }) {
  if (report.quality.truncated) throw problem('REPORT_TRUNCATED', 422);
  const s = report.summary, time = new Date(Date.parse(cutoff) + 9 * 3600000).toISOString().slice(11, 16);
  const channels = report.channels.slice(0, 3).map(row => `${row.label} ${number(row.visits)}회`).join(' · ') || '기록 없음';
  const section = report.sections.find(row => row.seconds > 0), interest = report.interests.find(row => brandIds.has(row.item));
  const abandoned = report.steps.reduce((sum, step) => sum + step.abandoned, 0);
  return [ `${report.mode === 'test' ? '[테스트] ' : ''}오토픽스코리아 오늘의 요약 · ${date}`,
    final ? '집계 00:00~23:59 · 한국 시간 (하루 전체 확정)' : `집계 00:00~${time} · 한국 시간${time === '23:59' ? ' (이후 1분 제외 · 자정에 전체 집계로 갱신)' : ''}`,
    `방문 ${number(s.visits)}회 · 페이지 조회 ${number(s.pageViews)}회`, `유입 TOP: ${channels}`,
    report.devices?.length ? `기기별 방문: ${report.devices.map(row => `${row.label} ${number(row.visits)}회`).join(' · ')}` : '',
    `전화 ${number(s.phoneClicks)}클릭 · 카카오 ${number(s.kakaoClicks)}클릭`,
    `입력 시작 ${number(s.formStarts)}건 · 접수 ${number(s.formSuccesses)}건 · 작성 완료율 ${number(s.formCompletionRate)}%`,
    `오래 본 곳: ${section ? `${section.label} · 방문당 평균 ${number(section.avgSeconds)}초` : '기록 없음'}`,
    `관심 서비스: ${interest ? `${interest.label} · ${number(interest.visits)}회` : '기록 없음'}`,
    `작성 중단 추정 ${number(abandoned)}건 · 접수 오류 ${number(s.formErrors)}건`,
    `유입 경로 미확인 ${number(s.unknownRate)}%`,
    ...(report.routes||[]).slice(0,8).map(row=>`${row.label}: 방문 ${number(row.visits)} · 전화 ${number(row.phoneClicks)} · 카카오 ${number(row.kakaoClicks)} · 작성 ${number(row.starts)} · 접수 ${number(row.submits)} · 중단 추정 ${number(row.abandoned)}`),
    report.routes?.length>8 ? `나머지 유입 경로 ${number(report.routes.length-8)}개: https://www.autofixkorea.com/analytics/ 에서 확인` : '',
    ...(report.steps||[]).filter(row=>row.abandoned).slice(0,5).map(row=>`중단 단계: ${row.label} ${number(row.abandoned)}건`),
    (report.keywords||[]).length ? `광고 키워드 TOP: ${report.keywords.slice(0,5).map(row=>row.term+' (방문 '+number(row.visits)+' · 접수 '+number(row.submits)+')').join(' / ')}` : '광고 키워드: 아직 구분 정보가 수집되지 않았습니다.',
    report.cumulative ? `전체 누적: 방문 ${number(report.cumulative.visits)} · 접수 ${number(report.cumulative.formSuccesses)} · 전화 ${number(report.cumulative.phoneClicks)} · 카카오 ${number(report.cumulative.kakaoClicks)}` : '',
    !s.visits ? '수집된 방문이 없습니다. 수집 상태를 함께 확인하세요.' : '',
    '접수는 같은 방문의 같은 종류 문의를 한 번으로 집계합니다. 거래 완료와는 다릅니다.',
    '작성 중단은 마지막 활동 후 30분이 지난 미완료 입력의 추정입니다.',
  ].filter(Boolean).join('\n');
}

