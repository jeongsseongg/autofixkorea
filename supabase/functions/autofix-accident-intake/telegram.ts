import {forumTarget,topicBody,bindCheckpoint,forumEligible} from '../_shared/telegram-forum.js';
import {receiptOperations,attachmentBody} from './telegram-attachments.ts';
import {telegram} from './telegram-transport.ts';
import {galleryOperations} from './telegram-gallery.ts';
type Rest=(path:string,method?:string,body?:unknown)=>Promise<any>;

// Recipients stay server-owned. Successful parts are never sent twice.
export async function notifyReceipt(id:string,rest:Rest){
 return deliverReceipt(id,rest,receiptOperations,2);
}
export async function notifyGalleryReceipt(id:string,rest:Rest){
 return deliverReceipt(id,rest,galleryOperations,3);
}
async function deliverReceipt(id:string,rest:Rest,plan:(row:any)=>any[],version:number){
 const target=forumTarget((name:string)=>Deno.env.get(name),'intake');
 const token=Deno.env.get('AUTOFIX_TELEGRAM_BOT_TOKEN'),chat=target.chatId;
 if(!token||!chat)return 'not_configured';
 const path='/rest/v1/autofix_accident_intakes?id=eq.'+id;
 if(target.forum){
  const queued=(await rest(path+'&select=created_at'))[0];
  if(!forumEligible(target,queued?.created_at))return 'before_forum_start';
 }
 if(!await rest('/rest/v1/rpc/autofix_claim_telegram','POST',{p_id:id}))return 'already_sent_or_busy';
 try{
  const row=(await rest(path+'&select=*'))[0];
  // Existing in-flight notifications keep their frozen format and checkpoints.
  let savedFormat=false;try{savedFormat=JSON.parse(row.telegram_message_id||'null')?.acquisition_format===true;}catch{/* checkpoint checked below */}
  if(!row.telegram_message_id||savedFormat){row.acquisition=null;
   try{row.acquisition=(await rest('/rest/v1/autofix_intake_acquisition?intake_id=eq.'+id+'&select=context'))[0]?.context??null;}
   catch{/* The enquiry is delivered even if analytics is unavailable. */}}
  const operations=plan(row);
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(operations)));
  const digest=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  let progress:any={version,digest,operations:{},summary_format:true,...(row.acquisition!==undefined?{acquisition_format:true}:{})};
  try{const saved=JSON.parse(row.telegram_message_id||'null');if(saved){
   if(saved.version===version){if(saved.digest!==digest)throw Error('NOTIFICATION_FORMAT_CHANGED');progress=saved;}
   else if(saved.version||saved.texts||saved.photos||typeof saved!=='object')throw Error('NOTIFICATION_FORMAT_CHANGED');
  }}catch(e){if(e instanceof Error&&e.message==='NOTIFICATION_FORMAT_CHANGED')throw e;throw Error('NOTIFICATION_CHECKPOINT_INVALID');}
  bindCheckpoint(progress,target);
  const save=()=>rest(path,'PATCH',{telegram_message_id:JSON.stringify(progress),telegram_claimed_at:new Date().toISOString()});
  await sendOperations(row,operations,progress,save,token,target);
  await rest(path,'PATCH',{telegram_status:'sent',telegram_sent_at:new Date().toISOString(),telegram_error:null});return 'sent';
 }catch(e){
  const raw=e instanceof Error?e.message:'';
  const code=/^(TELEGRAM_HTTP_\d+|TELEGRAM_OUTCOME_UNKNOWN|PHOTO_DOWNLOAD_FAILED|PHOTO_SIZE_MISMATCH|INVALID_PHOTO_PATH|INVALID_ARCHIVE_NAME|ARCHIVE_SIZE_LIMIT|NOTIFICATION_FORMAT_CHANGED|NOTIFICATION_CHECKPOINT_INVALID|NOTIFICATION_DESTINATION_CHANGED|NOTIFICATION_DESTINATION_UNBOUND|TELEGRAM_DESTINATION_CONFLICT)$/.test(raw)?raw:'TELEGRAM_DELIVERY_UNCONFIRMED';
  await rest(path,'PATCH',{telegram_status:'pending',telegram_error:code});console.error(JSON.stringify({traceId:id,code}));return 'pending';
 }
}
async function sendOperations(row:any,operations:any[],progress:any,save:()=>Promise<any>,token:string,target:any){
 const chat=target.chatId;
 for(const [index,operation] of operations.entries()){
  const previous=progress.operations[index];if(previous?.state==='sent')continue;
  if(previous&&previous.state!=='retryable')throw Error('TELEGRAM_OUTCOME_UNKNOWN');
  // Download before marking sending: a storage failure has sent nothing.
  const attachment=operation.kind==='text'?null:await attachmentBody(row,operation,chat,operation.asDocument===true);
  progress.operations[index]={state:'sending'};await save();
  let providerId;
  try{providerId=await sendOperation(row,operation,attachment,token,target);}
  catch(e){
   const code=e instanceof Error?e.message:'';
   progress.operations[index]={state:code==='TELEGRAM_HTTP_429'?'retryable':code==='TELEGRAM_OUTCOME_UNKNOWN'?'uncertain':'blocked'};await save();throw e;
  }
  progress.operations[index]={state:'sent',providerId};await save();
  await new Promise(r=>setTimeout(r,1100));
 }
}
async function sendOperation(row:any,operation:any,attachment:any,token:string,target:any){
 const chat=target.chatId;
 if(operation.kind==='text')return telegram(token,'sendMessage',topicBody(target,{chat_id:chat,text:operation.text,reply_markup:operation.reply_markup,link_preview_options:{is_disabled:true},protect_content:false}));
 try{return await telegram(token,attachment.method,topicBody(target,attachment.body),attachment.count);}
 catch(e){
  if(operation.kind!=='album'||!(e instanceof Error)||e.message!=='TELEGRAM_HTTP_400')throw e;
  const fallback=await attachmentBody(row,operation,chat,true);
  return telegram(token,fallback.method,topicBody(target,fallback.body),fallback.count);
 }
}
