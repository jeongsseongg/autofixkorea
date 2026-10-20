export const limit=20*1024*1024;
export async function digest(data:Uint8Array|string){
 const bytes=typeof data==='string'?new TextEncoder().encode(data):data;
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes))),n=>n.toString(16).padStart(2,'0')).join('');
}
export async function sameSecret(expected:string,provided:string|null){
 return !!expected&&!!provided&&await digest(expected)===await digest(provided);
}
export async function readLimited(req:Request,max=limit){
 if(Number(req.headers.get('content-length'))>max)throw new Error('PAYLOAD_TOO_LARGE');
 const reader=req.body?.getReader();if(!reader)throw new Error('INVALID_INPUT');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Error('PAYLOAD_TOO_LARGE');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export function telegramEnvelope(body:any){
 const m=body.message||body.channel_post||body.edited_message;
 if(!Number.isSafeInteger(body.update_id)||!m?.chat||!Number.isSafeInteger(m.chat.id)||m.from?.is_bot)return null;
 const file=m.photo?.at(-1)||m.document||m.video||m.audio||m.voice||m.animation||m.video_note;
 const text=m.caption||m.text||'';
 return {event:String(body.update_id),command:/^\/(start|help)(?:\s|$)/.test(text),file,
  chat:m.chat.id,messageId:m.message_id,
  fields:{source:'telegram',sender:String(m.chat.id),name:[m.from?.first_name,m.from?.last_name].filter(Boolean).join(' '),username:m.from?.username||'',message:text,album:m.media_group_id||'',contact:m.contact||null,location:m.location||null,original:m}};
}
export function safeMime(bytes:Uint8Array){
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return 'image/png';
 const start=new TextDecoder().decode(bytes.slice(0,12));
 if(start.startsWith('RIFF')&&start.slice(8)==='WEBP')return 'image/webp';
 return 'application/octet-stream';
}
