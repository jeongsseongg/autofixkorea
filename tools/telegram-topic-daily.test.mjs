import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyTelegram} from '../supabase/functions/autofix-analytics-daily/telegram.js';
import {createDailyHandler} from '../supabase/functions/autofix-analytics-daily/handler.js';
import {finalizeDaily} from '../supabase/functions/autofix-analytics-daily/finalize.js';
import {dailyRequest,messageHash} from '../supabase/functions/autofix-analytics-daily/contract.js';
const targets=JSON.stringify({intake:{chatId:'-1001234567890',threadId:12},daily:{chatId:'-1001234567890',threadId:34}});
const setup=fetchImpl=>dailyTelegram({token:'123:synthetic',chatId:'123456',forumTargets:targets,fetchImpl});
const ack=(body,extra={})=>Response.json({ok:true,result:{message_id:7,chat:{id:body.chat_id},message_thread_id:body.message_thread_id,text:body.text,...extra}});
test('daily send and edit use exact topic, strip stored route marker, and reject a wrong-thread ACK',async()=>{
 const calls=[],t=setup(async(url,init)=>{const b=JSON.parse(init.body);calls.push({url,b});return ack(b,url.endsWith("/editMessageText")?{message_thread_id:34}:{});});
 const frozen=t.freeze('보고');const sent=await t.send({text:frozen});assert.equal(sent.accepted,true);assert.equal(calls[0].b.text,'보고');assert.equal(calls[0].b.message_thread_id,34);
 assert.equal((await t.edit({id:'7',text:t.freeze('확정')})).accepted,true);assert.equal(calls[1].b.message_id,7);assert.equal(calls[1].b.message_thread_id,undefined);
 const wrong=setup(async(_url,init)=>ack(JSON.parse(init.body),{message_thread_id:12}));await assert.rejects(()=>wrong.send({text:wrong.freeze('보고')}),/TELEGRAM_OUTCOME_UNKNOWN/);
});
test('forum edit refuses old unbound report IDs before HTTP and never accepts unverifiable unchanged response',async()=>{
 let calls=0;const t=setup(async()=>{calls++;return Response.json({ok:false,error_code:400,description:'Bad Request: message is not modified'},{status:400});});
 await assert.rejects(()=>t.edit({id:'7',text:'옛 보고'}),/DAILY_DESTINATION_UNBOUND/);assert.equal(calls,0);
 assert.equal((await t.edit({id:'7',text:t.freeze('보고')})).accepted,false);
});
test('bad atomic config is rejected before a daily queue claim or network send',async()=>{
 let claims=0,calls=0;const t=dailyTelegram({token:'123:synthetic',chatId:'123456',forumTargets:'{',fetchImpl:async()=>{calls++;throw Error('not reached');}});
 const handler=createDailyHandler({store:{claim(){claims++;}},transport:t,secret:'test',now:()=>new Date('2026-10-20T15:01:00Z'),log:()=>{}});
 const r=await handler(new Request('https://local.invalid/autofix-analytics-daily/run',{method:'POST',headers:{'content-type':'application/json','x-autofix-analytics-secret':'test'},body:JSON.stringify({date:'2026-10-20',mode:'test'})}));
 assert.equal(r.status,503);assert.equal((await r.json()).code,'TELEGRAM_FORUM_CONFIG_INVALID');assert.equal(claims,0);assert.equal(calls,0);
});
test('midnight finalization blocks a legacy or changed destination before begin/edit; bound primary works',async()=>{
 const now=new Date('2026-10-21T00:00:00Z'),input=dailyRequest({date:'2026-10-20',mode:'test'},now);
 for(const kind of ['legacy','changed','bound']){
  let begin=0,edits=0,finished;const t=setup(async(_url,init)=>{edits++;return ack(JSON.parse(init.body),{message_thread_id:34});});
  const primary=kind==='legacy'?'옛 보고':kind==='changed'?t.freeze('보고').replace(':34\n',':35\n'):t.freeze('보고');
  const final=t.freeze('확정');const claim={status:'claimed',final_token:'synthetic',message_id:'7',message_text:primary,message_hash:await messageHash(primary),final_text:final,final_hash:await messageHash(final)};
  const store={claimFinal:async()=>claim,beginFinal:async()=>{begin++;},finishFinal:async v=>{finished=v;}};
  const invoke=()=>finalizeDaily(input,{store,transport:t,now,traceId:'synthetic'});
  if(kind==='bound'){assert.equal((await invoke()).status,'finalized');assert.equal(edits,1);assert.equal(begin,1);}
  else{await assert.rejects(invoke,/DAILY_DESTINATION_(UNBOUND|CHANGED)/);assert.equal(edits,0);assert.equal(begin,0);assert.equal(finished.status,'blocked');}
 }
});
test('unset config retains original daily bot and recipient behavior including unchanged ACK',async()=>{
 const calls=[],t=dailyTelegram({token:'123:original',chatId:'123456',fetchImpl:async(url,init)=>{const b=JSON.parse(init.body);calls.push({url,b});return ack(b);}});
 assert.equal((await t.send({text:'원래 보고'})).accepted,true);assert.equal(calls[0].b.chat_id,'123456');assert.equal(calls[0].b.message_thread_id,undefined);assert.ok(calls[0].url.includes('123:original'));
});
