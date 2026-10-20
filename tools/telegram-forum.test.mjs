import test from 'node:test';
import assert from 'node:assert/strict';
import {forumTarget,topicBody,targetMatches,bindCheckpoint,freezeDaily,readDaily} from '../supabase/functions/_shared/telegram-forum.js';
const targets={intake:{chatId:'-1001234567890',threadId:12},daily:{chatId:'-1001234567890',threadId:34}};
const env=raw=>name=>name==='AUTOFIX_TELEGRAM_FORUM_TARGETS'?raw:name==='AUTOFIX_TELEGRAM_CHAT_ID'?'123456':'';
const route=()=>forumTarget(env(JSON.stringify(targets)),'intake');
test('one atomic forum JSON validates both targets and rejects partial or unsafe settings',()=>{
 assert.deepEqual(route(),{...targets.intake,forum:true});
 for(const raw of ['{',JSON.stringify({intake:targets.intake}),JSON.stringify({...targets,daily:{chatId:'123',threadId:2}}),JSON.stringify({...targets,daily:{chatId:'-1001234567890',threadId:'2'}}),' ',JSON.stringify({...targets,other:{}})])assert.throws(()=>forumTarget(env(raw),'intake'),/TELEGRAM_FORUM_CONFIG_INVALID/);
 assert.equal(forumTarget(env(''),'daily').chatId,'123456');
});
test('JSON and multipart bodies carry the exact topic; conflicting destinations cannot fall back',()=>{
 const target=route(),original={chat_id:target.chatId,text:'test'};
 assert.equal(topicBody(target,original).message_thread_id,12);assert.equal(original.message_thread_id,undefined);
 const form=new FormData();form.set('chat_id',target.chatId);form.set('document',new Blob(['test']),'test.txt');
 const bound=topicBody(target,form);assert.equal(bound.get('message_thread_id'),'12');assert.equal(form.has('message_thread_id'),false);assert.ok(bound.get('document') instanceof Blob);
 assert.throws(()=>topicBody(target,{chat_id:'999'}),/TELEGRAM_DESTINATION_CONFLICT/);
 assert.throws(()=>topicBody(target,{chat_id:target.chatId,message_thread_id:34}),/TELEGRAM_DESTINATION_CONFLICT/);
});
test('ACK must contain actual target chat and thread, including every media-group member',()=>{
 const target=route();assert.equal(targetMatches({chat:{id:target.chatId},message_thread_id:12},target),true);
 for(const m of [{chat:{id:target.chatId}},{chat:{id:target.chatId},message_thread_id:34},{chat:{id:'-1009999999999'},message_thread_id:12}])assert.equal(targetMatches(m,target),false);
});
test('receipt checkpoints freeze destination and preserve sent/uncertain operations',()=>{
 const target=route(),fresh={operations:{}};bindCheckpoint(fresh,target);assert.deepEqual(fresh.destination,targets.intake);
 const saved={destination:targets.intake,operations:{0:{state:'sent'},1:{state:'uncertain'}}};bindCheckpoint(saved,target);assert.equal(saved.operations[1].state,'uncertain');
 assert.throws(()=>bindCheckpoint(saved,{...target,threadId:13}),/NOTIFICATION_DESTINATION_CHANGED/);
 assert.throws(()=>bindCheckpoint({operations:{0:{state:'sent'}}},target),/NOTIFICATION_DESTINATION_UNBOUND/);
 assert.doesNotThrow(()=>bindCheckpoint({operations:{0:{state:'sent'}}},forumTarget(env(''),'intake')));
});
test('daily frozen payload binds route without changing numeric message IDs or old records',()=>{
 const target={...targets.daily,forum:true},frozen=freezeDaily('보고 본문',target);
 assert.equal(readDaily(frozen,target),'보고 본문');assert.throws(()=>readDaily('옛 보고',target),/DAILY_DESTINATION_UNBOUND/);
 assert.throws(()=>readDaily(frozen,{...target,threadId:35}),/DAILY_DESTINATION_CHANGED/);
 assert.throws(()=>readDaily(frozen,forumTarget(env(''),'daily')),/DAILY_DESTINATION_CHANGED/);
 assert.equal(freezeDaily('옛 보고',forumTarget(env(''),'daily')),'옛 보고');
 assert.throws(()=>freezeDaily('x'.repeat(3600),target),/DAILY_ROUTE_PAYLOAD_TOO_LARGE/);
});
