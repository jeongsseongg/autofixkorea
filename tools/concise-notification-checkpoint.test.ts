import {galleryOperations} from '../supabase/functions/autofix-accident-intake/telegram-gallery.ts';
import {notifyGalleryReceipt} from '../supabase/functions/autofix-accident-intake/telegram.ts';
function assert(ok:unknown):asserts ok{if(!ok)throw Error('assertion failed');}
const row={id:'11111111-1111-4111-8111-111111111111',created_at:'2026-10-20T10:00:00Z',values:{service:'accidentSale',contact:'01000000000',memo:'이전 접수 원문'},photos:[]};
Deno.test('existing checkpoint format stays intact; summary marker survives a retry',()=>{
 const old=galleryOperations({...row,telegram_message_id:JSON.stringify({version:3,digest:'old',operations:{}})});
 const fresh=galleryOperations({...row,telegram_message_id:JSON.stringify({version:3,summary_format:true,operations:{}})});
 assert(old[0].text.includes('이전 접수 원문'));assert(!fresh[0].text.includes('이전 접수 원문'));
});
Deno.test('new concise checkpoint is frozen before sending and can be retried without sends',async()=>{
 const keys=['AUTOFIX_TELEGRAM_BOT_TOKEN','AUTOFIX_TELEGRAM_CHAT_ID','AUTOFIX_TELEGRAM_FORUM_TARGETS'];
 const old=keys.map(k=>Deno.env.get(k)),fetchOriginal=globalThis.fetch;
 Deno.env.set(keys[0],'local-test');Deno.env.set(keys[1],'-1001234567890');Deno.env.delete(keys[2]);
 let current:any={...row},sends=0,first=true;
 const rest=async(path:string,method='GET',body:any=null)=>{
  if(path.includes('/rpc/'))return true;
  if(method==='PATCH'){current={...current,...body};return null;}
  return [structuredClone(current)];
 };
 globalThis.fetch=async()=>{sends++;throw Error('NETWORK_UNCERTAIN');};
 try{
  assert(await notifyGalleryReceipt(row.id,rest)==='pending');
  const checkpoint=JSON.parse(current.telegram_message_id);assert(checkpoint.summary_format===true);assert(sends===1);
  const digest=checkpoint.digest;first=false;
  assert(await notifyGalleryReceipt(row.id,rest)==='pending');
  assert(JSON.parse(current.telegram_message_id).digest===digest);assert(sends===1);
 }finally{globalThis.fetch=fetchOriginal;keys.forEach((k,i)=>old[i]===undefined?Deno.env.delete(k):Deno.env.set(k,old[i]!));}
});
