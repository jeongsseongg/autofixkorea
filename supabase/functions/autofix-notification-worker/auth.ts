export async function authorizeAdmin(req:Request,env:(name:string)=>string,fetcher:typeof fetch=fetch){
 const authorization=req.headers.get('authorization')||'',service=env('SUPABASE_SERVICE_ROLE_KEY');
 if(service&&authorization==='Bearer '+service)return true;
 const credential=/^Bearer ([^\s]+)$/i.exec(authorization)?.[1],base=env('SUPABASE_URL');
 if(!credential||credential.length>8192||!base)return false;
 try{
  const response=await fetcher(base.replace(/\/$/,'')+'/rest/v1/rpc/autofix_notification_authorize',{
   method:'POST',redirect:'error',headers:{apikey:credential,Authorization:'Bearer '+credential,'Content-Type':'application/json'},
   body:'{}',signal:AbortSignal.timeout(15000)
  });
  return response.status===200&&await response.json()===true;
 }catch{return false;}
}
