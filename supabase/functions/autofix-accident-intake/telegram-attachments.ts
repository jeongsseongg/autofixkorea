import {receiptText,receiptParts} from './telegram-content.ts';
import {photoArchive} from './telegram-archive.ts';
import {receiptNotificationText} from './telegram-summary.ts';
export function receiptOperations(row:any){
 const text=receiptText(row),digits=String(row.values.contact||'').replace(/[^0-9]/g,'');
 const reply_markup=/^0\d{9,10}$/.test(digits)?{inline_keyboard:[[{text:'전화번호 복사',copy_text:{text:digits}}]]}:undefined;
 const operations:any[]=receiptParts(receiptNotificationText(row)).map((part,i)=>({kind:'text',text:part,...(i===0?{reply_markup}:{})}));
 let album:number[]=[],bytes=0;
 const flush=()=>{if(album.length){operations.push({kind:'album',indices:album,caption:'오토픽스코리아 · '+row.id+' · 차량 사진'});album=[];bytes=0;}};
 for(let i=0;i<row.photos.length;i++){
  const p=row.photos[i];
  if(p.mime==='image/webp'||p.size>10000000){flush();continue;}
  if(album.length===10||bytes+p.size>25000000)flush();
  album.push(i);bytes+=p.size;
 }
 flush();
 operations.push({kind:'receipt',text});
 let originals:number[]=[],size=0;
 const archive=()=>{if(originals.length){operations.push({kind:'archive',indices:originals,part:operations.filter(o=>o.kind==='archive').length+1});originals=[];size=0;}};
 for(let i=0;i<row.photos.length;i++){if(size+row.photos[i].size>25000000)archive();originals.push(i);size+=row.photos[i].size;}
 archive();
 return operations;
}
async function original(row:any,index:number){
 const p=row.photos[index],base=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(!p.path.startsWith(row.id+'/')||p.path.includes('..'))throw Error('INVALID_PHOTO_PATH');
 const r=await fetch(base+'/storage/v1/object/authenticated/autofix-accident-photos/'+p.path,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('PHOTO_DOWNLOAD_FAILED');
 const blob=await r.blob();if(blob.size!==p.size)throw Error('PHOTO_SIZE_MISMATCH');return blob;
}
function filename(row:any,index:number){return 'autofix-'+row.id+'-'+String(index+1).padStart(2,'0')+'-'+(row.photos[index].category==='interior'?'interior':'vehicle')+'.'+row.photos[index].path.split('.').pop();}
export async function attachmentBody(row:any,operation:any,chat:string,asDocument=false){
 const body=new FormData();body.set('chat_id',chat);body.set('protect_content','false');
 if(operation.kind==='receipt'){
  body.set('document',new Blob(['\uFEFF'+operation.text],{type:'text/plain;charset=utf-8'}),'autofix-'+row.id+'-receipt.txt');
  body.set('caption','접수 글 저장 · '+row.id);return {method:'sendDocument',body,count:1};
 }
 if(operation.kind==='archive'){
  const entries=[];for(const index of operation.indices)entries.push({name:filename(row,index),blob:await original(row,index)});
  body.set('document',await photoArchive(entries),'autofix-'+row.id+'-photos-'+operation.part+'.zip');
  body.set('caption','사진 원본 묶음 다운로드 · '+operation.indices.length+'장 · '+operation.part+'번 파일\n앨범 사진은 휴대폰의 갤러리 자동 저장 설정을 켜면 저장됩니다. ZIP 원본은 파일 앱에 저장됩니다.');
  return {method:'sendDocument',body,count:1};
 }
 const indices=operation.kind==='album'?operation.indices:[operation.index];
 const type=operation.kind==='original'||asDocument?'document':'photo';
 const caption=operation.caption||'접수번호: '+row.id+'\n'+(row.photos[indices[0]].category==='interior'?'실내':'차량')+' 사진 '+(indices[0]+1)+' / '+row.photos.length+' · 원본 저장';
 const media=[];
 for(const [position,index] of indices.entries()){
  const name=indices.length===1?type:'file'+position;
  body.set(name,await original(row,index),filename(row,index));
  media.push({type,media:'attach://'+name,...(position===0?{caption}:{}),...(type==='document'?{disable_content_type_detection:true}:{})});
 }
 if(indices.length===1){body.set('caption',caption);return {method:type==='photo'?'sendPhoto':'sendDocument',body,count:1};}
 body.set('media',JSON.stringify(media));return {method:'sendMediaGroup',body,count:indices.length};
}
