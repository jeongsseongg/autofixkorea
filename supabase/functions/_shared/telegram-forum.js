const fail=code=>{throw Object.assign(new Error(code),{code,status:503});};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
function route(value){
 if(!exact(value,['chatId','threadId'])||typeof value.chatId!=='string'||!/^-[1-9][0-9]{4,15}$/.test(value.chatId)||!Number.isSafeInteger(Number(value.chatId))||!Number.isSafeInteger(value.threadId)||value.threadId<1)fail('TELEGRAM_FORUM_CONFIG_INVALID');
 return Object.freeze({chatId:value.chatId,threadId:value.threadId,forum:true});
}
export function forumTarget(env,kind){
 const raw=env('AUTOFIX_TELEGRAM_FORUM_TARGETS');
 if(raw===undefined||raw===null||raw==='')return Object.freeze({chatId:env('AUTOFIX_TELEGRAM_CHAT_ID')||'',threadId:null,forum:false});
 let values;try{values=JSON.parse(raw);}catch{fail('TELEGRAM_FORUM_CONFIG_INVALID');}
 if(!exact(values,['startsAt','intake','daily']))fail('TELEGRAM_FORUM_CONFIG_INVALID');
 const stamp=values.startsAt;
 if(typeof stamp!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(stamp)||!Number.isFinite(Date.parse(stamp))||new Date(stamp).toISOString().slice(0,19)!==stamp.slice(0,19))fail('TELEGRAM_FORUM_CONFIG_INVALID');
 const targets={intake:Object.freeze({...route(values.intake),startsAt:stamp}),daily:Object.freeze({...route(values.daily),startsAt:stamp})};
 if(!Object.hasOwn(targets,kind))fail('TELEGRAM_FORUM_CONFIG_INVALID');
 return targets[kind];
}
export function topicBody(target,input){
 if(!target.forum)return input;
 const form=input instanceof FormData,read=key=>form?input.get(key):input[key];
 for(const [key,value]of Object.entries({chat_id:target.chatId,message_thread_id:target.threadId})){
  const existing=read(key);if(existing!==undefined&&existing!==null&&String(existing)!==String(value))fail('TELEGRAM_DESTINATION_CONFLICT');
 }
 if(form){const body=new FormData();for(const [key,value]of input.entries())body.append(key,value);body.set('chat_id',target.chatId);body.set('message_thread_id',String(target.threadId));return body;}
 return {...input,chat_id:target.chatId,message_thread_id:target.threadId};
}
export function targetMatches(message,target){
 const chat=String(target.chatId),matches=/^-?\d+$/.test(chat)?String(message?.chat?.id)===chat:chat.startsWith('@')&&String(message?.chat?.username??'').toLowerCase()===chat.slice(1).toLowerCase();
 return matches&&(!target.forum||message?.message_thread_id===target.threadId);
}
const identity=target=>({chatId:target.chatId,threadId:target.threadId});
export function bindCheckpoint(progress,target){
 if(progress.destination){if(progress.destination.chatId!==target.chatId||progress.destination.threadId!==target.threadId)fail('NOTIFICATION_DESTINATION_CHANGED');}
 else if(target.forum&&Object.keys(progress.operations||{}).length)fail('NOTIFICATION_DESTINATION_UNBOUND');
 else progress.destination=identity(target);
 return progress;
}
const prefix='AF_TOPIC_V1:';
export function freezeDaily(text,target){
 if(!target.forum)return text;
 const frozen=prefix+target.chatId+':'+target.threadId+'\n'+text;
 if([...frozen].length>3600)fail('DAILY_ROUTE_PAYLOAD_TOO_LARGE');
 return frozen;
}
export function readDaily(text,target){
 if(typeof text!=='string')fail('DAILY_DESTINATION_UNBOUND');
 if(!text.startsWith(prefix)){if(target.forum)fail('DAILY_DESTINATION_UNBOUND');return text;}
 const end=text.indexOf('\n'),header=text.slice(0,end),expected=prefix+target.chatId+':'+target.threadId;
 if(!target.forum||end<0||header!==expected)fail('DAILY_DESTINATION_CHANGED');
 return text.slice(end+1);
}

export function forumEligible(target,createdAt){
 if(!target.forum)return true;
 const stamp=typeof createdAt==='string'?Date.parse(createdAt):NaN;
 if(!Number.isFinite(stamp))fail('TELEGRAM_FORUM_TIME_UNVERIFIED');
 return stamp>=Date.parse(target.startsAt);
}
