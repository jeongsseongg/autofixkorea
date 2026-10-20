import {serviceTypes} from './form-fields.js';
import {acquisition,acquisitionLines} from './acquisition.js';
import {receiptText} from './telegram-content.ts';
const short=(value:unknown,max=70)=>Array.from(String(value??'미입력').replace(/\s+/g,' ')).slice(0,max).join('');
export function receiptNotificationText(row:any){
 // A legacy checkpoint must reproduce its exact original operations and hash.
 let saved;try{saved=JSON.parse(row.telegram_message_id||'null');}catch{/* Delivery validates malformed checkpoints. */}
 return saved&&saved.summary_format!==true?receiptText(row):receiptSummary(row);
}
export function receiptSummary(row:any){
 const v=row.values,ctx=acquisition(row.acquisition),service=serviceTypes.find(x=>x[0]===v.service)?.[1]||'차량 접수';
 const date=new Date(row.completed_at||row.created_at);
 const time=Number.isNaN(+date)?'일시 확인 필요':new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
 const source=acquisitionLines(row.acquisition).filter(line=>/^(유입 경로|접속 기기|광고 키워드):/.test(line)).join(' · ');
 const contact=String(v.contact||'').replace(/[^0-9]/g,'').replace(/^(0\d{2})(\d{3,4})(\d{4})$/,'$1-$2-$3');
 return [
  `[오토픽스코리아 · ${service}]${ctx?.mode==='test'?' [TEST · 실제 고객 아님]':''}`,
  `접수번호 ${row.id} · ${time} 한국 시간`,
  `차량: ${short([v.manufacturer,v.group,v.model].filter(Boolean).join(' ')||'확인 필요')} · 연식 ${short(v.year,12)} · ${short(v.region,20)}`,
  `연락처: ${contact||'미입력'}`,
  `상태: ${short(v.damagePart||v.symptoms||v.condition||'상세 접수 내용 확인')}`,
  short(source,180),
  `사진 ${row.photos.length}장${v.vehiclePhotosLater?' · 사진 추후 제출':''} · 전체 입력 내용은 접수 글 파일/접수함에 보관`,
  '상세보기 (로그인 후 접수번호 검색): https://www.autofixkorea.com/hub/',
 ].join('\n');
}
