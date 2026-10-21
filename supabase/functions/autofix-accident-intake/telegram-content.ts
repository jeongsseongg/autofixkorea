import {questions,conditionFields,serviceTypes,accidentTypes} from './form-fields.js';
import {acquisitionLines} from './acquisition.js';
import {receiptIdentity,receiptLayout} from './telegram-receipt-display.ts';
export const receiptGroups=[
 ['매입·수리 접수',['service','accidentType','contact']],
 ['차량 정보',['manufacturer','group','model','plate','year','mileage','region','fuel','owner']],
 ['차량 상태',['ignition','driving','damagePart','symptoms','repairScope','diagnosis','onset','airbag','airbagDetail','priorHistory']],
 ['금융·견적 정보',['finance','financeAmount','financeDetail','repair','fault','insuranceRepair','settlement','insuredValue','otherQuote','desired','budget']],
 ['추가 확인',['unknownQuestions','vehiclePhotosLater','interiorPhotosLater']],
] as const;
const money=new Set(questions.filter(q=>q.kind==='money').map(q=>q.id));
export function receiptLabels(values:any){
 const labels:Record<string,string>=Object.fromEntries(questions.map(q=>[q.id,q.label]));
 for(const [key,label] of conditionFields(values.service))labels[String(key)]=String(label);
 Object.assign(labels,{airbagDetail:'에어백 전개 상세',financeAmount:'할부·저당 금액',financeDetail:'할부·저당 상세',unknownQuestions:'확인이 필요한 항목',vehiclePhotosLater:'차량 사진 추후 제출',interiorPhotosLater:'에어백·실내 사진 추후 제출'});
 return labels;
}
export function receiptText(row:any):string{
 const labels=receiptLabels(row.values);
 const date=new Date(row.completed_at||row.created_at);
 const time=Number.isNaN(date.getTime())?'확인 필요':new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date)+' (한국 시간)';
 const clean=receiptLayout(row)>=3;
 const lines=['🚘 오토픽스코리아 | 새로운 차량 매입·수리 접수','접수번호: '+(clean?receiptIdentity(row).label:row.id),'접수일시: '+time];
 if(row.acquisition!==undefined)lines.push('', '[방문·유입 정보]', ...acquisitionLines(row.acquisition).filter(line=>!clean||!line.startsWith('익명 방문번호:')).map(line=>clean?line.replace('접속 기기: PC','접속 기기: 컴퓨터'):line));
 const used=new Set<string>();
 for(const [title,keys] of receiptGroups){
  const fields=keys.filter(key=>row.values[key]!==undefined&&row.values[key]!==null&&row.values[key]!=='');
  if(fields.length)lines.push('','['+title+']');
  for(const key of fields){used.add(key);lines.push((labels[key]||key)+': '+receiptAnswer(key,row.values[key],labels));}
 }
 const remaining=Object.entries(row.values).filter(([key,value])=>!used.has(key)&&value!==''&&value!==null&&value!==undefined);
 if(remaining.length)lines.push('','[기타 입력 내용]');
 for(const [key,value] of remaining)lines.push((labels[key]||key)+': '+receiptAnswer(key,value,labels));
 lines.push('','첨부 사진: '+row.photos.length+'장 (차량 '+row.photos.filter((p:any)=>p.category==='vehicle').length+' · 실내 '+row.photos.filter((p:any)=>p.category==='interior').length+')','상담 정보 수집·이용 동의: 완료');
 return lines.join('\n');
}
export function receiptAnswer(key:string,value:any,labels:Record<string,string>){
 let text=typeof value==='boolean'?(value?'예':'아니오'):String(value);
 if(key==='unknownQuestions')return text.split(',').map(id=>labels[id]||id).join(', ');
 if(key==='service')return serviceTypes.find(x=>x[0]===value)?.[1]||text;
 if(key==='accidentType')return accidentTypes.find(x=>x[0]===value)?.[1]||text;
 if(key==='contact')return text.replace(/[^0-9]/g,'').replace(/^(0\d{2})(\d{3,4})(\d{4})$/,'$1-$2-$3');
 if(/^\d+$/.test(text)){
  if(money.has(key))text=Number(text).toLocaleString('ko-KR')+' 만원';
  if(key==='mileage')text=Number(text).toLocaleString('ko-KR')+' km';
  if(key==='fault')text+=' %';
 }
 return text;
}
export function receiptParts(text:string,limit=3500):string[]{
 const parts:string[]=[];
 while(text.length>limit){
  let end=text.lastIndexOf('\n',limit);
  end=end<limit/2?limit:Math.min(end+1,limit);
  if(/[\uD800-\uDBFF]/.test(text[end-1]))end--;
  parts.push(text.slice(0,end));text=text.slice(end);
 }
 if(text)parts.push(text);return parts;
}
export function receiptMessages(row:any):string[]{return receiptParts(receiptText(row));}
