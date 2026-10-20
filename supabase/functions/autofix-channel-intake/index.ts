import {accountMember} from '../autofix-listings/accounts.ts';
import {rest,config} from './store.ts';
import {readLimited,sameSecret} from './receive.ts';
import {setupTelegram} from './telegram.ts';
import {intake} from './intake.ts';
Deno.serve(async(req:Request)=>{
 const traceId=crypto.randomUUID(),reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST')return reply({code:'METHOD_REJECTED',traceId},405);
 try{
  const channel=new URL(req.url).searchParams.get('channel');
  if(channel==='admin'){
   const actor=await accountMember(req,rest);if(actor.dealer.role!=='admin')throw new Error('ADMIN_REQUIRED');
   const input=JSON.parse(new TextDecoder().decode(await readLimited(req,2048)));
   if(input.action==='telegram-status'||input.action==='telegram-activate')return reply(await setupTelegram(input.action==='telegram-activate'));
   if(input.action==='email-provision'){
    const settings=await config('email');await rest('autofix_channel_config?channel=eq.email','PATCH',{enabled:true});
    return reply({address:settings.address,secret:settings.secret});
   }
   throw new Error('INVALID_ACTION');
  }
  if(channel!=='email'&&channel!=='telegram')throw new Error('INVALID_CHANNEL');
  const settings=await config(channel),header=channel==='telegram'?'x-telegram-bot-api-secret-token':'x-autofix-mail-secret';
  if(!settings?.enabled||!await sameSecret(settings.secret,req.headers.get(header)))return reply({code:'UNAUTHORIZED',traceId},401);
  if(channel==='email'&&req.headers.get('x-envelope-to')!==settings.address)throw new Error('INVALID_RECIPIENT');
  return reply(await intake(channel,await readLimited(req,channel==='telegram'?1024*1024:undefined),req));
 }catch(error){
  const message=error instanceof Error?error.message:'';
  const code=error instanceof SyntaxError?'INVALID_INPUT':/^[A-Z][A-Z0-9_]+$/.test(message)?message:'SERVER_ERROR';console.error(JSON.stringify({traceId,code}));
  const status=['LOGIN_REQUIRED','INVALID_SESSION'].includes(code)?401:code==='ADMIN_REQUIRED'?403:code==='PAYLOAD_TOO_LARGE'?413:code.startsWith('INVALID')?400:503;
  return reply({code:status===503?'CHANNEL_UNAVAILABLE':code,traceId},status);
 }
});
