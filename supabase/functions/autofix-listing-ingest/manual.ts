import {normalize,imageType} from './normalize.js';
type Database=(path:string,method?:string,body?:unknown)=>Promise<any>;
export async function manualListing(input:any,rest:Database){
 if(typeof input.text!=='string'||input.text.length>20000||!Array.isArray(input.photos)||!input.photos.length||input.photos.length>10||typeof input.event!=='string'||!/^[0-9a-f-]{36}$/.test(input.event))throw new Error('INVALID_INPUT');
 const bytes=new TextEncoder().encode(JSON.stringify({text:input.text,photos:input.photos}));
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 const base=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const photos=[];
 for(let i=0;i<input.photos.length;i++){
  if(typeof input.photos[i]!=='string'||input.photos[i].length>14000000)throw new Error('INVALID_INPUT');
  let image:Uint8Array;try{image=Uint8Array.from(atob(input.photos[i]),c=>c.charCodeAt(0));}catch{throw new Error('INVALID_INPUT');}
  if(!image.length||image.length>10485760)throw new Error('INVALID_INPUT');
  const mime=imageType(image),path=digest+'/'+i;
  const result=await fetch(base+'/storage/v1/object/autofix-listing-photos/'+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':mime,'x-upsert':'true'},body:image.buffer as ArrayBuffer,signal:AbortSignal.timeout(20000)});
  if(!result.ok)throw new Error('PHOTO_FAILED');photos.push({path,mime});
 }
 return rest('rpc/autofix_ingest_listing','POST',{p_channel:'manual',p_event:input.event,p_sender:'admin',p_hash:digest,p_raw:input.text,p_listing:normalize(input.text,photos),p_album:false,p_group:null});
}
