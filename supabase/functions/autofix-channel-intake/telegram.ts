import {base,rest,config} from './store.ts';
import {readLimited,limit} from './receive.ts';
const token=Deno.env.get('AUTOFIX_TELEGRAM_BOT_TOKEN')||'',owner=Deno.env.get('AUTOFIX_TELEGRAM_CHAT_ID')||'';
export async function telegram(method:string,body:object|FormData={}){
 if(!token)throw new Error('TELEGRAM_NOT_CONFIGURED');
 const form=body instanceof FormData;
 const r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:form?{}:{'Content-Type':'application/json'},body:form?body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const data=await r.json();if(!r.ok||!data.ok)throw new Error('TELEGRAM_'+(data.error_code||'FAILED'));return data.result;
}
export async function setupTelegram(activate=false){
 const bot=await telegram('getMe'),hook=await telegram('getWebhookInfo'),settings=await config('telegram');
 const url=base+'/functions/v1/autofix-channel-intake?channel=telegram';
 if(activate){
  if(hook.url&&hook.url!==url)throw new Error('WEBHOOK_ALREADY_IN_USE');
  await telegram('setWebhook',{url,secret_token:settings.secret,allowed_updates:['message','channel_post','edited_message'],drop_pending_updates:false,max_connections:5});
  await rest('autofix_channel_config?channel=eq.telegram','PATCH',{enabled:true,address:'https://t.me/'+bot.username,updated_at:new Date().toISOString()});
 }
 return {username:bot.username,url:'https://t.me/'+bot.username,webhook:activate?url:hook.url,pending:hook.pending_update_count,lastError:hook.last_error_message||null,enabled:activate||settings.enabled};
}
export async function downloadTelegram(file:any){
 if(file.file_size>limit)return null;
 const info=await telegram('getFile',{file_id:file.file_id});
 if(info.file_size>limit||!/^[-\w]+\/[-\w.]+$/.test(info.file_path))return null;
 const r=await fetch('https://api.telegram.org/file/bot'+token+'/'+info.file_path,{signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw new Error('TELEGRAM_DOWNLOAD_FAILED');
 return readLimited(new Request('https://local.invalid',{method:'POST',body:r.body,duplex:'half'} as RequestInit));
}
export async function notify(row:any,event:any,files:{bytes:Uint8Array,name:string,mime:string}[]){
 if(!owner)throw new Error('TELEGRAM_RECIPIENT_MISSING');
 await telegram('sendMessage',{chat_id:owner,text:'오토픽스 '+(row.channel==='email'?'메일':'텔레그램')+' 접수\n접수번호: '+row.id+'\nhttps://www.autofixkorea.com/hub/'});
 if(row.channel==='telegram'){
  await telegram('copyMessage',{chat_id:owner,from_chat_id:event.chat,message_id:event.messageId});return;
 }
 const labels:Record<string,string>={source:'접수 경로',sender:'보낸 주소',to:'받는 주소',subject:'제목',message:'내용',from:'보낸 사람',messageId:'메일 식별번호',date:'발송 일시'};
 const text=Object.entries(row.fields).map(([k,v])=>(labels[k]||k)+': '+(typeof v==='string'?v:JSON.stringify(v))).join('\n');
 for(let i=0;i<text.length;i+=3500)await telegram('sendMessage',{chat_id:owner,text:text.slice(i,i+3500)});
 for(const file of files){
  const form=new FormData();form.set('chat_id',owner);form.set('document',new Blob([new Uint8Array(file.bytes)],{type:file.mime}),file.name);
  await telegram('sendDocument',form);
 }
}
