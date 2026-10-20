import {notifyGalleryReceipt} from '../supabase/functions/autofix-accident-intake/telegram.ts';
const names=['AUTOFIX_TELEGRAM_BOT_TOKEN','AUTOFIX_TELEGRAM_CHAT_ID','AUTOFIX_TELEGRAM_FORUM_TARGETS','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
const targets={intake:{chatId:'-1001234567890',threadId:12},daily:{chatId:'-1001234567890',threadId:34}};
const equal=(a:unknown,b:unknown)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Expected '+JSON.stringify(b)+', got '+JSON.stringify(a));};
async function rejects(fn:()=>Promise<unknown>,pattern:RegExp){try{await fn();}catch(e){if(pattern.test(String(e)))return;throw e;}throw Error('Expected rejection');}
async function fixture(run:(f:any)=>Promise<void>,raw=JSON.stringify(targets)){
 const prior=names.map(n=>Deno.env.get(n)),oldFetch=globalThis.fetch;
 names.forEach((n,i)=>Deno.env.set(n,['123:synthetic','123456',raw,'https://storage.invalid','synthetic'][i]));
 const row:any={id:'11111111-1111-4111-8111-111111111111',values:{service:'accidentSale',contact:'01000000000'},photos:[0,1].map(i=>({path:'11111111-1111-4111-8111-111111111111/'+i+'.png',mime:'image/png',size:3,category:'exterior'}))};
 const calls:any[]=[],requests:any[]=[];let wrong=false,claims=0;
 const rest=async(path:string,method='GET',body?:any)=>{requests.push({path,method,body});if(path.includes('autofix_claim_telegram')){claims++;return true;}if(path.includes('autofix_intake_acquisition'))return [];if(method==='PATCH'){Object.assign(row,body);return [row];}return [row];};
 globalThis.fetch=async(url:any,init?:any)=>{
  if(String(url).startsWith('https://storage.invalid/'))return new Response(new Uint8Array([1,2,3]));
  const b=init.body instanceof FormData?Object.fromEntries(init.body.entries()):JSON.parse(init.body);calls.push({url:String(url),body:b});
  const media=b.media?JSON.parse(b.media):[{}];
  const messages=media.map((_:any,i:number)=>({message_id:calls.length*10+i,chat:{id:b.chat_id},message_thread_id:wrong?999:(b.message_thread_id===undefined?undefined:Number(b.message_thread_id)),text:b.text,photo:b.photo?[{}]:undefined,media_group_id:media.length>1?'group':undefined}));
  return Response.json({ok:true,result:media.length>1?messages:messages[0]});
 };
 try{await run({row,calls,requests,rest,get claims(){return claims;},wrong(){wrong=true;}});}finally{globalThis.fetch=oldFetch;names.forEach((n,i)=>prior[i]===undefined?Deno.env.delete(n):Deno.env.set(n,prior[i]!));}
}
Deno.test('gallery text, album, receipt document and copy phone button stay in intake topic',async()=>{
 await fixture(async f=>{equal(await notifyGalleryReceipt(f.row.id,f.rest),'sent');equal(f.calls.length,3);for(const c of f.calls){equal(String(c.body.chat_id),targets.intake.chatId);equal(Number(c.body.message_thread_id),12);if(!c.url.includes('123:synthetic'))throw Error('Bot changed');}equal(f.calls[0].body.reply_markup.inline_keyboard[0][0].copy_text.text,'01000000000');equal(JSON.parse(f.row.telegram_message_id).destination,targets.intake);});
});
Deno.test('wrong thread ACK is uncertain and a second attempt cannot duplicate it',async()=>{
 await fixture(async f=>{f.wrong();equal(await notifyGalleryReceipt(f.row.id,f.rest),'pending');equal(JSON.parse(f.row.telegram_message_id).operations[0].state,'uncertain');equal(await notifyGalleryReceipt(f.row.id,f.rest),'pending');equal(f.calls.length,1);});
});
Deno.test('malformed forum setting is rejected before receipt queue claim or fetch',async()=>{
 await fixture(async f=>{await rejects(()=>notifyGalleryReceipt(f.row.id,f.rest),/TELEGRAM_FORUM_CONFIG_INVALID/);equal(f.claims,0);equal(f.calls.length,0);},'{');
});
Deno.test('old sent checkpoint cannot be rebound to a new topic',async()=>{
 await fixture(async f=>{equal(await notifyGalleryReceipt(f.row.id,f.rest),'sent');const before=f.row.telegram_message_id,calls=f.calls.length;Deno.env.set('AUTOFIX_TELEGRAM_FORUM_TARGETS',JSON.stringify({...targets,intake:{...targets.intake,threadId:13}}));equal(await notifyGalleryReceipt(f.row.id,f.rest),'pending');equal(f.calls.length,calls);equal(f.row.telegram_message_id,before);equal(f.row.telegram_error,'NOTIFICATION_DESTINATION_CHANGED');});
});
Deno.test('forum channel intake forwards original with verifiable ACK, while private greeting stays private',async()=>{
 await fixture(async f=>{const channel=await import('../supabase/functions/autofix-channel-intake/telegram.ts?forum');await channel.notify({id:'synthetic',channel:'telegram'}, {chat:777,messageId:11},[]);equal(f.calls.length,2);equal(f.calls[1].url.endsWith('/forwardMessage'),true);for(const c of f.calls)equal(c.body.message_thread_id,12);await channel.telegram('sendMessage',{chat_id:777,text:'private greeting'});equal(f.calls[2].body.chat_id,777);equal(f.calls[2].body.message_thread_id,undefined);});
});
Deno.test('channel email text and attachments use the same topic and a wrong ACK cannot be accepted',async()=>{
 await fixture(async f=>{const channel=await import('../supabase/functions/autofix-channel-intake/telegram.ts?email');await channel.notify({id:'synthetic',channel:'email',fields:{subject:'synthetic'}},null,[{bytes:new Uint8Array([1]),name:'synthetic.txt',mime:'text/plain'}]);equal(f.calls.length,3);for(const c of f.calls)equal(Number(c.body.message_thread_id),12);f.wrong();await rejects(()=>channel.notify({id:'synthetic',channel:'email',fields:{}},null,[]),/TELEGRAM_OUTCOME_UNKNOWN/);});
});
Deno.test('unset config preserves original recipient and adds no topic',async()=>{
 await fixture(async f=>{equal(await notifyGalleryReceipt(f.row.id,f.rest),'sent');for(const c of f.calls){equal(String(c.body.chat_id),'123456');equal(c.body.message_thread_id,undefined);}},'');
});

Deno.test('one wrong-thread member in an album freezes that part without repeating sent text',async()=>{
 await fixture(async f=>{const provider=globalThis.fetch;globalThis.fetch=async(url:any,init?:any)=>{const response=await provider(url,init);if(String(url).endsWith('/sendMediaGroup')){const body=await response.json();body.result[1].message_thread_id=999;return Response.json(body);}return response;};equal(await notifyGalleryReceipt(f.row.id,f.rest),'pending');const saved=JSON.parse(f.row.telegram_message_id);equal(saved.operations[0].state,'sent');equal(saved.operations[1].state,'uncertain');const calls=f.calls.length;equal(await notifyGalleryReceipt(f.row.id,f.rest),'pending');equal(f.calls.length,calls);});
});
