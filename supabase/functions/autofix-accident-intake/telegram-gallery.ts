import {receiptText,receiptParts} from './telegram-content.ts';
import {receiptNotificationText} from './telegram-summary.ts';
import {receiptButtons,receiptLayout,receiptIdentity} from './telegram-receipt-display.ts';
// Photos arrive as Telegram albums so the client can save them to Photos/Gallery.
export function galleryOperations(row:any){
 const text=receiptText(row),layout=receiptLayout(row),modern=layout>=2,reply_markup=receiptButtons(row);
 const operations:any[]=receiptParts(receiptNotificationText(row)).map((part,i)=>({kind:'text',text:part,...(i===0?{reply_markup}:{})}));
 let indices:number[]=[],bytes=0,documents=false;
 const flush=()=>{
  if(indices.length)operations.push({kind:'album',indices,asDocument:documents,
   caption:layout>=4?`${receiptIdentity(row).vehicle}\n${documents?'원본 파일':'차량 사진'} ${indices[0]+1}~${indices.at(-1)!+1} / ${row.photos.length}장`:modern?`${receiptIdentity(row).label} · ${receiptIdentity(row).vehicle}\n${documents?'원본 파일':'차량 사진'} ${indices[0]+1}~${indices.at(-1)!+1} / ${row.photos.length}장\n사진 원본은 요약의 전체 접수 보기에서 저장할 수 있습니다.`:'오토픽스코리아 · '+row.id+'\n'+(documents?'원본 사진':'차량 사진')+' '+indices.length+'장\n휴대폰: 사진첩에 저장 · PC: 전체 선택 → 선택 항목 다운로드',...(modern?{replyToSummary:true}:{})});
  indices=[];bytes=0;
 };
 for(let i=0;i<row.photos.length;i++){
  const p=row.photos[i],isDocument=p.size>10000000;
  if(indices.length&&(indices.length===10||bytes+p.size>25000000||documents!==isDocument))flush();
  documents=isDocument;indices.push(i);bytes+=p.size;
 }
 flush();
 if(layout<4)operations.push({kind:'receipt',text,...(modern?{replyToSummary:true,caption:receiptIdentity(row).label+' · 전체 접수 글 원본'}:{})});
 return operations;
}
