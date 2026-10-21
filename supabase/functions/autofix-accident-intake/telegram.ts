import {forumTarget,topicBody,bindCheckpoint,forumEligible} from '../_shared/telegram-forum.js';
import {receiptOperations,attachmentBody} from './telegram-attachments.ts';
import {telegram} from './telegram-transport.ts';
import {galleryOperations} from './telegram-gallery.ts';
import {receiptLayout} from './telegram-receipt-display.ts';
import {failureDetails} from './notification-state.ts';
type Rest=(path:string,method?:string,body?:unknown)=>Promise<any>;
type Options={claimed?:boolean,resumeRejected?:boolean,maxOperations?:number,deadline?:number};

// Recipients stay server-owned. Successful parts are never sent twice.
export async function notifyReceipt(id:string,rest:Rest,options:Options={}){
 return deliverReceipt(id,rest,receiptOperations,2,options);
}
export async function notifyGalleryReceipt(id:string,rest:Rest,options:Options={}){
 return deliverReceipt(id,rest,galleryOperations,3,options);
}
async function deliverReceipt(id:string,rest:Rest,plan:(row:any)=>any[],version:number,options:Options){
 const target=forumTarget((name:string)=>Deno.env.get(name),'intake');
 const token=Deno.env.get('AUTOFIX_TELEGRAM_BOT_TOKEN'),chat=target.chatId;
 if(!token||!chat)return 'not_configured';
 const path='/rest/v1/autofix_accident_intakes?id=eq.'+id;
 if(target.forum){
  const queued=(await rest(path+'&select=created_at'))[0];
  if(!forumEligible(target,queued?.created_at))return 'before_forum_start';
 }
 if(!options.claimed&&!await rest('/rest/v1/rpc/autofix_claim_telegram','POST',{p_id:id}))return 'already_sent_or_busy';
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
  let progress:any={version,digest,operations:{},summary_format:true,receipt_layout:receiptLayout(row),...(row.acquisition!==undefined?{acquisition_format:true}:{})};
  try{const saved=JSON.parse(row.telegram_message_id||'null');if(saved){
   if(saved.version===version){if(saved.digest!==digest)throw Error('NOTIFICATION_FORMAT_CHANGED');progress=saved;}
   else if(saved.version||saved.texts||saved.photos||typeof saved!=='object')throw Error('NOTIFICATION_FORMAT_CHANGED');
   else if(saved.reliability)progress.reliability=saved.reliability;
  }}catch(e){if(e instanceof Error&&e.message==='NOTIFICATION_FORMAT_CHANGED')throw e;throw Error('NOTIFICATION_CHECKPOINT_INVALID');}
  bindCheckpoint(progress,target);
  const save=()=>rest(path,'PATCH',{telegram_message_id:JSON.stringify(progress),telegram_claimed_at:new Date().toISOString()});
  if(!await sendOperations(row,operations,progress,save,token,target,options)){
   if(progress.reliability){progress.reliability.attempts=0;progress.reliability.nextAttemptAt=new Date(Date.now()+15000).toISOString();}
   await rest(path,'PATCH',{telegram_status:'pending',telegram_error:'NOTIFICATION_BATCH_PENDING',telegram_message_id:JSON.stringify(progress)});return 'pending';
  }
  await rest(path,'PATCH',{telegram_status:'sent',telegram_sent_at:new Date().toISOString(),telegram_error:null});return 'sent';
 }catch(e){
  const detail=failureDetails(e);
  await rest(path,'PATCH',{telegram_status:'pending',telegram_error:detail.code});console.error(JSON.stringify({traceId:id,...detail}));return 'pending';
 }
}
async function sendOperations(row:any,operations:any[],progress:any,save:()=>Promise<any>,token:string,target:any,options:Options){
 const chat=target.chatId;
 let completed=0;
 for(const [index,operation] of operations.entries()){
  const previous=progress.operations[index];if(previous?.state==='sent')continue;
  if(completed>=(options.maxOperations??Infinity)||(options.deadline&&Date.now()+65000>=options.deadline))return false;
  const rejected=options.resumeRejected&&previous?.state==='blocked'&&(previous.error?.code==='TELEGRAM_HTTP_400'||row.telegram_error==='TELEGRAM_HTTP_400');
  if(previous&&previous.state!=='retryable'&&!rejected)throw Error('TELEGRAM_OUTCOME_UNKNOWN');
  if(previous?.retryAt&&Date.parse(previous.retryAt)>Date.now())throw Error('TELEGRAM_HTTP_429');
  if(rejected&&previous.error?.code!=='TELEGRAM_HTTP_400'){previous.error={code:'TELEGRAM_HTTP_400',reason:'PROVIDER_REJECTED',retryAfter:0};await save();}
  const replyTo=operation.replyToSummary?progress.operations[0]?.providerId?.messageIds?.[0]:undefined;
  if(operation.replyToSummary&&(!Number.isSafeInteger(replyTo)||replyTo<1))throw Error('NOTIFICATION_CHECKPOINT_INVALID');
  // Download before marking sending: a storage failure has sent nothing.
  const attachment=operation.kind==='text'?null:await prepareAttachment(row,operation,chat,operation.asDocument===true,options.deadline);
  progress.operations[index]={state:'sending'};await save();
  let providerId;
  try{providerId=await sendOperation(row,operation,attachment,token,target,replyTo,options.deadline);}
  catch(e){
   const detail=failureDetails(e),retryAt=new Date(Date.now()+Math.max(60,detail.retryAfter)*1000).toISOString();
   progress.operations[index]={state:['TELEGRAM_HTTP_429','NOTIFICATION_BUDGET_PENDING'].includes(detail.code)?'retryable':detail.code==='TELEGRAM_OUTCOME_UNKNOWN'?'uncertain':'blocked',error:detail,...(detail.retryAfter?{retryAt}:{})};
   if(progress.reliability&&detail.code==='NOTIFICATION_BUDGET_PENDING'){progress.reliability.attempts=0;progress.reliability.nextAttemptAt=new Date(Date.now()+15000).toISOString();}
   if(progress.reliability&&detail.retryAfter)progress.reliability.nextAttemptAt=new Date(Math.max(Date.parse(progress.reliability.nextAttemptAt)||0,Date.parse(retryAt))).toISOString();
   await save();throw e;
  }
  progress.operations[index]={state:'sent',providerId};if(progress.reliability)progress.reliability.attempts=0;await save();completed++;
  await new Promise(r=>setTimeout(r,1100));
 }
 return true;
}
async function prepareAttachment(row:any,operation:any,chat:string,asDocument:boolean,deadline?:number):Promise<any>{
 if(!deadline)return attachmentBody(row,operation,chat,asDocument);
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([attachmentBody(row,operation,chat,asDocument),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('PHOTO_DOWNLOAD_FAILED')),Math.max(1,deadline-Date.now()-65000));})]);}
 finally{clearTimeout(timer);}
}
async function sendOperation(row:any,operation:any,attachment:any,token:string,target:any,replyTo?:number,deadline?:number){
 const chat=target.chatId;
 if(operation.kind==='text')return telegram(token,'sendMessage',topicBody(target,{chat_id:chat,text:operation.text,reply_markup:operation.reply_markup,link_preview_options:{is_disabled:true},protect_content:false}),1,deadline);
 if(replyTo)attachment.body.set('reply_parameters',JSON.stringify({message_id:replyTo,allow_sending_without_reply:false}));
 try{return await telegram(token,attachment.method,topicBody(target,attachment.body),attachment.count,deadline);}
 catch(e){
  if(operation.kind!=='album'||!(e instanceof Error)||e.message!=='TELEGRAM_HTTP_400'||failureDetails(e).reason==='FROZEN_METHOD_INVALID'||(deadline&&Date.now()+65000>=deadline))throw e;
  const fallback=await prepareAttachment(row,operation,chat,true,deadline).catch(()=>{throw e;});
  if(replyTo)fallback.body.set('reply_parameters',JSON.stringify({message_id:replyTo,allow_sending_without_reply:false}));
  return telegram(token,fallback.method,topicBody(target,fallback.body),fallback.count,deadline);
 }
}
