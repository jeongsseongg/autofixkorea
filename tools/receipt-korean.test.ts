import {galleryOperations} from '../supabase/functions/autofix-accident-intake/telegram-gallery.ts';
import {receiptOperations,attachmentBody} from '../supabase/functions/autofix-accident-intake/telegram-attachments.ts';
import {receiptIdentity} from '../supabase/functions/autofix-accident-intake/telegram-receipt-display.ts';
import fixture from './fixtures/intake-v22-plans.json' with {type:'json'};
const assert=(ok:unknown,message='assertion failed')=>{if(!ok)throw Error(message);};
const fresh=()=>({...structuredClone(fixture.row),telegram_message_id:JSON.stringify({version:3,summary_format:true,receipt_layout:3,operations:{}}),acquisition:{visit:'22222222-2222-4222-8222-222222222222',view:'33333333-3333-4333-8333-333333333333',device:'desktop',mode:'live',source:{channel:'unknown',medium:'unknown',confidence:'unknown',tagged:false}}});
Deno.test('numeric-layout notification and text file hide internal IDs and use Korean labels',async()=>{
 const row=fresh(),operations=galleryOperations(row),summary=operations[0],receipt=operations.find(o=>o.kind==='receipt'),identity=receiptIdentity(row);
 assert(/^\d{8}-\d{10}$/.test(identity.label));assert(identity.time.endsWith('한국 시간'));
 for(const text of [summary.text,receipt.text,receipt.caption]){
  assert(!text.includes(row.id));assert(!text.includes(row.acquisition.visit));assert(!/AF-|KST|원본번호/.test(text));
 }
 assert(summary.text.includes('접속 기기: 컴퓨터'));assert(receipt.text.includes('합성 원문 보존'));
 assert(summary.reply_markup.inline_keyboard.flat().some((b:any)=>b.copy_text?.text==='01000000000'));
 const url=new URL(summary.reply_markup.inline_keyboard.flat().find((b:any)=>b.url).url);
 assert(url.origin==='https://www.autofixkorea.com');assert(url.hash.endsWith(row.id));
 const attachment=await attachmentBody(row,receipt,'-1001234567890'),file=attachment.body.get('document') as File;
 assert(/^접수-\d{8}-\d{10}-접수내용\.txt$/.test(file.name));assert((await file.text()).includes('합성 원문 보존'));
});
Deno.test('zero attached photos are explicit and never create an empty album',()=>{
 const row={...fresh(),photos:[],values:{...fixture.row.values,vehiclePhotosLater:true}},operations=galleryOperations(row);
 assert(operations[0].text.includes('사진 미첨부 · 추후 제출 선택'));assert(!operations.some(o=>o.kind==='album'));
 assert(operations.some(o=>o.kind==='receipt'));
 const withoutLater=galleryOperations({...row,values:{...row.values,vehiclePhotosLater:false}});
 assert(withoutLater[0].text.includes('사진 미첨부'));assert(!withoutLater[0].text.includes('추후 제출 선택'));
});
Deno.test('frozen grouped notification plans retain both exact existing digests',async()=>{
 for(const [name,plan]of [['gallery',galleryOperations],['legacy',receiptOperations]] as const){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(plan(fixture.row))));
  const digest=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  assert(digest===fixture.digests[name],name+' frozen plan changed');
 }
});
Deno.test('new three-photo album keeps every original byte and has Korean filenames',async()=>{
 const oldFetch=globalThis.fetch,bytes=Uint8Array.from({length:12},(_,i)=>i);
 globalThis.fetch=async()=>new Response(bytes,{headers:{'content-type':'image/png'}});
 try{
  const row={...fresh(),photos:fixture.row.photos.slice(0,3)},album=galleryOperations(row).find(o=>o.kind==='album');
  assert(album.indices.join(',')==='0,1,2');assert(album.replyToSummary===true);
  const attachment=await attachmentBody(row,album,'-1001234567890');assert(attachment.method==='sendMediaGroup');assert(attachment.count===3);
  for(const [key,file]of attachment.body.entries())if(file instanceof File){
   assert(/^접수-\d{8}-\d{10}-차량사진-\d{2}\.png$/.test(file.name));
   assert([...new Uint8Array(await file.arrayBuffer())].join(',')===[...bytes].join(','),key+' bytes changed');
  }
 }finally{globalThis.fetch=oldFetch;}
});
