import {normalize,imageType} from './normalize.js';
const base=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
const bucket='autofix-listing-photos';
async function hash(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,'0')).join('');}
async function rest(path:string,method='GET',body?:unknown){
 const r=await fetch(base+'/rest/v1/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!r.ok){const value=await r.text();throw new Error(value.includes('EVENT_CONFLICT')?'EVENT_CONFLICT':'DATABASE_FAILED');}
 return r.json();
}
async function telegram(method:string,body:object){
 const token=Deno.env.get('AUTOFIX_TELEGRAM_BOT_TOKEN');if(!token)throw new Error('TELEGRAM_NOT_CONFIGURED');
 const response=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const data=await response.json();if(!response.ok||!data.ok)throw new Error('TELEGRAM_DOWNLOAD_FAILED');return data.result;
}
async function photoBytes(photo:any,channel:string){
 if(channel==='email'){
  if(typeof photo.base64!=='string'||photo.base64.length>14000000)throw new Error('INVALID_IMAGE');
  try{return Uint8Array.from(atob(photo.base64),c=>c.charCodeAt(0));}catch{throw new Error('INVALID_IMAGE');}
 }
 const file=await telegram('getFile',{file_id:photo.file_id});
 if(file.file_size>10485760||!/^photos\/[a-zA-Z0-9_.-]+$/.test(file.file_path))throw new Error('INVALID_IMAGE');
 const response=await fetch('https://api.telegram.org/file/bot'+Deno.env.get('AUTOFIX_TELEGRAM_BOT_TOKEN')+'/'+file.file_path,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('TELEGRAM_DOWNLOAD_FAILED');return new Uint8Array(await response.arrayBuffer());
}
async function savePhotos(photos:any[],channel:string,eventHash:string){
 const saved=[];
 for(let i=0;i<photos.length;i++){
  const bytes=await photoBytes(photos[i],channel);
  if(!bytes.length||bytes.length>10485760)throw new Error('IMAGE_TOO_LARGE');
  const mime=imageType(bytes),path=eventHash+'/'+i;
  const r=await fetch(base+'/storage/v1/object/'+bucket+'/'+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':mime,'x-upsert':'true'},body:bytes,signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('IMAGE_STORAGE_FAILED');saved.push({path,mime});
 }
 return saved;
}
function envelope(body:any,channel:string){
 if(channel==='telegram'){
  const m=body.message||body.channel_post;
  if(!m||!Number.isSafeInteger(body.update_id))return null;
  return {event:String(body.update_id),sender:String(m.chat.id),text:m.caption||m.text||'',photos:m.photo?.length?[m.photo.at(-1)]:[],album:!!m.media_group_id,group:m.media_group_id?String(m.media_group_id):null};
 }
 if(typeof body.eventId!=='string'||typeof body.sender!=='string'||typeof body.text!=='string'||!Array.isArray(body.photos))throw new Error('INVALID_ENVELOPE');
 return {event:body.eventId,sender:body.sender.trim().toLowerCase(),text:body.text,photos:body.photos,album:false,group:null};
}
Deno.serve(async(req:Request)=>{
 const traceId=crypto.randomUUID(),reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST')return reply({code:'METHOD_REJECTED',traceId},405);
 const channel=new URL(req.url).searchParams.get('channel');
 if(channel!=='email'&&channel!=='telegram')return reply({code:'CHANNEL_REQUIRED',traceId},400);
 const expected=Deno.env.get(channel==='telegram'?'AUTOFIX_LISTING_TELEGRAM_SECRET':'AUTOFIX_LISTING_EMAIL_SECRET');
 const provided=req.headers.get(channel==='telegram'?'x-telegram-bot-api-secret-token':'x-autofix-ingest-secret');
 if(!expected||!provided||await hash(expected)!==await hash(provided))return reply({code:'UNAUTHORIZED',traceId},401);
 try{
  if(Number(req.headers.get('content-length'))>15000000)return reply({code:'TOO_LARGE',traceId},413);
  const raw=await req.text();if(raw.length>15000000)return reply({code:'TOO_LARGE',traceId},413);
  const event=envelope(JSON.parse(raw),channel);if(!event)return reply({ignored:true});
  if(!event.event||event.event.length>200||event.text.length>20000||event.photos.length>10)throw new Error('INVALID_ENVELOPE');
  const sources=await rest('autofix_listing_sources?channel=eq.'+channel+'&sender=eq.'+encodeURIComponent(event.sender)+'&enabled=eq.true&select=id');
  if(!sources.length)return reply({ignored:true,code:'SOURCE_NOT_ALLOWED'});
  const digest=await hash(JSON.stringify(event));
  const existing=await rest('autofix_listing_inbox?channel=eq.'+channel+'&event_id=eq.'+encodeURIComponent(event.event)+'&select=id,listing_id,payload_hash');
  if(existing.length){if(existing[0].payload_hash!==digest)throw new Error('EVENT_CONFLICT');return reply({id:existing[0].listing_id||existing[0].id,duplicate:true});}
  const photos=await savePhotos(event.photos,channel,digest);
  const listing=normalize(event.text,photos,event.album);
  return reply(await rest('rpc/autofix_ingest_listing','POST',{p_channel:channel,p_event:event.event,p_sender:event.sender,p_hash:digest,p_raw:event.text,p_listing:listing,p_album:event.album,p_group:event.group}));
 }catch(error){
  const code=error instanceof Error?error.message:'INGEST_FAILED';console.error(JSON.stringify({traceId,code}));
  const status=code==='EVENT_CONFLICT'?409:/INVALID|TOO_LARGE/.test(code)?400:503;
  return reply({code:status===503?'INGEST_FAILED':code,traceId},status);
 }
});
