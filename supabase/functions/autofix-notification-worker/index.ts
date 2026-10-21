import {runRetries} from './worker.ts';
import {checkHealth} from './health.ts';
import {authorizeAdmin} from './auth.ts';

type Services={env:(name:string)=>string,rest?:(path:string,method?:string,body?:unknown)=>Promise<any>,health?:()=>Promise<any>,fetch?:typeof fetch};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function handleRequest(req:Request,services:Services){
 const traceId=crypto.randomUUID(),reply=(body:object,status=200)=>Response.json({...body,traceId},{status,headers:{'Cache-Control':'no-store'}});
 if(req.method!=='POST')return reply({code:'METHOD_NOT_ALLOWED'},405);
 const env=services.env,admin=await authorizeAdmin(req,env,services.fetch);
 let rest=services.rest;
 if(!admin){
  const key=req.headers.get('x-worker-key')||'';
  if(!/^[a-f0-9]{64}$/i.test(key))return reply({code:'UNAUTHORIZED'},401);
  try{rest??=database(env);if(await rest('/rest/v1/rpc/autofix_analytics_daily_authorize','POST',{p_secret:key})!==true)return reply({code:'UNAUTHORIZED'},401);}
  catch{return reply({code:'UNAUTHORIZED'},401);}
 }
 try{
  const raw=await req.text();if(raw.length>2048)return reply({code:'TOO_LARGE'},413);
  let input;try{input=JSON.parse(raw);}catch{return reply({code:'INVALID_JSON'},400);}
  if(!validInput(input))return reply({code:'INVALID_INPUT'},400);
  if(input.includeTest===true&&!admin)return reply({code:'ADMIN_REQUIRED'},403);
  if(input.action==='health')return reply(await (services.health?services.health():checkHealth(env)));
  return reply(await runRetries(input,{env,rest:rest||database(env),health:services.health}));
 }catch{
  console.error(JSON.stringify({traceId,code:'NOTIFICATION_WORKER_FAILED'}));
  return reply({code:'NOTIFICATION_WORKER_FAILED'},503);
 }
}
function validInput(input:any){
 if(!input||typeof input!=='object'||Array.isArray(input)||!['health','retry'].includes(input.action))return false;
 if(Object.keys(input).some(k=>!['action','ids','includeTest','limit'].includes(k)))return false;
 if(input.includeTest!==undefined&&typeof input.includeTest!=='boolean')return false;
 if(input.limit!==undefined&&![1,2].includes(input.limit))return false;
 if(input.ids!==undefined&&(!Array.isArray(input.ids)||input.ids.length<1||input.ids.length>2||input.ids.some((id:any)=>typeof id!=='string'||!uuid.test(id))||new Set(input.ids).size!==input.ids.length))return false;
 return input.includeTest!==true||input.ids?.length>0;
}
function database(env:(name:string)=>string){
 const base=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
 if(!base||!key)throw Error('DATABASE_NOT_CONFIGURED');
 return async(path:string,method='GET',body?:unknown)=>{
  const response=await fetch(base+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('DATABASE_REQUEST_FAILED');
  const text=await response.text();return text?JSON.parse(text):null;
 };
}
if(typeof Deno!=='undefined')Deno.serve(req=>handleRequest(req,{env:name=>Deno.env.get(name)||''}));
