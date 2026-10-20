import {receiptText,receiptParts} from './telegram-content.ts';
// Photos arrive as Telegram albums so the client can save them to Photos/Gallery.
export function galleryOperations(row:any){
 const text=receiptText(row),digits=String(row.values.contact||'').replace(/[^0-9]/g,'');
 const reply_markup=/^0\d{9,10}$/.test(digits)?{inline_keyboard:[[{text:'전화번호 복사',copy_text:{text:digits}}]]}:undefined;
 const operations:any[]=receiptParts(text).map((part,i)=>({kind:'text',text:part,...(i===0?{reply_markup}:{})}));
 let indices:number[]=[],bytes=0,documents=false;
 const flush=()=>{
  if(indices.length)operations.push({kind:'album',indices,asDocument:documents,
   caption:'오토픽스코리아 · '+row.id+'\n'+(documents?'원본 사진':'차량 사진')+' '+indices.length+'장\n휴대폰: 사진첩에 저장 · PC: 전체 선택 → 선택 항목 다운로드'});
  indices=[];bytes=0;
 };
 for(let i=0;i<row.photos.length;i++){
  const p=row.photos[i],isDocument=p.size>10000000;
  if(indices.length&&(indices.length===10||bytes+p.size>25000000||documents!==isDocument))flush();
  documents=isDocument;indices.push(i);bytes+=p.size;
 }
 flush();
 operations.push({kind:'receipt',text});
 return operations;
}
