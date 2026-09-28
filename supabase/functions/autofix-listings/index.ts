import {manualListing} from '../autofix-listing-ingest/manual.ts';
import {accountAction,accountMember,manageAccounts} from './accounts.ts';
const base=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const auth={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
const origins=new Set(['https://autofixkorea.com','https://www.autofixkorea.com','https://autofixkorea.web.app','https://autofixkorea.firebaseapp.com','https://autofixkorea--unified-listings-a2ykn7fk.web.app','http://localhost:4328','http://127.0.0.1:4328']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function rest(path:string,method='GET',body?:unknown){
 const response=await fetch(base+'/rest/v1/'+path,{method,headers:{...auth,Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!response.ok){const body=await response.text();const code=['INVALID_ADMIN_PASSWORD','INVALID_DEALER_LOGIN','INVALID_SESSION','INVALID_SETUP_CODE','ADMIN_EXISTS','INVALID_PASSWORD'].find(code=>body.includes(code));throw new Error(code||'DATABASE_FAILED');}return response.json();
}
function text(value:unknown,max:number){if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error('INVALID_INPUT');return value.trim();}
async function photo(input:any,admin:boolean){
 if(!uuid.test(input.id)||!Number.isInteger(input.index)||input.index<0||input.index>9)throw new Error('INVALID_INPUT');
 const rows=await rest('autofix_listings?id=eq.'+input.id+'&select=status,photos');
 const row=rows[0];if(!row||(!admin&&!['published','sold'].includes(row.status)))throw new Error('NOT_FOUND');
 const image=row.photos[input.index];if(!image||!/^[a-f0-9]{64}\/[0-9]+$/.test(image.path))throw new Error('NOT_FOUND');
 const response=await fetch(base+'/storage/v1/object/authenticated/autofix-listing-photos/'+image.path,{headers:auth,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('PHOTO_FAILED');
 return new Response(response.body,{headers:{'Content-Type':image.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
async function adminAction(input:any){
 if(input.action==='sources')return rest('autofix_listing_sources?order=label');
 if(input.action==='source-add'){
  if(!['telegram','email'].includes(input.channel))throw new Error('INVALID_INPUT');
  const sender=text(input.sender,254).toLowerCase();
  if(input.channel==='telegram'&&!/^-?\d+$/.test(sender))throw new Error('INVALID_INPUT');
  if(input.channel==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender))throw new Error('INVALID_INPUT');
  return rest('autofix_listing_sources','POST',{channel:input.channel,sender,label:text(input.label,100),auto_publish:input.auto_publish===true});
 }
 if(input.action==='inbox'){
  if(!uuid.test(input.id))throw new Error('INVALID_INPUT');
  return rest('autofix_listing_inbox?listing_id=eq.'+input.id+'&select=channel,sender,raw_text,created_at&order=created_at');
 }
 if(input.action==='update'){
  if(!uuid.test(input.id)||!['review','published','sold','archived'].includes(input.status))throw new Error('INVALID_INPUT');
  const update:any={status:input.status,updated_at:new Date().toISOString()};
  for(const field of ['title','fuel','accident_type','region'])update[field]=text(input[field],field==='title'?120:80);
  update.description=typeof input.description==='string'?input.description.slice(0,1500):'';
  for(const field of ['year','mileage_km','price_krw']){
   const value=Number(input[field]);if(!Number.isSafeInteger(value)||value<0)throw new Error('INVALID_INPUT');update[field]=value;
  }
  return rest('autofix_listings?id=eq.'+input.id,'PATCH',update);
 }
 throw new Error('INVALID_ACTION');
}
Deno.serve(async(req:Request)=>{
 const traceId=crypto.randomUUID(),origin=req.headers.get('origin')||'';
 const cors={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://www.autofixkorea.com','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({code:'METHOD_REJECTED',traceId},405);
 try{
  const raw=await req.text();if(raw.length>14000000)throw new Error('INVALID_INPUT');
  const input=JSON.parse(raw);
  const login=await accountAction(input,req,rest);if(login!==undefined)return reply(login);
  const actor=await accountMember(req,rest);
  if(input.action==='logout')return reply(await rest('rpc/ofa_logout','POST',{p_token:actor.token}));
  if(input.action==='me')return reply(actor.dealer);
  if(actor.dealer?.status!=='approved')throw new Error('APPROVAL_REQUIRED');
  const admin=actor.dealer.role==='admin';
  if(input.action==='list')return reply(await rest('autofix_listings?select=*&order=created_at.desc&limit=100'+(admin?'':'&status=in.(published,sold)')));
  if(input.action==='photo'){
   const response=await photo(input,admin);for(const [k,v] of Object.entries(cors))response.headers.set(k,v);return response;
  }
  if(!admin)throw new Error('ADMIN_REQUIRED');
  if(input.action==='create')return reply(await manualListing(input,rest));
  const accounts=await manageAccounts(input,actor.token,rest);
  return reply(accounts!==undefined?accounts:await adminAction(input));
 }catch(error){
  const code=error instanceof Error?error.message:'SERVER_ERROR';console.error(JSON.stringify({traceId,code}));
  const status=code==='RATE_LIMITED'?429:['LOGIN_REQUIRED','INVALID_ADMIN_PASSWORD','INVALID_DEALER_LOGIN','INVALID_SESSION','INVALID_SETUP_CODE'].includes(code)?401:['APPROVAL_REQUIRED','ADMIN_REQUIRED'].includes(code)?403:code==='NOT_FOUND'?404:/INVALID|ALREADY/.test(code)?400:503;
  return reply({code:status===503?'SERVER_ERROR':code,traceId},status);
 }
});
