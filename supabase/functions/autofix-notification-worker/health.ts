import {forumTarget,targetMatches} from '../_shared/telegram-forum.js';
import {providerError,failureDetails} from '../autofix-accident-intake/notification-state.ts';

export async function checkHealth(env:(name:string)=>string,fetcher:typeof fetch=fetch){
 const checks={bot:false,chat:false,membership:false};
 try{
  const token=env('AUTOFIX_TELEGRAM_BOT_TOKEN'),target=forumTarget(env,'intake');
  if(!token||!target.chatId)return {ok:false,reason:'NOT_CONFIGURED',checks};
  const read=async(method:string,body:object)=>{
   const response=await fetcher('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
   const data=await response.json();
   if(!response.ok||data.ok!==true)throw providerError(response.status,data);
   return data.result;
  };
  const bot=await read('getMe',{});
  if(!Number.isSafeInteger(bot?.id)||bot.id<1||bot.is_bot!==true)throw Error('HEALTH_BOT_INVALID');
  checks.bot=true;
  const chat=await read('getChat',{chat_id:target.chatId});
  if(!targetMatches({chat}, {...target,forum:false})||(target.forum&&chat.is_forum!==true))throw Error('HEALTH_DESTINATION_INVALID');
  checks.chat=true;
  const member=await read('getChatMember',{chat_id:target.chatId,user_id:bot.id});
  if(member?.user?.id!==bot.id||!['creator','administrator','member','restricted'].includes(member.status)||
   (member.status==='restricted'&&(member.is_member!==true||member.can_send_messages!==true)))throw Error('HEALTH_MEMBERSHIP_INVALID');
  if(member.status==='restricted'&&(member.can_send_photos!==true||member.can_send_documents!==true))throw Error('HEALTH_MEDIA_PERMISSION_DENIED');
  if(member.status==='member'&&(chat.permissions?.can_send_photos===false||chat.permissions?.can_send_documents===false))throw Error('HEALTH_MEDIA_PERMISSION_DENIED');
  checks.membership=true;
  return {ok:true,reason:'READY',checks};
 }catch(error){
  const detail=failureDetails(error),raw=error instanceof Error?error.message:'';
  return {ok:false,reason:detail.reason==='UNCONFIRMED'?(/^HEALTH_[A-Z_]+$/.test(raw)?raw:'HEALTH_UNCONFIRMED'):detail.reason,code:detail.code,retryAfter:detail.retryAfter,checks};
 }
}
