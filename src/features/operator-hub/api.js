import {publicKey} from '../../config/supabase-public.js';
export const $=id=>document.getElementById('hub-'+id);
export const labels={accident:'상세 입력폼',consultation:'간편 상담폼',email:'이메일',telegram:'텔레그램'};
export const statuses={received:'접수',reviewing:'확인 중',quoted:'견적 안내',closed:'완료'};
export function node(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
export async function api(action,data={}){
 const token=sessionStorage.getItem('autofix-listing-session')||'';
 const response=await fetch('https://ytigiculewerivyytxza.supabase.co/functions/v1/autofix-hub',{method:'POST',headers:{apikey:publicKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,...data})});
 if(!response.ok){const error=await response.json();const message=response.status===401?'다시 로그인해 주세요.':response.status===403?'운영자만 열람할 수 있습니다.':'처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';throw new Error(message+' 확인번호: '+error.traceId);}
 return action==='photo'?response.blob():response.json();
}
export function download(name,value){
 const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
