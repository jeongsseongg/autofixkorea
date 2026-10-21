import assert from 'node:assert/strict';
import {test} from 'node:test';
import {providerError,retryDecision} from '../supabase/functions/autofix-accident-intake/notification-state.ts';
import {telegram} from '../supabase/functions/autofix-accident-intake/telegram-transport.ts';
import {notifyGalleryReceipt} from '../supabase/functions/autofix-accident-intake/telegram.ts';
import {checkHealth} from '../supabase/functions/autofix-notification-worker/health.ts';
import {runRetries} from '../supabase/functions/autofix-notification-worker/worker.ts';
import {handleRequest} from '../supabase/functions/autofix-notification-worker/index.ts';

const target={chatId:'-1001234567890',threadId:8,forum:true,startsAt:'2026-10-20T00:00:00Z'};
const now=Date.parse('2026-10-21T12:00:00Z'),id='c895b0f4-8c58-4f9b-802f-2924a1aa12c5';
const workerKey='a'.repeat(64);
const secrets={SUPABASE_URL:'https://local.invalid',SUPABASE_SERVICE_ROLE_KEY:'service-test',AUTOFIX_TELEGRAM_BOT_TOKEN:'bot-test',
 AUTOFIX_TELEGRAM_FORUM_TARGETS:JSON.stringify({startsAt:target.startsAt,intake:{chatId:target.chatId,threadId:8},daily:{chatId:target.chatId,threadId:9}})};
const env=name=>secrets[name]||'';
const checkpoint=operations=>({version:3,digest:'frozen',receipt_layout:4,destination:{chatId:target.chatId,threadId:8},operations});
const row=progress=>({id,status:'complete',telegram_status:'pending',created_at:'2026-10-21T10:00:00Z',
 completed_at:'2026-10-21T10:00:00Z',telegram_error:null,values:{service:'accidentSale',contact:'01000000000',manufacturer:'local-test'},photos:[],telegram_message_id:progress?JSON.stringify(progress):null});
const decision=(value,options={})=>retryDecision(value,target,{context:null,now,...options});

test('provider errors retain only safe reason and retry delay',()=>{
 const frozen=providerError(400,{error_code:400,description:'Bad Request: FROZEN_METHOD_INVALID secret bot-test customer text'});
 assert.equal(frozen.message,'TELEGRAM_HTTP_400');assert.equal(frozen.reason,'FROZEN_METHOD_INVALID');
 assert.equal(JSON.stringify(frozen).includes('customer'),false);assert.equal(JSON.stringify(frozen).includes('bot-test'),false);
 const limited=providerError(429,{error_code:429,description:'Too Many Requests',parameters:{retry_after:240}});
 assert.equal(limited.retryAfter,240);assert.equal(limited.reason,'RATE_LIMITED');
});

test('checkpoint decisions preserve uncertain, sending, destination and format boundaries',()=>{
 for(const state of ['uncertain','sending'])assert.equal(decision(row(checkpoint({0:{state}}))).allowed,false);
 const moved=checkpoint({0:{state:'sent'}});moved.destination.threadId=99;
 assert.equal(decision(row(moved)).allowed,false);
 const format=checkpoint({});format.version=99;assert.equal(decision(row(format)).allowed,false);
 const bad=row(checkpoint({}));bad.telegram_error='NOTIFICATION_FORMAT_CHANGED';assert.equal(decision(bad).allowed,false);
 const old=row(null);old.created_at='2026-10-19T00:00:00Z';assert.equal(decision(old).allowed,false);
 assert.equal(decision(row(null),{context:{mode:'test'}}).allowed,false);
 assert.equal(decision(row(null),{context:{mode:'test'},includeTest:true}).allowed,true);
});

test('known 400 rejection can resume only after healthy worker; backoff and attempt cap hold',()=>{
 const rejected=row(checkpoint({0:{state:'blocked'}}));rejected.telegram_error='TELEGRAM_HTTP_400';
 assert.equal(decision(rejected).allowed,true);
 const progress=checkpoint({0:{state:'retryable'}});progress.reliability={attempts:1,nextAttemptAt:new Date(now+1000).toISOString()};
 assert.equal(decision(row(progress)).allowed,false);
 progress.reliability={attempts:3,nextAttemptAt:new Date(now-1000).toISOString()};assert.equal(decision(row(progress)).allowed,false);
});

test('expired row lease recovers only when no operation has an uncertain outcome',()=>{
 const stale={...row(null),telegram_status:'sending',telegram_claimed_at:new Date(now-301000).toISOString()};
 assert.equal(decision(stale).allowed,true);
 assert.equal(decision({...stale,telegram_claimed_at:new Date(now-1000).toISOString()}).allowed,false);
 for(const state of ['sending','uncertain'])assert.equal(decision({...stale,telegram_message_id:JSON.stringify(checkpoint({0:{state}}))}).allowed,false);
 const accepted=checkpoint({0:{state:'sent',providerId:{messageIds:[111]}}});
 assert.equal(decision({...stale,telegram_message_id:JSON.stringify(accepted)}).allowed,true);
});

test('health detects frozen membership without invoking send methods',async()=>{
 const methods=[];
 const health=await checkHealth(env,async(url)=>{
  const method=String(url).split('/').at(-1);methods.push(method);
  if(method==='getMe')return Response.json({ok:true,result:{id:123,is_bot:true}});
  if(method==='getChat')return Response.json({ok:true,result:{id:Number(target.chatId),is_forum:true}});
  return Response.json({ok:false,error_code:400,description:'Bad Request: FROZEN_METHOD_INVALID'},{status:400});
 });
 assert.equal(health.ok,false);assert.equal(health.reason,'FROZEN_METHOD_INVALID');
 assert.deepEqual(methods,['getMe','getChat','getChatMember']);
});

test('worker endpoint rejects anonymous and worker-key test replay; health is read-only',async()=>{
 let healthCalls=0;
 const services={env,health:async()=>{healthCalls++;return {ok:true};},rest:async(path,method,body)=>{
  if(path==='/rest/v1/rpc/autofix_analytics_daily_authorize')return body.p_secret===workerKey;
  throw Error('Only authorization may touch the DB during health');
 }};
 const request=(body,headers={})=>new Request('https://local.invalid',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
 assert.equal((await handleRequest(request({action:'retry'}),services)).status,401);
 assert.equal((await handleRequest(request({action:'health'}),services)).status,401);
 assert.equal((await handleRequest(request({action:'health'},{'x-worker-key':''}),{...services,env:()=>''})).status,401);
 assert.equal((await handleRequest(request({action:'health'},{'x-worker-key':'b'.repeat(64)}),services)).status,401);
 assert.equal((await handleRequest(request({action:'retry',ids:[id],includeTest:true},{'x-worker-key':workerKey}),services)).status,403);
 assert.equal((await handleRequest(request({action:'health'},{'x-worker-key':workerKey}),services)).status,200);
 assert.equal(healthCalls,1);
});

test('worker performs no DB writes or sends while bot is frozen',async()=>{
 let touched=0;
 const result=await runRetries({limit:2},{env,now:()=>now,health:async()=>({ok:false,reason:'FROZEN_METHOD_INVALID'}),rest:async()=>{touched++;},notify:async()=>{touched++;}});
 assert.equal(result.status,'health_blocked');assert.equal(touched,0);
});

test('worker claims no more than two live records and persists capped retry metadata',async()=>{
 const rows=[row(null),{...row(null),id:'6a02e6cb-322c-41c8-8376-a3bc7302d9fe'}, {...row(null),id:'970de44c-cb5a-4e8e-813b-52777f98d035'}];
 let sends=0,claims=0;const patches=[];
 const rest=async(path,method='GET',body)=>{
  if(path.includes('autofix_claim_telegram')){claims++;return true;}
  if(path.includes('autofix_intake_acquisition'))return [];
  if(method==='PATCH'){patches.push(body);const found=rows.find(r=>path.includes(r.id));Object.assign(found,body);return null;}
  if(path.includes('id=eq.'))return rows.filter(r=>path.includes(r.id));
  return rows;
 };
 const result=await runRetries({limit:2},{env,now:()=>now,health:async()=>({ok:true}),rest,notify:async()=>{sends++;return 'sent';}});
 assert.equal(sends,2);assert.equal(claims,2);assert.equal(result.processed,2);
 const saved=JSON.parse(patches[0].telegram_message_id).reliability;assert.equal(saved.attempts,1);assert.ok(Date.parse(saved.nextAttemptAt)>now);
 const seeded=JSON.parse(patches[0].telegram_message_id);assert.equal(seeded.receipt_layout,4);assert.equal(seeded.acquisition_format,true);
});

test('worker skips synthetic records unless authenticated explicit test ids were supplied',async()=>{
 let sends=0;
 const rest=async(path,method='GET')=>path.includes('autofix_claim_telegram')?true:path.includes('autofix_intake_acquisition')?[{context:{mode:'test'}}]:method==='PATCH'?null:[row(null)];
 const services={env,now:()=>now,health:async()=>({ok:true}),rest,notify:async()=>{sends++;return 'sent';}};
 await runRetries({limit:1},services);assert.equal(sends,0);
 await runRetries({ids:[id],includeTest:true,limit:1},services);assert.equal(sends,1);
});

test('excluded first page never hides an eligible later pending receipt',async()=>{
 const excluded=Array.from({length:10},()=>({...row(null),telegram_error:'TELEGRAM_OUTCOME_UNKNOWN'}));
 let sent=0;
 const rest=async(path,method='GET',body)=>{
  if(path.includes('autofix_claim_telegram'))return true;
  if(path.includes('autofix_intake_acquisition'))return [];
  if(method==='PATCH')return null;
  if(path.includes('id=eq.'))return [row(null)];
  return Number(new URL('https://local.invalid'+path).searchParams.get('offset')||0)===0?excluded:[row(null)];
 };
 const result=await runRetries({limit:1},{env,rest,now:()=>now,health:async()=>({ok:true}),notify:async()=>{sent++;return 'sent';}});
 assert.equal(sent,1);assert.equal(result.processed,1);
});

test('healthy text membership with denied photo or document permission is not ready',async()=>{
 for(const denied of ['can_send_photos','can_send_documents']){
  const health=await checkHealth(env,async(url)=>{
   const method=String(url).split('/').at(-1);
   if(method==='getMe')return Response.json({ok:true,result:{id:123,is_bot:true}});
   if(method==='getChat')return Response.json({ok:true,result:{id:Number(target.chatId),is_forum:true}});
   return Response.json({ok:true,result:{user:{id:123},status:'restricted',is_member:true,can_send_messages:true,can_send_photos:true,can_send_documents:true,[denied]:false}});
  });
  assert.equal(health.ok,false);assert.equal(health.reason,'HEALTH_MEDIA_PERMISSION_DENIED');
 }
});

test('timeout outcome is uncertain and provider reason remains sanitized',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>{throw Error('customer body and bot secret');};
 try{await assert.rejects(telegram('bot-test','sendMessage',{chat_id:target.chatId,text:'test'}),/TELEGRAM_OUTCOME_UNKNOWN/);}
 finally{globalThis.fetch=original;}
});

test('expired delivery budget never starts a Telegram request',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({ok:true,result:{message_id:1,chat:{id:Number(target.chatId)}}});};
 try{await assert.rejects(telegram('bot-test','sendMessage',{chat_id:target.chatId,text:'test'},1,Date.now()-1),/NOTIFICATION_BUDGET_PENDING/);assert.equal(calls,0);}
 finally{globalThis.fetch=original;}
});

test('400 resume skips every already accepted operation, then never sends the receipt twice',async()=>{
 const originalFetch=globalThis.fetch,originalDeno=globalThis.Deno,originalTimer=globalThis.setTimeout;
 globalThis.Deno={env:{get:env}};
 globalThis.setTimeout=(callback,delay,...args)=>originalTimer(callback,delay===1100?0:delay,...args);
 let current={...row(null),photos:[{path:id+'/0.png',size:12,mime:'image/png',category:'vehicle'}]},calls=0,nextId=100;
 globalThis.fetch=async(url,init)=>{
  if(String(url).includes('/storage/'))return new Response(new Uint8Array(12));
  calls++;const form=init?.body instanceof FormData,reply=form&&init.body.get('reply_parameters')?JSON.parse(init.body.get('reply_parameters')):null;
  return Response.json({ok:true,result:{message_id:nextId++,chat:{id:Number(target.chatId)},message_thread_id:8,...(reply?{reply_to_message:{message_id:reply.message_id}}:{})}});
 };
 const rest=async(path,method='GET',body)=>{
  if(path.includes('autofix_claim_telegram'))return current.telegram_status!=='sent';
  if(path.includes('autofix_intake_acquisition'))return [{context:null}];
  if(method==='PATCH'){Object.assign(current,body);return null;}return [structuredClone(current)];
 };
 try{
  assert.equal(await notifyGalleryReceipt(id,rest),'sent');const accepted=calls;
  assert.equal(await notifyGalleryReceipt(id,rest),'already_sent_or_busy');assert.equal(calls,accepted);
  assert.equal(accepted,2);const progress=JSON.parse(current.telegram_message_id);progress.operations[1]={state:'blocked'};
  current.telegram_status='pending';current.telegram_error='TELEGRAM_HTTP_400';current.telegram_message_id=JSON.stringify(progress);
  assert.equal(await notifyGalleryReceipt(id,rest,{resumeRejected:true}),'sent');assert.equal(calls,accepted+1);
  const stable=JSON.parse(current.telegram_message_id);stable.operations[0]={state:'uncertain'};
  current.telegram_status='pending';current.telegram_error='TELEGRAM_OUTCOME_UNKNOWN';current.telegram_message_id=JSON.stringify(stable);
  assert.equal(await notifyGalleryReceipt(id,rest,{resumeRejected:true}),'pending');assert.equal(calls,accepted+1);
  current=row(null);current.photos=[{path:id+'/0.png',size:12,mime:'image/png',category:'vehicle'}];
  const batchStart=calls;
  assert.equal(await notifyGalleryReceipt(id,rest,{maxOperations:1}),'pending');assert.equal(calls,batchStart+1);
  assert.equal(await notifyGalleryReceipt(id,rest,{maxOperations:1}),'sent');assert.equal(calls,batchStart+2);
 }finally{globalThis.fetch=originalFetch;globalThis.setTimeout=originalTimer;if(originalDeno===undefined)delete globalThis.Deno;else globalThis.Deno=originalDeno;}
});

test('real 429 delivery saves retry_after and refuses an immediate resend',async()=>{
 const originalFetch=globalThis.fetch,originalDeno=globalThis.Deno;globalThis.Deno={env:{get:env}};
 let current=row(null),calls=0;const before=Date.now();
 globalThis.fetch=async()=>{calls++;return Response.json({ok:false,error_code:429,description:'Too Many Requests',parameters:{retry_after:240}},{status:429});};
 const rest=async(path,method='GET',body)=>{
  if(path.includes('autofix_claim_telegram'))return true;
  if(path.includes('autofix_intake_acquisition'))return [];
  if(method==='PATCH'){Object.assign(current,body);return null;}return [structuredClone(current)];
 };
 try{
  assert.equal(await notifyGalleryReceipt(id,rest),'pending');const saved=JSON.parse(current.telegram_message_id);
  assert.equal(saved.operations[0].state,'retryable');assert.equal(saved.operations[0].error.retryAfter,240);
  assert.ok(Date.parse(saved.operations[0].retryAt)>=before+240000);
  assert.equal(await notifyGalleryReceipt(id,rest),'pending');assert.equal(calls,1);
 }finally{globalThis.fetch=originalFetch;if(originalDeno===undefined)delete globalThis.Deno;else globalThis.Deno=originalDeno;}
});
