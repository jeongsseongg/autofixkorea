import {node} from './api.js';
import {questions,conditionFields,accidentTypes} from '../../../consultation/src/form-fields.js';
const serviceNames={accidentSale:'사고차 매입',breakdownSale:'고장차 매입',accidentRepair:'사고차 수리'};
export const serviceName=value=>serviceNames[value]||'차량 접수';
export function vehicleName(v){
 const parts=[v.manufacturer||v.brand,v.group,v.model].filter(Boolean).map(String);
 return parts.filter((part,i)=>!parts.some((other,j)=>i!==j&&(other===part?j<i:other.includes(part)))).join(' ')||v.subject||'차량 정보 확인 필요';
}
export function receiptDate(date){return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(date));}
const groups=[['차량 정보','VEHICLE',['manufacturer','brand','group','model','plate','year','mileage','fuel','region','owner']],['손상 및 운행 상태','CONDITION',['accidentType','damagePart','symptoms','ignition','driving','airbag','airbagDetail','priorHistory','condition','diagnosis','onset','repairScope']],['견적·권리 정보','ESTIMATE',['repair','insuranceRepair','fault','settlement','insuredValue','otherQuote','desired','budget','finance','financeAmount','financeDetail','price']]];
const extraNames={name:'고객명',contact:'연락처',phone:'연락처',brand:'제조사',model:'세부 모델·등급',region:'차량 위치',memo:'고객 메모',message:'문의 내용',subject:'제목',sender:'발신자',unknownQuestions:'확인이 필요한 항목',vehiclePhotosLater:'차량 사진 추후 제출',interiorPhotosLater:'실내 사진 추후 제출',airbagDetail:'에어백 상세',financeAmount:'할부·저당 금액',financeDetail:'할부·저당 상세',price:'희망금액'};
function answer(key,value,names){
 if(key==='service')return serviceName(value);
 if(key==='accidentType')return accidentTypes.find(row=>row[0]===value)?.[1]||String(value);
 if(key==='unknownQuestions')return String(value).split(',').map(id=>names[id]||id).join(' · ');
 if(key==='mileage'&&/^\d+$/.test(value))return Number(value).toLocaleString('ko-KR')+' km';
 if(typeof value==='boolean')return value?'예':'아니오';
 return typeof value==='object'?JSON.stringify(value,null,2):String(value);
}
function fieldSection(title,kicker,keys,values,names){
 const section=node('section','','receipt-section'),heading=node('div','','receipt-section-heading');heading.append(node('h3',title),node('span',kicker));section.append(heading);
 const dl=node('dl','','receipt-fields');for(const key of keys){const pair=node('div','','receipt-field');pair.append(node('dt',names[key]||key),node('dd',answer(key,values[key],names)));dl.append(pair);}section.append(dl);return section;
}
export function renderFields(values){
 const names={...Object.fromEntries(questions.map(q=>[q.id,q.label])),...extraNames,...Object.fromEntries(conditionFields(values.service).map(([id,label])=>[id,label]))};
 const content=node('div','','receipt-information'),used=new Set(['service','unknownQuestions']);
 for(const [title,kicker,keys] of groups){const present=keys.filter(key=>Object.hasOwn(values,key)&&values[key]!==''&&values[key]!=null);present.forEach(k=>used.add(k));if(present.length)content.append(fieldSection(title,kicker,present,values,names));}
 const remaining=Object.keys(values).filter(key=>!used.has(key));if(remaining.length)content.append(fieldSection('연락처 및 추가 내용','DETAILS',remaining,values,names));
 if(values.unknownQuestions){const details=node('details','','receipt-missing');details.append(node('summary','확인이 필요한 항목 '+String(values.unknownQuestions).split(',').filter(Boolean).length+'개'),node('p',answer('unknownQuestions',values.unknownQuestions,names)));content.append(details);}
 return content;
}
