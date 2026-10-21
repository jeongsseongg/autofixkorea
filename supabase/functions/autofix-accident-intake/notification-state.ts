import {forumEligible} from '../_shared/telegram-forum.js';

export type ProviderFailure=Error&{http:number,reason:string,retryAfter:number};
export function providerError(http:number,data:any={}):ProviderFailure{
 const text=String(data?.description||'').toUpperCase();
 const reasons:[string,RegExp][]=[['FROZEN_METHOD_INVALID',/FROZEN_METHOD_INVALID/],
  ['BOT_BLOCKED',/BOT WAS BLOCKED/],['CHAT_NOT_FOUND',/CHAT NOT FOUND/],
  ['TOPIC_CLOSED',/TOPIC_CLOSED|TOPIC CLOSED/],['THREAD_NOT_FOUND',/MESSAGE THREAD NOT FOUND/],
  ['BOT_NOT_MEMBER',/BOT IS NOT A MEMBER|BOT WAS KICKED/],['INSUFFICIENT_RIGHTS',/NOT ENOUGH RIGHTS/],
  ['FILE_TOO_LARGE',/FILE IS TOO BIG|FILE TOO LARGE/],['INVALID_MEDIA',/IMAGE_PROCESS_FAILED|PHOTO_INVALID/]];
 const reason=reasons.find(([,pattern])=>pattern.test(text))?.[0]||
  (http===429?'RATE_LIMITED':http===401?'UNAUTHORIZED':http===403?'FORBIDDEN':'PROVIDER_REJECTED');
 const seconds=data?.parameters?.retry_after;
 const retryAfter=Number.isSafeInteger(seconds)&&seconds>0?seconds:0;
 return Object.assign(Error('TELEGRAM_HTTP_'+http),{http,reason,retryAfter});
}
export function failureDetails(error:any){
 const code=String(error?.message||'');
 const allowed=/^(TELEGRAM_HTTP_\d+|TELEGRAM_OUTCOME_UNKNOWN|PHOTO_DOWNLOAD_FAILED|PHOTO_SIZE_MISMATCH|INVALID_PHOTO_PATH|INVALID_ARCHIVE_NAME|ARCHIVE_SIZE_LIMIT|NOTIFICATION_FORMAT_CHANGED|NOTIFICATION_CHECKPOINT_INVALID|NOTIFICATION_DESTINATION_CHANGED|NOTIFICATION_DESTINATION_UNBOUND|TELEGRAM_DESTINATION_CONFLICT|NOTIFICATION_BUDGET_PENDING)$/;
 return {code:allowed.test(code)?code:'TELEGRAM_DELIVERY_UNCONFIRMED',
  reason:/^[A-Z_]+$/.test(error?.reason||'')?String(error.reason):'UNCONFIRMED',
  retryAfter:Number.isSafeInteger(error?.retryAfter)&&error.retryAfter>0?error.retryAfter:0};
}
export function readCheckpoint(row:any):any{
 if(!row.telegram_message_id)return null;
 const value=JSON.parse(row.telegram_message_id);
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('NOTIFICATION_CHECKPOINT_INVALID');
 return value;
}
export function retryDecision(row:any,target:any,options:any){
 const deny=(reason:string)=>({allowed:false,reason});
 const stale=row.telegram_status==='sending'&&Number.isFinite(Date.parse(row.telegram_claimed_at))&&Date.parse(row.telegram_claimed_at)<options.now-300000;
 if(row.status!=='complete'||(row.telegram_status!=='pending'&&!stale))return deny('NOT_PENDING');
 if(!forumEligible(target,row.created_at))return deny('BEFORE_FORUM_START');
 if((options.context?.mode==='test'||row.values?.mode==='test')&&!options.includeTest)return deny('TEST_EXCLUDED');
 if(/FORMAT|DESTINATION|CHECKPOINT|OUTCOME_UNKNOWN|DELIVERY_UNCONFIRMED/.test(row.telegram_error||''))return deny('MANUAL_REVIEW');
 let progress:any;try{progress=readCheckpoint(row);}catch{return deny('CHECKPOINT_INVALID');}
 if(!progress)return {allowed:true,reason:'NEW_ATTEMPT'};
 if(progress.version!==undefined&&![2,3].includes(progress.version))return deny('FORMAT_CHANGED');
 const operations=progress.operations||{};
 if(!operations||typeof operations!=='object'||Array.isArray(operations))return deny('CHECKPOINT_INVALID');
 if(progress.destination&&(progress.destination.chatId!==target.chatId||progress.destination.threadId!==target.threadId))return deny('DESTINATION_CHANGED');
 if(target.forum&&Object.keys(operations).length&&!progress.destination)return deny('DESTINATION_UNBOUND');
 for(const operation of Object.values(operations) as any[]){
  if(!operation||!['sent','retryable','blocked'].includes(operation.state))return deny('OUTCOME_UNKNOWN');
  if(operation.state==='blocked'&&operation.error?.code!=='TELEGRAM_HTTP_400'&&row.telegram_error!=='TELEGRAM_HTTP_400')return deny('BLOCKED');
  if(operation.retryAt&&(!Number.isFinite(Date.parse(operation.retryAt))||Date.parse(operation.retryAt)>options.now))return deny('BACKOFF');
  if(operation.state==='sent'&&(!Array.isArray(operation.providerId?.messageIds)||!operation.providerId.messageIds.length||operation.providerId.messageIds.some((id:any)=>!Number.isSafeInteger(id)||id<1)))return deny('CHECKPOINT_INVALID');
 }
 const attempts=progress.reliability?.attempts??0,next=progress.reliability?.nextAttemptAt;
 if(!Number.isSafeInteger(attempts)||attempts<0||attempts>=3)return deny('ATTEMPTS_EXHAUSTED');
 if(next&&(!Number.isFinite(Date.parse(next))||Date.parse(next)>options.now))return deny('BACKOFF');
 return {allowed:true,reason:'RESUME_REJECTED_OR_RETRYABLE'};
}
