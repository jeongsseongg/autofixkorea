import {galleryOperations} from '../supabase/functions/autofix-accident-intake/telegram-gallery.ts';
import {receiptOperations,attachmentBody} from '../supabase/functions/autofix-accident-intake/telegram-attachments.ts';
import fixture from './fixtures/intake-v21-plans.json' with {type:'json'};
const assert=(ok:unknown,message='assertion failed')=>{if(!ok)throw Error(message);};
Deno.test('frozen grouped receipt keeps its Korean fields, model and authenticated direct link',()=>{
 const operations=galleryOperations({...fixture.row,photos:fixture.row.photos.slice(0,3),telegram_message_id:JSON.stringify({version:3,summary_format:true,receipt_layout:2,operations:{}})}),first=operations[0],text=first.text;
 assert(text.includes('\n\n차량\n'));assert(text.includes('\n\n연락처\n'));assert(text.includes('\n\n상태\n'));assert(text.includes('\n\n유입\n'));
 assert(text.includes('2026-10-20 22:55 KST'));assert(text.includes('현대 쏘나타'));assert(!text.includes('쏘나타 쏘나타'));
 assert(!text.split('\n').slice(0,3).join('').includes(fixture.row.id));assert(text.includes(fixture.row.id));
 const buttons=first.reply_markup.inline_keyboard.flat(),link=buttons.find((b:any)=>b.url)?.url;
 const url=new URL(link);assert(url.origin==='https://www.autofixkorea.com');assert(url.pathname==='/hub/');assert(url.searchParams.get('view')==='receipt');assert(url.hash==='#source=accident&id='+fixture.row.id);assert(buttons.some((b:any)=>b.copy_text?.text==='01000000000'));
 const album=operations.find((o:any)=>o.kind==='album');assert(album.replyToSummary===true);assert(album.caption.includes('현대 쏘나타'));assert(album.caption.includes('AF-1020-11111111'));
 assert(operations.find((o:any)=>o.kind==='receipt').text.includes('합성 원문 보존'));
});
Deno.test('every frozen v21 compact and legacy plan keeps its original digest',async()=>{
 for(const summary of [false,true])for(const [name,plan]of [['gallery',galleryOperations],['legacy',receiptOperations]] as const){
  const row={...fixture.row,telegram_message_id:JSON.stringify({version:name==='gallery'?3:2,summary_format:summary,operations:{}})};
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(plan(row)))),digest=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');assert(digest===(fixture.digests as any)[name+'-'+summary],name+' frozen plan changed');
 }
});
Deno.test('one, two and eleven photos preserve photo vs album splitting and original bytes',async()=>{
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(new Uint8Array(12),{headers:{'content-type':'image/png'}});
 try{for(const count of [1,2,11]){
  const row={...fixture.row,photos:fixture.row.photos.slice(0,count)},albums=galleryOperations(row).filter((o:any)=>o.kind==='album');assert(albums.length===(count===11?2:1));assert(albums.every((o:any)=>o.replyToSummary));
  for(const album of albums){const attachment=await attachmentBody(row,album,'-1001234567890');assert(attachment.method===(album.indices.length===1?'sendPhoto':'sendMediaGroup'));assert(attachment.count===album.indices.length);}
 }}finally{globalThis.fetch=oldFetch;}
});
