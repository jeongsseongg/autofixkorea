type Database=(path:string,method?:string,body?:unknown)=>Promise<any>;
export async function accountAction(input:any,req:Request,rest:Database){
 const actions=['login-admin','login-dealer','bootstrap'];
 if(!actions.includes(input.action))return undefined;
 if(typeof input.password!=='string'||input.password.length>72||!input.password)throw new Error('INVALID_INPUT');
 const allowed=await rest('rpc/ofa_login_attempt','POST',{p_key:input.action});
 if(!allowed)throw new Error('RATE_LIMITED');
 if(input.action==='bootstrap')return rest('rpc/ofa_secure_bootstrap','POST',{p_password:input.password,p_code:typeof input.code==='string'?input.code:''});
 if(input.action==='login-admin')return rest('rpc/ofa_admin_login','POST',{p_password:input.password});
 if(typeof input.login_id!=='string'||!/^[a-zA-Z0-9_.-]{3,60}$/.test(input.login_id))throw new Error('INVALID_INPUT');
 return rest('rpc/ofa_dealer_login','POST',{p_login_id:input.login_id,p_password:input.password});
}
export async function accountMember(req:Request,rest:Database){
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
 if(!/^[a-f0-9]{64}$/.test(token))throw new Error('LOGIN_REQUIRED');
 const user=await rest('rpc/ofa_validate_session','POST',{p_token:token});
 return {id:user.account_id,token,dealer:{id:user.account_id,company:user.account_name,login_id:user.login_id,role:user.role,status:'approved'}};
}
export async function manageAccounts(input:any,token:string,rest:Database){
 if(input.action==='members')return rest('ofa_dealers?select=id,login_id,name,status,created_at&order=created_at.desc&limit=100');
 if(input.action==='dealer-save'){
  if(typeof input.login_id!=='string'||!/^[a-zA-Z0-9_.-]{3,60}$/.test(input.login_id)||typeof input.name!=='string'||!input.name.trim()||input.name.length>100||typeof input.password!=='string'||input.password.length<8||input.password.length>72)throw new Error('INVALID_INPUT');
  return rest('rpc/ofa_upsert_dealer','POST',{p_token:token,p_payload:{login_id:input.login_id,name:input.name,password:input.password}});
 }
 if(input.action==='approve'){
  if(!/^[0-9a-f-]{36}$/.test(input.id)||!['approved','suspended'].includes(input.status))throw new Error('INVALID_INPUT');
  return rest('ofa_dealers?id=eq.'+input.id,'PATCH',{status:input.status});
 }
 return undefined;
}
