type Rest = (path:string,method?:string,body?:unknown)=>Promise<any>;

// Only receipt metadata goes to the owner's explicitly selected private chat.
export async function notifyReceipt(id:string,rest:Rest){
 const token=Deno.env.get('AUTOFIX_TELEGRAM_BOT_TOKEN');
 const chat=Deno.env.get('AUTOFIX_TELEGRAM_CHAT_ID');
 if(!token||!chat)return 'not_configured';
 const claimed=await rest('/rest/v1/rpc/autofix_claim_telegram','POST',{p_id:id});
 if(!claimed)return 'already_sent_or_busy';
 let code='TELEGRAM_UNAVAILABLE';
 for(let attempt=0;attempt<2;attempt++){
  try{
   const response=await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{
    method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),
    body:JSON.stringify({chat_id:chat,text:'오토픽스코리아 · 새로운 상담 신청\n접수번호: '+id+'\n답변과 사진 저장이 완료되었습니다.\n관리자 확인: https://supabase.com/dashboard/project/ytigiculewerivyytxza/editor',link_preview_options:{is_disabled:true}}),
   });
   const result=await response.json();
   if(response.ok&&result.ok){
    await rest('/rest/v1/autofix_accident_intakes?id=eq.'+id,'PATCH',{telegram_status:'sent',telegram_sent_at:new Date().toISOString(),telegram_message_id:String(result.result.message_id),telegram_error:null});
    return 'sent';
   }
   code='TELEGRAM_HTTP_'+response.status;
   if(response.status===429||response.status===400||response.status===403)break;
  }catch{code='TELEGRAM_DELIVERY_UNCONFIRMED';}
 }
 await rest('/rest/v1/autofix_accident_intakes?id=eq.'+id,'PATCH',{telegram_status:'pending',telegram_error:code});
 console.error(JSON.stringify({traceId:id,code}));
 return 'pending';
}
