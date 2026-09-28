import {publicKey} from '../../config/supabase-public.js';
const base='https://ytigiculewerivyytxza.supabase.co';
const endpoint=base+'/functions/v1/autofix-listings';
const sessionKey='autofix-listing-session';
export function logout(){sessionStorage.removeItem(sessionKey);}
export function hasSession(){return !!sessionStorage.getItem(sessionKey);}
export async function authenticate(email,password,signup=false){
 const response=await fetch(base+'/auth/v1/'+(signup?'signup':'token?grant_type=password'),{
  method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json'},body:JSON.stringify({email,password}),
 });
 const data=await response.json();if(!response.ok)throw new Error('이메일·비밀번호와 이메일 인증 여부를 확인해 주세요.');
 if(data.access_token)sessionStorage.setItem(sessionKey,data.access_token);
 return !!data.access_token;
}
export async function request(action,values={}){
 const token=sessionStorage.getItem(sessionKey);if(!token)throw new Error('로그인이 필요합니다.');
 const response=await fetch(endpoint,{method:'POST',headers:{apikey:publicKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,...values})});
 if(!response.ok){
  const data=await response.json();if(response.status===401)logout();
  const messages={LOGIN_REQUIRED:'다시 로그인해 주세요.',APPROVAL_REQUIRED:'업체 승인 후 이용할 수 있습니다.',ADMIN_REQUIRED:'관리자만 이용할 수 있습니다.',INVALID_INPUT:'입력 항목을 확인해 주세요.',SERVER_ERROR:'처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'};
  throw new Error((messages[data.code]||'요청을 처리하지 못했습니다.')+' 접수 ID: '+(data.traceId||''));
 }
 return action==='photo'?response.blob():response.json();
}
