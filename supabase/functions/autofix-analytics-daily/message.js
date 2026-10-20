import {problem} from '../autofix-analytics/contract.js';
import {count,plain,sourceLabel,journeySummary} from './summary.js';
const duration=value=>Number.isFinite(value)&&value>=0?`${String(Math.floor(value/60)).padStart(2,'0')}:${String(Math.floor(value%60)).padStart(2,'0')}`:'미수집';
export function dailyMessage(report,{date,cutoff,final=false}){
 if(report.quality?.truncated)throw problem('REPORT_TRUNCATED',422);
 const s=report.summary??{},time=new Date(Date.parse(cutoff)+9*3600000).toISOString().slice(11,16);
 const j=journeySummary(report);
 const channels=(report.channels??[]).slice(0,3).map(row=>`${plain(row.label)} ${count(row.visits)}회`).join(' · ')||'미수집';
 const keywords=(report.keywords??[]).slice(0,3).map(row=>`${sourceLabel(row)} ${plain(row.term)} ${count(row.visits)}방문`).join(' / ')||'미수집';
 const abandoned=Array.isArray(report.routes)&&report.routes.every(row=>Number.isFinite(row.abandoned))?report.routes.reduce((n,row)=>n+row.abandoned,0):null;
 const next=s.formErrors>0?'접수 오류 원인 확인':s.unknownRate>20?'출처 미확인 링크 태그 점검':j.abandoned!=='없음'&&j.abandoned!=='확인불가'?'중단 상위 단계의 입력 편의 점검':'유입별 서버 연결 접수 표본 누적';
 return [
  `[오토픽스코리아 · 일일 분석] ${date}${report.mode==='test'?' [TEST]':''}`,
  final?'집계 00:00~23:59 한국 시간 · 하루 전체 확정':`집계 00:00~${time} 한국 시간${time==='23:59'?' · 이후 1분 제외, 자정 갱신':''}`,
  `방문 ${count(s.visits)}회 · 열람 ${count(s.pageViews)}회 · 평균 체류 ${duration(s.avgEngagedSeconds)}`,
  `유입 TOP3: ${channels}`,
  `링크 수집 키워드: ${keywords}`,
  `폼 시작 ${count(s.formStarts)}건 · 중단 ${abandoned===null?'확인불가':count(abandoned)+'건(추정)'} · 서버 연결 접수 ${j.count}`,
  `브라우저 성공 ${count(s.formSuccesses)}건 · 전화 ${count(s.phoneClicks)}클릭 · 카카오 ${count(s.kakaoClicks)}클릭`,
  `중단 유입·키워드·마지막 단계 (방문 기준): ${j.abandoned}`,
  `접수 유입·키워드 (서버 연결 기준): ${j.received}`,
  `중단=30분 미활동 추정 · 클릭≠통화/대화 · 연결 접수≠전체 접수/거래 · 오류 ${count(s.formErrors)}건`,
  `다음 점검: ${next}`,
  '상세보기 (로그인 후 날짜 선택): https://www.autofixkorea.com/analytics/',
 ].join('\n');
}

