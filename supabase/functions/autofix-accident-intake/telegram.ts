import {receiptMessages} from './telegram-content.ts';
type Rest = (path:string,method?:string,body?:unknown)=>Promise<any>;
async function telegram(token:string,method:string,body:FormData|object){
 const multipart=body instanceof FormData;
 const r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{
  method:'POST',headers:multipart?{}:{'Content-Type':'application/json'},
  body:multipart?body:JSON.stringify(body),signal:AbortSignal.timeout(30000),
 });
 const data=await r.json();
 if(!r.ok||!data.ok)throw new Error('TELEGRAM_HTTP_'+r.status);
 return data.result.message_id;
}
async function photoBody(row:any,index:number,chat:string,kind:string){
 const p=row.photos[index],base=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const r=await fetch(base+'/storage/v1/object/authenticated/autofix-accident-photos/'+p.path,{
  headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(30000),
 });
 if(!r.ok)throw new Error('PHOTO_DOWNLOAD_FAILED');
 const blob=await r.blob();if(blob.size!==p.size)throw new Error('PHOTO_SIZE_MISMATCH');
 const body=new FormData();body.set('chat_id',chat);
 body.set('caption','접수번호: '+row.id+'\n'+(p.category==='interior'?'실내':'차량')+' 사진 '+(index+1)+' / '+row.photos.length);
 body.set(kind,blob,(index+1)+'.'+p.path.split('.').pop());return body;
}
// Full answers and attachments are authorized only for the selected owner's chat.
export async function notifyReceipt(id:string,rest:Rest){
 const token=Deno.env.get('AUTOFIX_TELEGRAM_BOT_TOKEN');
 const chat=Deno.env.get('AUTOFIX_TELEGRAM_CHAT_ID');
 if(!token||!chat)return 'not_configured';
 const claimed=await rest('/rest/v1/rpc/autofix_claim_telegram','POST',{p_id:id});
 if(!claimed)return 'already_sent_or_busy';
 const path='/rest/v1/autofix_accident_intakes?id=eq.'+id;
 try{
  const row=(await rest(path+'&select=*'))[0],messages=receiptMessages(row);
  let progress={texts:0,photos:0};
  try{const saved=JSON.parse(row.telegram_message_id||'null');if(saved&&typeof saved==='object')progress=saved;}catch{/* Legacy single message ID. */}
  const save=()=>rest(path,'PATCH',{telegram_message_id:JSON.stringify(progress),telegram_claimed_at:new Date().toISOString()});
  for(let i=progress.texts;i<messages.length;i++){
   await telegram(token,'sendMessage',{chat_id:chat,text:messages[i],link_preview_options:{is_disabled:true}});
   progress.texts=i+1;await save();await new Promise(r=>setTimeout(r,1100));
  }
  for(let i=progress.photos;i<row.photos.length;i++){
   const kind=row.photos[i].mime==='image/webp'||row.photos[i].size>10000000?'document':'photo';
   const body=await photoBody(row,i,chat,kind);
   try{await telegram(token,kind==='photo'?'sendPhoto':'sendDocument',body);}
   catch(e){
    if(kind!=='photo'||!(e instanceof Error)||e.message!=='TELEGRAM_HTTP_400')throw e;
    const file=body.get('photo')!;body.delete('photo');body.set('document',file);
    await telegram(token,'sendDocument',body);
   }
   progress.photos=i+1;await save();await new Promise(r=>setTimeout(r,1100));
  }
  await rest(path,'PATCH',{telegram_status:'sent',telegram_sent_at:new Date().toISOString(),telegram_error:null});
  return 'sent';
 }catch(e){
  const raw=e instanceof Error?e.message:'';
  const code=/^(TELEGRAM_HTTP_\d+|PHOTO_DOWNLOAD_FAILED|PHOTO_SIZE_MISMATCH)$/.test(raw)?raw:'TELEGRAM_DELIVERY_UNCONFIRMED';
  await rest(path,'PATCH',{telegram_status:'pending',telegram_error:code});
  console.error(JSON.stringify({traceId:id,code}));return 'pending';
 }
}
