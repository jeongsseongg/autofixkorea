import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyMessage} from '../supabase/functions/autofix-analytics-daily/message.js';
test('opaque advertising IDs are never presented as a known search phrase',()=>{
 const source={channel:'naver',medium:'paid',term:'kwd-a001-01-00000999999'};
 const report={quality:{truncated:false},summary:{formSuccesses:0},keywords:[{...source,visits:2}],journeyCount:1,journeys:[{source,state:'작성 중단 추정',lastStep:'contact',receipts:[]}],steps:[{step:'contact',label:'연락처'}]};
 const text=dailyMessage(report,{date:'2026-10-20',cutoff:'2026-10-20T14:59:00Z'});
 assert.match(text,/키워드명 미확인\(ID만 수집\)/);assert.doesNotMatch(text,/kwd-a001/);
});
