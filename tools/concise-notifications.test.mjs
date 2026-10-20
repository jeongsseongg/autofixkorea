import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyMessage} from '../supabase/functions/autofix-analytics-daily/message.js';
const options={date:'2026-10-20',cutoff:'2026-10-20T14:59:00Z'};
function report(){return {mode:'test',quality:{truncated:false},summary:{visits:8,pageViews:12,avgEngagedSeconds:75,phoneClicks:2,kakaoClicks:1,formStarts:4,formSuccesses:2,formErrors:0,unknownRate:25},channels:[{label:'네이버',visits:6}],routes:[{abandoned:2}],keywords:[{channel:'naver',term:'사고차 매입',visits:5}],steps:[{step:'contact',label:'연락처',abandoned:2}],journeyCount:3,journeys:[{source:{channel:'naver',medium:'paid',term:'사고차 매입'},state:'작성 중단 추정',lastStep:'contact',receipts:[]},{source:{channel:'google',medium:'search'},state:'접수 완료',receipts:['11111111-1111-4111-8111-111111111111']},{source:{channel:'google',medium:'search'},state:'접수 완료',receipts:['11111111-1111-4111-8111-111111111111']}]};}
test('daily concise report separates browser from deduplicated server-linked receipts',()=>{
 const text=dailyMessage(report(),options);
 assert.ok(text.split('\n').length<=13);assert.match(text,/평균 체류 01:15/);
 assert.match(text,/서버 연결 접수 1건/);assert.match(text,/브라우저 성공 2건/);
 assert.match(text,/네이버 광고.*사고차 매입.*연락처.*1방문/);
 assert.match(text,/접수 유입.*구글.*1건/);assert.doesNotMatch(text,/11111111/);
 assert.match(text,/이후 1분 제외/);assert.match(text,/https:\/\/www.autofixkorea.com\/analytics\//);
});
test('missing and capped data never imply zero confirmed receipts',()=>{
 const r=report();r.journeyCount=200;delete r.summary.avgEngagedSeconds;
 let text=dailyMessage(r,options);assert.match(text,/서버 연결 접수 확인불가/);assert.match(text,/평균 체류 미수집/);
 delete r.journeys;delete r.routes;text=dailyMessage(r,options);assert.match(text,/중단 확인불가/);
 const empty=report();empty.journeys=[];empty.journeyCount=0;
 assert.match(dailyMessage(empty,options),/서버 연결 접수 미확인/);
 empty.summary.formSuccesses=0;assert.match(dailyMessage(empty,options),/서버 연결 접수 0건/);
});
test('daily limits privacy, length, final cutoff and truncated input',()=>{
 const r=report();r.keywords[0].term='가'.repeat(1000)+'01012345678';
 const text=dailyMessage(r,{...options,final:true});assert.ok(text.length<3000);assert.doesNotMatch(text,/01012345678/);
 assert.match(text,/하루 전체 확정/);assert.doesNotMatch(text,/이후 1분 제외/);
 r.quality.truncated=true;assert.throws(()=>dailyMessage(r,options),/REPORT_TRUNCATED/);
});
