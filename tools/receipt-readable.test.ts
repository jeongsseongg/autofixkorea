import {galleryOperations} from '../supabase/functions/autofix-accident-intake/telegram-gallery.ts';
import {receiptOperations} from '../supabase/functions/autofix-accident-intake/telegram-attachments.ts';
import {notifyGalleryReceipt} from '../supabase/functions/autofix-accident-intake/telegram.ts';
import fixture from './fixtures/intake-v24-plans.json' with {type:'json'};
const assert=(ok:unknown,message='assertion failed')=>{if(!ok)throw Error(message);};
const fresh=()=>({...structuredClone(fixture.row),telegram_message_id:null,photos:fixture.row.photos.slice(0,3),values:{...fixture.row.values,desired:'1200',ignition:'가능',driving:'불가',unknownQuestions:'fault,finance'}});
Deno.test('new receipt shows submitted answers in chat with clear labels and no automatic text file',()=>{
 const row=fresh(),operations=galleryOperations(row),body=operations.filter(o=>o.kind==='text').map(o=>o.text).join('');
 for(const text of ['사고차 매입','연락처: 010-0000-0000','차량: 현대 쏘나타','주행거리: 30,000 km','사고로 손상된 부위: 앞범퍼','시동 가능 여부: 가능','주행 가능 여부: 불가','희망가: 1,200 만원','고객 요청: 합성 원문 보존','첨부 사진: 3장','미확인 항목: 2개'])assert(body.includes(text),text);
 assert(!body.includes(row.id));assert(!/AF-|원본번호|\.txt|fault,finance/.test(body));assert(!body.includes('쏘나타 쏘나타'));
 assert(!operations.some(o=>['receipt','archive'].includes(o.kind)));
 const album=operations.find(o=>o.kind==='album');assert(album.indices.join(',')==='0,1,2');assert(album.replyToSummary===true);assert(album.caption==='현대 쏘나타\n차량 사진 1~3 / 3장');
 assert(operations[0].reply_markup.inline_keyboard.flat().some((b:any)=>b.copy_text?.text==='01000000000'));
});
Deno.test('long customer request is preserved across safe message-sized parts',()=>{
 const memo='장문의 고객 요청 🙂\n'.repeat(500),row={...fresh(),values:{...fresh().values,memo}};
 const parts=galleryOperations(row).filter(o=>o.kind==='text').map(o=>o.text),body=parts.join('');
 assert(parts.length>1);assert(parts.every(p=>p.length<=3500));assert(body.includes(memo));
 assert(parts.every(p=>!/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(p)));
});
Deno.test('frozen numeric-layout plans retain their exact serving digests',async()=>{
 for(const [name,plan]of [['gallery',galleryOperations],['legacy',receiptOperations]] as const){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(plan(fixture.row))));
  const digest=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');assert(digest===fixture.digests[name],name+' frozen format changed');
 }
});
Deno.test('readable receipt sends its body and three-photo reply once without a document',async()=>{
 const keys=['AUTOFIX_TELEGRAM_BOT_TOKEN','AUTOFIX_TELEGRAM_FORUM_TARGETS','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'],old=keys.map(k=>Deno.env.get(k));
 const originalFetch=globalThis.fetch,originalTimer=globalThis.setTimeout,calls:any[]=[];let current:any=fresh(),id=100;
 Deno.env.set(keys[0],'local-test');Deno.env.set(keys[1],JSON.stringify({startsAt:'2026-10-20T00:00:00Z',intake:{chatId:'-1001234567890',threadId:8},daily:{chatId:'-1001234567890',threadId:9}}));Deno.env.set(keys[2],'https://local.invalid');Deno.env.set(keys[3],'local-test');
 globalThis.setTimeout=((callback:any,ms?:number,...args:any[])=>originalTimer(callback,ms===1100?0:ms,...args)) as typeof setTimeout;
 globalThis.fetch=async(input,init)=>{
  if(String(input).includes('/storage/'))return new Response(new Uint8Array(12),{headers:{'content-type':'image/png'}});
  const body:any=init?.body instanceof FormData?Object.fromEntries(init.body.entries()):JSON.parse(String(init?.body)),method=String(input).split('/').at(-1);
  const reply=body.reply_parameters?JSON.parse(body.reply_parameters):null;calls.push({method,body,reply});
  const media=body.media?JSON.parse(body.media):null,messages=Array.from({length:media?.length||1},()=>({message_id:id++,chat:{id:-1001234567890},message_thread_id:8,...(reply?{reply_to_message:{message_id:reply.message_id}}:{}),...(method==='sendMediaGroup'?{media_group_id:'synthetic-album',photo:[{file_id:'synthetic'}]}:{reply_markup:body.reply_markup})}));
  return Response.json({ok:true,result:method==='sendMediaGroup'?messages:messages[0]});
 };
 const rest=async(path:string,method='GET',body:any=null)=>{
  if(path.includes('autofix_claim_telegram'))return current.telegram_status!=='sent';
  if(path.includes('autofix_intake_acquisition'))return [{context:null}];
  if(method==='PATCH'){current={...current,...body};return null;}return [structuredClone(current)];
 };
 try{
  assert(await notifyGalleryReceipt(current.id,rest)==='sent');assert(calls.length===2);assert(calls[0].method==='sendMessage');assert(calls[0].body.text.includes('희망가: 1,200 만원'));
  assert(calls[1].method==='sendMediaGroup');assert(calls[1].reply.message_id===100);assert(!calls.some(c=>c.method==='sendDocument'));
  const before=calls.length;assert(await notifyGalleryReceipt(current.id,rest)==='already_sent_or_busy');assert(calls.length===before);
 }finally{globalThis.fetch=originalFetch;globalThis.setTimeout=originalTimer;keys.forEach((k,i)=>old[i]===undefined?Deno.env.delete(k):Deno.env.set(k,old[i]!));}
});
