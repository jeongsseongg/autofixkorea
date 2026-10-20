import {forumTarget,topicBody,targetMatches,forumEligible} from '../_shared/telegram-forum.js';
import {base,rest,config} from './store.ts';
import {readLimited,limit} from './receive.ts';
import {channelSummary} from './summary.js';
const token=Deno.env.get('AUTOFIX_TELEGRAM_BOT_TOKEN')||'';
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
 const target=forumTarget((name:string)=>Deno.env.get(name),'intake'),owner=target.chatId;
 if(!owner)throw new Error('TELEGRAM_RECIPIENT_MISSING');
 if(!forumEligible(target,row.created_at))return 'before_forum_start';
 const send=async(method:string,body:object|FormData)=>{
  const result=await telegram(method,topicBody(target,body));
  if(target.forum&&(!Number.isSafeInteger(result?.message_id)||result.message_id<=0||!targetMatches(result,target)))throw Error('TELEGRAM_OUTCOME_UNKNOWN');
  return result;
 };
 await send('sendMessage',{chat_id:owner,...channelSummary(row,files),link_preview_options:{is_disabled:true}});
 for(const file of files){
  const form=new FormData();form.set('chat_id',owner);form.set('document',new Blob([new Uint8Array(file.bytes)],{type:file.mime}),file.name);
  await send('sendDocument',form);
 }
 return 'sent';
}
