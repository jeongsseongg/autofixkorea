import {targetMatches} from '../_shared/telegram-forum.js';
export async function telegram(token:string,method:string,body:FormData|object,count=1){
 let r:Response,data:any;
 try{
  const multipart=body instanceof FormData;
  r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:multipart?{}:{'Content-Type':'application/json'},body:multipart?body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  data=await r.json();
 }catch{throw Error('TELEGRAM_OUTCOME_UNKNOWN');}
 if(r.status>=500)throw Error('TELEGRAM_OUTCOME_UNKNOWN');
 if(!r.ok||!data.ok)throw Error('TELEGRAM_HTTP_'+r.status);
 const messages=Array.isArray(data.result)?data.result:[data.result];
 const ids=messages.map((m:any)=>m?.message_id);
 if(ids.length!==count||ids.some((id:any)=>!Number.isInteger(id)||id<=0)||new Set(ids).size!==count)throw Error('TELEGRAM_OUTCOME_UNKNOWN');
 const group=messages[0]?.media_group_id;
 if(count>1&&(!group||messages.some((m:any)=>m.media_group_id!==group)))throw Error('TELEGRAM_OUTCOME_UNKNOWN');
 const destination=body instanceof FormData?body.get('chat_id'):(body as any).chat_id;
 const thread=body instanceof FormData?body.get('message_thread_id'):(body as any).message_thread_id;
 const target={chatId:String(destination),threadId:thread===undefined||thread===null?null:Number(thread),forum:thread!==undefined&&thread!==null};
 if(messages.some((m:any)=>!targetMatches(m,target)))throw Error('TELEGRAM_OUTCOME_UNKNOWN');
 return {messageIds:ids,method,...(group?{mediaGroupId:group}:{}),
  photoCount:messages.filter((m:any)=>m.photo?.length).length,
  documentCount:messages.filter((m:any)=>m.document).length,
  copyButtonAccepted:messages.some((m:any)=>m.reply_markup?.inline_keyboard?.flat().some((b:any)=>b.copy_text))};
}
