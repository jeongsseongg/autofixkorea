import PostalMime from 'npm:postal-mime@4.0.0';
import {digest,telegramEnvelope,safeMime} from './receive.ts';
import {rest,saveFile} from './store.ts';
import {downloadTelegram,notify,telegram} from './telegram.ts';
export async function intake(channel:string,raw:Uint8Array,req:Request){
 const event=channel==='telegram'?telegramEnvelope(JSON.parse(new TextDecoder().decode(raw))):null;
 if(channel==='telegram'&&!event)return {ignored:true};
 if(event?.command){await telegram('sendMessage',{chat_id:event.chat,text:'오토픽스코리아 접수 봇입니다. 차량 정보·희망가격·연락처와 사진을 보내주시면 비공개로 접수합니다. 공개 매물로 자동 게시되지 않습니다.'});return {success:true};}
 const eventId=event?.event||await digest(raw),query='channel=eq.'+channel+'&event_id=eq.'+eventId;
 const existing=(await rest('autofix_channel_messages?'+query+'&select=id'))[0];if(existing)return {id:existing.id,duplicate:true};
 const hash=await digest(channel+':'+eventId),id=[hash.slice(0,8),hash.slice(8,12),hash.slice(12,16),hash.slice(16,20),hash.slice(20,32)].join('-');
 const files:{bytes:Uint8Array,name:string,mime:string}[]=[];
 let fields:any=event?.fields;
 if(channel==='email'){
  const mail=await PostalMime.parse(raw);
  fields={source:'email',sender:decodeURIComponent(req.headers.get('x-envelope-from')||''),to:'inbox@autofixkorea.com',subject:mail.subject||'',message:mail.text||mail.html||'',from:mail.from,messageId:mail.messageId||'',date:mail.date||''};
  files.push({bytes:raw,name:'original.eml',mime:'application/octet-stream'});
  for(const attachment of mail.attachments){const bytes=new Uint8Array(attachment.content as ArrayBuffer);files.push({bytes,name:attachment.filename||'attachment',mime:safeMime(bytes)});}
 }else if(event?.file){
  const bytes=await downloadTelegram(event.file);
  if(bytes)files.push({bytes,name:event.file.file_name||'telegram-image',mime:safeMime(bytes)});
  else fields.attachmentStatus='파일이 20MB를 초과하거나 다운로드할 수 없어 텔레그램 원본에서 확인해야 합니다.';
 }
 const photos=[];for(let i=0;i<files.length;i++)photos.push(await saveFile(id,i,files[i].bytes,files[i].name));
 const row={id,channel,event_id:eventId,fields,photos};
 const inserted=await rest('autofix_channel_messages?on_conflict=channel,event_id','POST',row);
 if(!inserted.length)return {duplicate:true};
 try{await notify(row,event,files);await rest('autofix_channel_messages?id=eq.'+id,'PATCH',{telegram_status:'sent'});}
 catch(error){const message=error instanceof Error?error.message:'';const code=/^[A-Z][A-Z0-9_]+$/.test(message)?message:'NOTIFICATION_FAILED';console.error(JSON.stringify({receiptId:id,code}));await rest('autofix_channel_messages?id=eq.'+id,'PATCH',{telegram_status:'failed',notification_error:code});}
 return {id,success:true};
}
