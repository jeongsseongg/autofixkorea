import {galleryOperations} from '../supabase/functions/autofix-accident-intake/telegram-gallery.ts';
import {receiptOperations} from '../supabase/functions/autofix-accident-intake/telegram-attachments.ts';
function assert(ok:unknown,message='assertion failed'):asserts ok{if(!ok)throw Error(message);}
const row={id:'11111111-1111-4111-8111-111111111111',created_at:'2026-10-20T10:00:00Z',values:{service:'accidentSale',contact:'01000000000',manufacturer:'현대',model:'테스트',damagePart:'전면',longMemo:'원문보존'.repeat(300)},photos:[{path:'x',size:100,mime:'image/png',category:'vehicle'}]};
Deno.test('accident concise text retains original document, gallery and phone copy',()=>{
 for(const plan of [galleryOperations(row),receiptOperations(row)]){
  const texts=plan.filter(o=>o.kind==='text');assert(texts.length===1);
  assert(texts[0].text.split('\n').length<=8);assert(texts[0].text.includes('https://www.autofixkorea.com/hub/'));
  assert(texts[0].reply_markup.inline_keyboard[0][0].copy_text.text==='01000000000');
  assert(!texts[0].text.includes(row.values.longMemo));assert(plan.find(o=>o.kind==='receipt').text.includes(row.values.longMemo));
  assert(plan.find(o=>o.kind==='album').indices[0]===0);
 }
});
Deno.test('channel concise notification preserves topic, cutoff and original input',async()=>{
 const envKeys=['AUTOFIX_TELEGRAM_BOT_TOKEN','AUTOFIX_TELEGRAM_FORUM_TARGETS'];
 const old=envKeys.map(k=>Deno.env.get(k)),originalFetch=globalThis.fetch;
 Deno.env.set(envKeys[0],'synthetic-local-token');Deno.env.set(envKeys[1],JSON.stringify({startsAt:'2026-10-20T00:00:00Z',intake:{chatId:'-1001234567890',threadId:8},daily:{chatId:'-1001234567890',threadId:9}}));
 const calls:{method:string,body:any}[]=[];
 globalThis.fetch=async(input,init)=>{const body=JSON.parse(String(init?.body));calls.push({method:String(input).split('/').at(-1)!,body});return Response.json({ok:true,result:{message_id:1,chat:{id:-1001234567890},message_thread_id:8}});};
 try{
  const {notify}=await import('../supabase/functions/autofix-channel-intake/telegram.ts');
  const value={id:row.id,channel:'telegram',created_at:row.created_at,fields:{name:'TEST',message:'고객원문'.repeat(400),contact:{phone_number:'01000000000'}}};
  const before=JSON.stringify(value);assert(await notify(value,{chat:123,messageId:44},[])==='sent');
  assert(calls.length===1);assert(calls[0].method==='sendMessage');assert(calls[0].body.message_thread_id===8);
  assert(calls[0].body.text.split('\n').length<=8);assert(calls[0].body.text.length<1200);
  assert(calls[0].body.reply_markup.inline_keyboard[0][0].copy_text.text==='01000000000');assert(JSON.stringify(value)===before);
  calls.length=0;assert(await notify({...value,created_at:'2026-10-19T00:00:00Z'},null,[])==='before_forum_start');assert(calls.length===0);
  globalThis.fetch=async()=>Response.json({ok:true,result:{message_id:2,chat:{id:-1001234567890},message_thread_id:999}});
  let failed=false;try{await notify(value,null,[]);}catch(error){failed=String(error).includes('TELEGRAM_OUTCOME_UNKNOWN');}assert(failed);
 }finally{globalThis.fetch=originalFetch;envKeys.forEach((key,i)=>old[i]===undefined?Deno.env.delete(key):Deno.env.set(key,old[i]!));}
});
