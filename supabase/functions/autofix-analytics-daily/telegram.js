import {forumTarget,topicBody,targetMatches,freezeDaily,readDaily,forumEligible} from '../_shared/telegram-forum.js';
function settings(chatId,forumTargets){
 try{return {target:forumTarget(name=>name==='AUTOFIX_TELEGRAM_FORUM_TARGETS'?forumTargets:chatId,'daily')};}
 catch(error){return {error};}
}
const retry=body=>Number.isInteger(body.parameters?.retry_after)&&body.parameters.retry_after>0?Math.min(604800,body.parameters.retry_after):300;
async function edit({token,target,fetchImpl},{text,id}){
 if(!/^[1-9][0-9]{0,15}$/.test(String(id)))throw new Error('INVALID_MESSAGE_ID');
 text=readDaily(text,target);
 const response=await fetchImpl('https://api.telegram.org/bot'+token+'/editMessageText',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:target.chatId,message_id:Number(id),text,link_preview_options:{is_disabled:true}}),signal:AbortSignal.timeout(30000)});
 const body=await response.json();if(response.status>=500)throw new Error('TELEGRAM_EDIT_UNKNOWN');
 const unchanged=response.status===400&&body.error_code===400&&/^Bad Request: message is not modified(?:$|:)/.test(String(body.description));
 const accepted=(!target.forum&&unchanged)||(response.ok&&body.ok===true&&targetMatches(body.result,target)&&String(body.result?.message_id)===String(id)&&body.result?.text===text);
 return {accepted,retryable:response.status===429||body.error_code===429,retryAfter:retry(body)};
}
async function send({token,target,fetchImpl},{text}){
 text=readDaily(text,target);
 const response=await fetchImpl('https://api.telegram.org/bot'+token+'/sendMessage',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(topicBody(target,{chat_id:target.chatId,text,link_preview_options:{is_disabled:true},protect_content:true,allow_paid_broadcast:false})),signal:AbortSignal.timeout(60000)});
 const body=await response.json();if(response.status>=500)throw new Error('TELEGRAM_OUTCOME_UNKNOWN');
 const result=body.result,accepted=response.ok&&body.ok===true;
 if(accepted&&(!Number.isSafeInteger(result?.message_id)||result.message_id<=0||!targetMatches(result,target)||result.text!==text))throw new Error('TELEGRAM_OUTCOME_UNKNOWN');
 return {accepted,id:result?.message_id,retryable:response.status===429||body.error_code===429,retryAfter:retry(body)};
}
export function dailyTelegram({token,chatId,forumTargets,fetchImpl=fetch}){
 const config=settings(chatId,forumTargets);
 if(!token||!config.error&&!config.target.chatId)return null;
 const ready=()=>{if(config.error)throw config.error;};
 const context={token,target:config.target,fetchImpl};
 return {assertReady:ready,async beforeClaim(input,store,now=new Date()){
   ready();if(!config.target.forum)return true;
   if(typeof store.queuedAt!=='function')throw Object.assign(new Error('DAILY_QUEUE_TIME_UNVERIFIED'),{code:'DAILY_QUEUE_TIME_UNVERIFIED',status:503});
   if(!forumEligible(config.target,input.scheduled))return false;
   const queuedAt=await store.queuedAt(input);return forumEligible(config.target,queuedAt??new Date(now).toISOString());
  },freeze(text){ready();return freezeDaily(text,config.target);},
  validateFrozen(text){ready();return readDaily(text,config.target);},
  async edit(input){ready();return edit(context,input);},async send(input){ready();return send(context,input);}};
}
