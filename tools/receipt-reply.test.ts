import {notifyGalleryReceipt} from '../supabase/functions/autofix-accident-intake/telegram.ts';
import {receiptLayout} from '../supabase/functions/autofix-accident-intake/telegram-receipt-display.ts';
import {telegram} from '../supabase/functions/autofix-accident-intake/telegram-transport.ts';
import fixture from './fixtures/intake-v21-plans.json' with {type:'json'};
const assert=(ok:unknown,message='assertion failed')=>{if(!ok)throw Error(message);};
for(const count of [1,2,11])Deno.test(`receipt ${count} photos reply to the accepted summary without duplicate sends`,async()=>{
 const keys=['AUTOFIX_TELEGRAM_BOT_TOKEN','AUTOFIX_TELEGRAM_FORUM_TARGETS','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'],old=keys.map(k=>Deno.env.get(k));
 const fetchOriginal=globalThis.fetch,timerOriginal=globalThis.setTimeout;
 Deno.env.set(keys[0],'local-test');Deno.env.set(keys[1],JSON.stringify({startsAt:'2026-10-20T00:00:00Z',intake:{chatId:'-1001234567890',threadId:8},daily:{chatId:'-1001234567890',threadId:9}}));Deno.env.set(keys[2],'https://local.invalid');Deno.env.set(keys[3],'local-test');
 globalThis.setTimeout=((callback:any,ms?:number,...args:any[])=>timerOriginal(callback,ms===1100?0:ms,...args)) as typeof setTimeout;
 let current:any=structuredClone({...fixture.row,photos:fixture.row.photos.slice(0,count)}),messageId=100;const expectedLayout=receiptLayout(current);
 const calls:any[]=[];
 globalThis.fetch=async(input,init)=>{
  if(String(input).includes('/storage/'))return new Response(new Uint8Array(12),{headers:{'content-type':'image/png'}});
  const form=init?.body instanceof FormData,body:any=form?Object.fromEntries((init!.body as FormData).entries()):JSON.parse(String(init?.body));
  const reply=form&&body.reply_parameters?JSON.parse(body.reply_parameters):body.reply_parameters;
  const method=String(input).split('/').at(-1),media=body.media?JSON.parse(body.media):null;
  calls.push({method,reply,body});
  const messages=Array.from({length:media?.length??1},()=>({message_id:messageId++,chat:{id:-1001234567890},message_thread_id:8,...(reply?{reply_to_message:{message_id:reply.message_id}}:{}),...(method==='sendMediaGroup'?{media_group_id:'album-'+messageId}:{}),...(method==='sendMessage'?{reply_markup:body.reply_markup}:method==='sendDocument'?{document:{file_id:'test'}}:{photo:[{file_id:'test'}]})}));
  if(method==='sendMediaGroup')messages.forEach(m=>m.media_group_id='album');return Response.json({ok:true,result:method==='sendMediaGroup'?messages:messages[0]});
 };
 const rest=async(path:string,method='GET',body:any=null)=>{
  if(path.includes('autofix_claim_telegram'))return current.telegram_status!=='sent';
  if(path.includes('autofix_intake_acquisition'))return [{context:null}];
  if(method==='PATCH'){current={...current,...body};return null;}return [structuredClone(current)];
 };
 try{
  assert(await notifyGalleryReceipt(current.id,rest)==='sent');const checkpoint=JSON.parse(current.telegram_message_id);assert(checkpoint.receipt_layout===expectedLayout);
  const pictures=calls.filter(c=>['sendPhoto','sendMediaGroup'].includes(c.method));assert(pictures.length===(count===11?2:1));assert(pictures.every(c=>c.reply?.message_id===100));
  assert(calls.find(c=>c.method==='sendDocument').reply?.message_id===100);assert(calls[0].body.reply_markup.inline_keyboard.flat().some((b:any)=>b.url));
  const sent=calls.length;assert(await notifyGalleryReceipt(current.id,rest)==='already_sent_or_busy');assert(calls.length===sent);
 }finally{globalThis.fetch=fetchOriginal;globalThis.setTimeout=timerOriginal;keys.forEach((k,i)=>old[i]===undefined?Deno.env.delete(k):Deno.env.set(k,old[i]!));}
});
Deno.test('reply acknowledgement mismatch is uncertain and never accepted as connected',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({ok:true,result:{message_id:2,chat:{id:-1001234567890},message_thread_id:8,reply_to_message:{message_id:999},photo:[{file_id:'test'}]}});
 try{let rejected=false;try{await telegram('local-test','sendPhoto',{chat_id:'-1001234567890',message_thread_id:8,reply_parameters:{message_id:100}},1);}catch(error){rejected=String(error).includes('TELEGRAM_OUTCOME_UNKNOWN');}assert(rejected);}finally{globalThis.fetch=original;}
});
