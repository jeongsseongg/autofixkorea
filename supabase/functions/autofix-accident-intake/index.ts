import {validate,imageMatches} from './validation.js';
const base=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const bucket='autofix-accident-photos';
const origins=new Set(['https://autofixkorea.pages.dev','https://autofix-independent.soun7701.chatgpt.site','https://www.autofixkorea.com','https://autofixkorea.com','http://127.0.0.1:4328','http://localhost:4328']);
const auth={apikey:service,Authorization:'Bearer '+service};
async function hash(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function request(path:string,method='GET',body?:unknown){
 const r=await fetch(base+path,{method,headers:{...auth,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!r.ok){const text=await r.text();throw new Error(text.includes('RATE_LIMITED')?'RATE_LIMITED':text.includes('CONFLICT')?'CONFLICT':'STORAGE_FAILED');}
 const text=await r.text();return text?JSON.parse(text):null;
}
async function start(input:any,ip:string){
 const data=validate(input);
 await request('/rest/v1/rpc/autofix_accident_start','POST',{p_id:input.id,p_token:await hash(input.token),p_hash:await hash(JSON.stringify(data)),p_ip:await hash(service+ip),p_values:data.values,p_photos:data.photos});
 const uploads=[];
 for(const p of data.photos){
  const signed=await request('/storage/v1/object/upload/sign/'+bucket+'/'+p.path,'POST',{});
  const url=new URL(base+'/storage/v1'+signed.url);
  if(url.origin!==new URL(base).origin)throw new Error('INVALID_UPLOAD_ORIGIN');
  uploads.push(url.href);
 }
 return {id:input.id,uploads};
}
async function complete(input:any){
 const rows=await request('/rest/v1/autofix_accident_intakes?id=eq.'+input.id+'&select=*');
 const row=rows[0];if(!row||row.token_hash!==await hash(input.token))throw new Error('NOT_AUTHORIZED');
 if(row.status==='complete')return {id:row.id,success:true};
 for(const p of row.photos){
  const r=await fetch(base+'/storage/v1/object/authenticated/'+bucket+'/'+p.path,{headers:{...auth,Range:'bytes=0-11'},signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('PHOTOS_INCOMPLETE');
  const size=Number(r.headers.get('content-range')?.split('/')[1]||r.headers.get('content-length'));
  const reader=r.body!.getReader();const first=await reader.read();await reader.cancel();
  if(size!==p.size||!first.value||!imageMatches(first.value,p.mime))throw new Error('INVALID_IMAGE');
 }
 await request('/rest/v1/autofix_accident_intakes?id=eq.'+input.id,'PATCH',{status:'complete',completed_at:new Date().toISOString()});
 return {id:row.id,success:true};
}
Deno.serve(async(req:Request)=>{
 const traceId=crypto.randomUUID(),origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin}:{})};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST'||!origins.has(origin))return reply({code:'ORIGIN_OR_METHOD_REJECTED',traceId},403);
 try{
  const raw=await req.text();if(raw.length>32000)return reply({code:'TOO_LARGE',traceId},413);
  let input;try{input=JSON.parse(raw);}catch{return reply({code:'INVALID_JSON',traceId},400);}
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.id)||typeof input.token!=='string'||input.token.length!==72)return reply({code:'INVALID_REQUEST',traceId},400);
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
  if(input.action==='start')return reply(await start(input,ip));
  if(input.action==='complete')return reply(await complete(input));
  return reply({code:'INVALID_ACTION',traceId},400);
 }catch(error){
  const code=error instanceof Error?error.message:'SERVER_ERROR';console.error(JSON.stringify({traceId,code}));
  const status=code==='RATE_LIMITED'?429:code==='NOT_AUTHORIZED'?403:code==='CONFLICT'?409:['STORAGE_FAILED','SERVER_ERROR'].includes(code)?503:400;
  return reply({code,traceId},status);
 }
});
