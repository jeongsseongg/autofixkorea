import {serviceTypes} from './form-fields.js';
import {acquisition,acquisitionLines} from './acquisition.js';
import {receiptText} from './telegram-content.ts';
import {receiptCheckpoint,receiptLayout,receiptIdentity,receiptShort} from './telegram-receipt-display.ts';
const short=(value:unknown,max=70)=>Array.from(String(value??'미입력').replace(/\s+/g,' ')).slice(0,max).join('');
export function receiptNotificationText(row:any){
 // A legacy checkpoint must reproduce its exact original operations and hash.
 const saved=receiptCheckpoint(row);
 return saved&&saved.summary_format!==true?receiptText(row):receiptLayout(row)===2?receiptSummary(row):compactReceiptSummary(row);
}
function compactReceiptSummary(row:any){
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
export function receiptSummary(row:any){
 const v=row.values,ctx=acquisition(row.acquisition),identity=receiptIdentity(row);
 const services:Record<string,string>={accidentSale:'사고차 매입',breakdownSale:'고장차 매입',accidentRepair:'사고차 수리'};
 const phone=String(v.contact||'').replace(/[^0-9]/g,'').replace(/^(0\d{2})(\d{3,4})(\d{4})$/,'$1-$2-$3');
 const condition=receiptShort([v.damagePart,v.symptoms].filter(Boolean).join(' · ')||v.condition||'전체 접수에서 확인',140);
 const source=acquisitionLines(row.acquisition).filter(line=>/^(유입 경로|접속 기기|광고 키워드):/.test(line)).join('\n');
 const details=[v.year?receiptShort(v.year,8)+'년식':'',/^\d+$/.test(v.mileage||'')?Number(v.mileage).toLocaleString('ko-KR')+' km':'',v.region?receiptShort(v.region,35):''].filter(Boolean).join(' · ');
 return [
  `오토픽스코리아 · ${services[v.service]||'차량 접수'}${ctx?.mode==='test'?' [TEST · 실제 고객 아님]':''}`,
  `접수 ${identity.label}`,identity.time,
  '', '차량', identity.vehicle, ...(details?[details]:[]),
  '', '연락처',phone||'확인 필요',
  '', '상태',condition,
  '', '유입',source,
  '',`사진 ${row.photos.length}장${v.vehiclePhotosLater?' · 추가 사진 추후 제출':''} · 전체 입력 내용과 원본은 아래 접수 보기에서 확인`,
  `원본번호: ${row.id}`,
 ].join('\n');
}
