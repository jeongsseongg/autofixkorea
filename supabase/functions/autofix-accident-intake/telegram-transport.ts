import {targetMatches} from '../_shared/telegram-forum.js';
import {providerError} from './notification-state.ts';
export async function telegram(token:string,method:string,body:FormData|object,count=1,deadline?:number){
 let r:Response,data:any;
 const timeout=deadline?Math.min(60000,deadline-Date.now()-32000):60000;
 if(timeout<=0)throw Error('NOTIFICATION_BUDGET_PENDING');
 try{
  const multipart=body instanceof FormData;
  r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:multipart?{}:{'Content-Type':'application/json'},body:multipart?body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
  data=await r.json();
 }catch{throw Error('TELEGRAM_OUTCOME_UNKNOWN');}
 if(r.status>=500)throw Error('TELEGRAM_OUTCOME_UNKNOWN');
 if(!r.ok||!data.ok)throw providerError(r.status,data);
 const messages=Array.isArray(data.result)?data.result:[data.result];
 const ids=messages.map((m:any)=>m?.message_id);
 if(ids.length!==count||ids.some((id:any)=>!Number.isInteger(id)||id<=0)||new Set(ids).size!==count)throw Error('TELEGRAM_OUTCOME_UNKNOWN');
 const group=messages[0]?.media_group_id;
 if(count>1&&(!group||messages.some((m:any)=>m.media_group_id!==group)))throw Error('TELEGRAM_OUTCOME_UNKNOWN');
 const destination=body instanceof FormData?body.get('chat_id'):(body as any).chat_id;
 const thread=body instanceof FormData?body.get('message_thread_id'):(body as any).message_thread_id;
 const target={chatId:String(destination),threadId:thread===undefined||thread===null?null:Number(thread),forum:thread!==undefined&&thread!==null};
 if(messages.some((m:any)=>!targetMatches(m,target)))throw Error('TELEGRAM_OUTCOME_UNKNOWN');
 const rawReply=body instanceof FormData?body.get('reply_parameters'):(body as any).reply_parameters;
 let reply:any;try{reply=typeof rawReply==='string'?JSON.parse(rawReply):rawReply;}catch{throw Error('TELEGRAM_OUTCOME_UNKNOWN');}
 if(reply&&(!Number.isSafeInteger(reply.message_id)||!messages.some((m:any)=>m.reply_to_message?.message_id===reply.message_id)||messages.some((m:any)=>m.reply_to_message&&m.reply_to_message.message_id!==reply.message_id)))throw Error('TELEGRAM_OUTCOME_UNKNOWN');
 return {messageIds:ids,method,...(group?{mediaGroupId:group}:{}),
  photoCount:messages.filter((m:any)=>m.photo?.length).length,
  documentCount:messages.filter((m:any)=>m.document).length,
  copyButtonAccepted:messages.some((m:any)=>m.reply_markup?.inline_keyboard?.flat().some((b:any)=>b.copy_text)),...(reply?{replyToMessageId:reply.message_id}:{})};
}
