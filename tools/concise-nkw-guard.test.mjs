import test from 'node:test';
import assert from 'node:assert/strict';
import {keywordLabel} from '../supabase/functions/autofix-analytics-daily/summary.js';
import {dailyMessage} from '../supabase/functions/autofix-analytics-daily/message.js';
const ids=['nkw-a001-01-000007521879486','nkw-synthetic-demo','nkwd-a001-01-000007521879486','kwd-a001-01-000007521879486','keyword-synthetic-demo'];
for(const id of ids)test(`advertising ID ${id.split('-')[0]} is not a search phrase (${id.includes('synthetic')?'synthetic':'numeric'})`,()=>{
 assert.equal(keywordLabel(id),'키워드명 미확인(ID만 수집)');
});
test('genuine search phrases and missing information retain their meanings',()=>{
 for(const text of ['사고차 매입','BMW 320d','nkw','수출 최고가'])assert.equal(keywordLabel(text),text);
 assert.equal(keywordLabel(undefined),'키워드 미수집');
});
test('daily keyword, abandoned and received source lines all hide nkw identifiers',()=>{
 const source={channel:'naver',medium:'paid',term:ids[0]};
 const report={quality:{truncated:false},summary:{formSuccesses:1},keywords:[{...source,visits:2}],journeyCount:2,journeys:[{source,state:'작성 중단 추정',lastStep:'contact',receipts:[]},{source,state:'접수 완료',receipts:['11111111-1111-4111-8111-111111111111']}],steps:[{step:'contact',label:'연락처'}]};
 const text=dailyMessage(report,{date:'2026-10-20',cutoff:'2026-10-20T14:59:00Z'});
 assert.doesNotMatch(text,/nkw-/);assert.equal(text.split('키워드명 미확인(ID만 수집)').length-1,3);
 assert.match(text,/서버 연결 접수 1건/);assert.match(text,/1방문/);
});
