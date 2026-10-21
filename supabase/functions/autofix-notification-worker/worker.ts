import {forumTarget} from '../_shared/telegram-forum.js';
import {notifyGalleryReceipt,notifyReceipt} from '../autofix-accident-intake/telegram.ts';
import {readCheckpoint,retryDecision} from '../autofix-accident-intake/notification-state.ts';
import {checkHealth} from './health.ts';

type Rest=(path:string,method?:string,body?:unknown)=>Promise<any>;
type Services={env:(name:string)=>string,rest:Rest,now?:()=>number,health?:()=>Promise<any>,notify?:(id:string,rest:Rest,options:any)=>Promise<string>};
export async function runRetries(input:any,services:Services){
 const health=await (services.health?services.health():checkHealth(services.env));
 if(!health.ok)return {status:'health_blocked',processed:0,health};
 const target=forumTarget(services.env,'intake'),now=services.now||Date.now,deadline=Date.now()+85000;
 const limit=Math.min(2,Math.max(1,Number(input.limit)||1)),results:any[]=[];
 const filters=input.ids?.length?'&id=in.('+input.ids.join(',')+')':'';
 const since=target.forum?'&created_at=gte.'+encodeURIComponent(target.startsAt):'';
 const states='&or=(telegram_status.eq.pending,and(telegram_status.eq.sending,telegram_claimed_at.lt.'+encodeURIComponent(new Date(now()-300000).toISOString())+'))';
 let processed=0,scanned=0,limited=false;
 for(let offset=0;offset<1000&&processed<limit;offset+=10){
  if(Date.now()+65000>=deadline){limited=true;break;}
  const rows=await services.rest('/rest/v1/autofix_accident_intakes?status=eq.complete'+states+filters+since+'&order=created_at.asc,id.asc&limit=10&offset='+offset);
  for(const row of rows){
   if(Date.now()+65000>=deadline){limited=true;break;}
   if(processed>=limit)break;scanned++;
   const options={context:null,now:now(),includeTest:input.includeTest===true&&input.ids?.includes(row.id)};
   let decision=retryDecision(row,target,options);
   if(!decision.allowed){results.push({id:row.id,status:'skipped',reason:decision.reason});continue;}
   const context=(await services.rest('/rest/v1/autofix_intake_acquisition?intake_id=eq.'+row.id+'&select=context'))[0]?.context??null;
   decision=retryDecision(row,target,{...options,context});
   if(!decision.allowed){results.push({id:row.id,status:'skipped',reason:decision.reason});continue;}
   if(Date.now()+65000>=deadline){limited=true;break;}
   if(!await services.rest('/rest/v1/rpc/autofix_claim_telegram','POST',{p_id:row.id})){results.push({id:row.id,status:'busy'});continue;}
   processed++;results.push(await processClaimed(row.id,context,input,services,target,now,deadline));
  }
  if(limited||rows.length<10)break;
  if(offset===990)limited=true;
 }
 return {status:limited?'scan_limited':'processed',processed,scanned,results};
}
async function processClaimed(id:string,context:any,input:any,services:Services,target:any,now:()=>number,deadline:number){
 const path='/rest/v1/autofix_accident_intakes?id=eq.'+id;
 try{
  const row=(await services.rest(path+'&select=*'))[0];
  // Recheck the locked row: a previous delivery may have advanced while we were selecting.
  const decision=retryDecision({...row,telegram_status:'pending'},target,{context,now:now(),includeTest:input.includeTest===true&&input.ids?.includes(id)});
  if(!decision.allowed){await services.rest(path,'PATCH',{telegram_status:'pending'});return {id,status:'skipped',reason:decision.reason};}
  const progress=readCheckpoint(row)||{receipt_layout:4,acquisition_format:true},attempts=(progress.reliability?.attempts||0)+1;
  progress.reliability={attempts,runs:(progress.reliability?.runs||0)+1,lastAttemptAt:new Date(now()).toISOString(),nextAttemptAt:new Date(now()+[60000,300000,1800000][attempts-1]).toISOString()};
  await services.rest(path,'PATCH',{telegram_message_id:JSON.stringify(progress)});
  const notify=services.notify||(progress.version===2?notifyReceipt:notifyGalleryReceipt);
  const status=await notify(id,services.rest,{claimed:true,resumeRejected:true,maxOperations:2,deadline});
  return {id,status,attempts};
 }catch{
  // Do not release a lease after an unknown write/send outcome. Manual review is safer.
  return {id,status:'manual_review_required',reason:'WORKER_OUTCOME_UNCONFIRMED'};
 }
}
