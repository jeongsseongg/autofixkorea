import {limit,safeMime} from './receive.ts';
export const base=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const auth={apikey:key,Authorization:'Bearer '+key};
export async function rest(path:string,method='GET',body?:unknown){
 const r=await fetch(base+'/rest/v1/'+path,{method,headers:{...auth,'Content-Type':'application/json',Prefer:'return=representation,resolution=ignore-duplicates'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 if(!r.ok){const text=await r.text();throw new Error(text.includes('INVALID_SESSION')?'INVALID_SESSION':'DATABASE_FAILED');}return r.json();
}
export async function saveFile(id:string,index:number,bytes:Uint8Array,name:string){
 if(bytes.length>limit)throw new Error('PAYLOAD_TOO_LARGE');
 const path=id+'/'+index,mime=safeMime(bytes);
 const r=await fetch(base+'/storage/v1/object/autofix-channel-files/'+path,{method:'POST',headers:{...auth,'Content-Type':mime,'x-upsert':'true'},body:new Uint8Array(bytes),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw new Error('STORAGE_FAILED');return {path,mime,name,size:bytes.length};
}
export async function config(channel:string){return (await rest('autofix_channel_config?channel=eq.'+channel+'&select=*'))[0];}
