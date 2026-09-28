import {publicKey} from '../../config/supabase-public.js';
const endpoint='https://ytigiculewerivyytxza.supabase.co/functions/v1/autofix-listings';
const sessionKey='autofix-listing-session';
export function hasSession(){return !!sessionStorage.getItem(sessionKey);}
export async function logout(){try{await request('logout');}finally{sessionStorage.removeItem(sessionKey);}}
export async function authenticate(role,password,login_id,code){
 const data=await request(role==='setup'?'bootstrap':'login-'+role,{password,login_id,code});
 sessionStorage.setItem(sessionKey,data.token);return true;
}
export async function request(action,values={}){
 const token=sessionStorage.getItem(sessionKey);
 const headers={apikey:publicKey,'Content-Type':'application/json'};
 if(token)headers.Authorization='Bearer '+token;
 const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({action,...values})});
 if(!response.ok){
  const data=await response.json();if(response.status===401)sessionStorage.removeItem(sessionKey);
  const messages={LOGIN_REQUIRED:'다시 로그인해 주세요.',INVALID_SESSION:'로그인이 만료되었거나 이용이 중지되었습니다.',INVALID_ADMIN_PASSWORD:'비밀번호를 확인해 주세요.',INVALID_DEALER_LOGIN:'업체 아이디·비밀번호 또는 이용 상태를 확인해 주세요.',INVALID_SETUP_CODE:'관리자 설정 코드를 확인해 주세요.',ADMIN_EXISTS:'관리자가 이미 설정되어 있습니다. 관리자 로그인을 이용해 주세요.',RATE_LIMITED:'로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.',APPROVAL_REQUIRED:'업체 승인 후 이용할 수 있습니다.',ADMIN_REQUIRED:'관리자만 이용할 수 있습니다.',INVALID_INPUT:'입력 항목을 확인해 주세요.',SERVER_ERROR:'처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'};
  throw new Error((messages[data.code]||'요청을 처리하지 못했습니다.')+' 접수 ID: '+(data.traceId||''));
 }
 return action==='photo'?response.blob():response.json();
}
