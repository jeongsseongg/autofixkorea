import {normalizeSubmission,telegramText} from './validation.mjs';

const env=(name:string)=>Deno.env.get(name)||'';
const origins=new Set(['https://autofix-independent.soun7701.chatgpt.site','https://www.autofixkorea.com','https://autofixkorea.com','http://127.0.0.1:4328']);
const service=env('SUPABASE_SERVICE_ROLE_KEY');
async function rest(path:string,body?:unknown,method='POST') {
  const response=await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`,{
    method,headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000),
  });
  if(!response.ok) {
    const text=await response.text();
    if(text.includes('RATE_LIMITED'))throw new Error('RATE_LIMITED');
    if(text.includes('IDEMPOTENCY_CONFLICT'))throw new Error('IDEMPOTENCY_CONFLICT');
    throw new Error('STORAGE_FAILED');
  }
  const text=await response.text();
  return text?JSON.parse(text):null;
}
async function hash(text:string) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function deliver(id:string|null) {
  if(!env('AUTOFIX_TELEGRAM_BOT_TOKEN')||!env('AUTOFIX_TELEGRAM_CHAT_ID'))return 'pending';
  const rows=await rest('rpc/autofix_claim',{p_id:id});
  let status='pending';
  for(const row of rows) {
    try {
      const response=await fetch(`https://api.telegram.org/bot${env('AUTOFIX_TELEGRAM_BOT_TOKEN')}/sendMessage`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({chat_id:env('AUTOFIX_TELEGRAM_CHAT_ID'),text:telegramText(row)}),signal:AbortSignal.timeout(10000),
      });
      const result=await response.json();
      if(!response.ok||!result.ok)throw new Error('TELEGRAM_REJECTED');
      await rest(`autofix_consultations?id=eq.${row.id}`,{telegram_status:'sent',telegram_message_id:String(result.result.message_id),lease_until:null,last_error_code:null},'PATCH');
      status='sent';
    } catch {
      await rest(`autofix_consultations?id=eq.${row.id}`,{telegram_status:'failed',lease_until:null,last_error_code:'TELEGRAM_DELIVERY_FAILED',next_attempt_at:new Date(Date.now()+Math.min(3600000,60000*2**row.attempts)).toISOString()},'PATCH');
      console.error(JSON.stringify({requestId:row.id,code:'TELEGRAM_DELIVERY_FAILED'}));
    }
  }
  return status;
}
Deno.serve(async(req:Request)=>{
  const requestId=crypto.randomUUID();
  const origin=req.headers.get('origin')||'';
  const headers={'Content-Type':'application/json','Vary':'Origin',
    ...(origins.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),
    'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
    'Access-Control-Allow-Methods':'POST,OPTIONS'};
  const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply({success:false,code:'METHOD_NOT_ALLOWED',requestId},405);
  // The gateway checks JWTs; only the service-role credential can invoke queue retries.
  if(req.headers.get('authorization')===`Bearer ${service}` && new URL(req.url).pathname.endsWith('/retry')) {
    try {await deliver(null);return reply({success:true,requestId});}
    catch {console.error(JSON.stringify({requestId,code:'RETRY_FAILED'}));return reply({success:false,code:'RETRY_FAILED',requestId},500);}
  }
  if(!origins.has(origin))return reply({success:false,code:'ORIGIN_NOT_ALLOWED',requestId},403);
  try {
    const raw=await req.text();
    if(raw.length>16000)return reply({success:false,code:'BODY_TOO_LARGE',requestId},413);
    let input;
    try {input=normalizeSubmission(JSON.parse(raw));}
    catch(error) {return reply({success:false,code:error instanceof Error?error.message:'INVALID_INPUT',requestId},400);}
    const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
    const receipt=await rest('rpc/autofix_accept',{
      p_id:input.requestId,p_form:input.formType,p_page:input.page,p_fields:input.fields,p_consent:input.consentVersion,
      p_hash:await hash(JSON.stringify(input)),p_ip:await hash(service+ip),
    });
    let notification=receipt.telegram_status;
    if(notification!=='sent') {
      try {notification=await deliver(receipt.id);}catch {console.error(JSON.stringify({requestId:receipt.id,code:'NOTIFICATION_PENDING'}));}
    }
    return reply({success:true,receiptId:receipt.id,notification,requestId});
  } catch(error) {
    const message=error instanceof Error?error.message:'';
    const code=['RATE_LIMITED','IDEMPOTENCY_CONFLICT'].includes(message)?message:'STORAGE_FAILED';
    console.error(JSON.stringify({requestId,code}));
    return reply({success:false,code,requestId},code==='RATE_LIMITED'?429:code==='IDEMPOTENCY_CONFLICT'?409:503);
  }
});
