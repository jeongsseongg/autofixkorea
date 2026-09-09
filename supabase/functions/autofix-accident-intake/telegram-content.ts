import {questions,conditionFields,serviceTypes,accidentTypes} from './form-fields.js';

export function receiptMessages(row:any):string[]{
 const labels:Record<string,string>=Object.fromEntries(questions.map(q=>[q.id,q.label]));
 for(const [key,label] of conditionFields(row.values.service))labels[String(key)]=String(label);
 Object.assign(labels,{airbagDetail:'에어백 전개 상세',financeAmount:'할부·저당 금액',financeDetail:'할부·저당 상세'});
 const lines=['오토픽스코리아 · 상담 접수','접수번호: '+row.id,'접수일시: '+row.completed_at];
 for(const [key,value] of Object.entries(row.values)){
  if(value===''||value===null||value===undefined)continue;
  let answer=typeof value==='boolean'?(value?'예':'아니오'):String(value);
  if(key==='service')answer=serviceTypes.find(x=>x[0]===value)?.[1]||answer;
  if(key==='accidentType')answer=accidentTypes.find(x=>x[0]===value)?.[1]||answer;
  lines.push((labels[key]||key)+': '+answer);
 }
 lines.push('첨부 사진: '+row.photos.length+'장','상담 정보 수집·이용 동의: 완료');
 const chunks:string[]=[];let current='';
 for(const line of lines){
  if(current.length+line.length+1>3500){chunks.push(current);current='접수번호: '+row.id+' (계속)';}
  current+=(current?'\n':'')+line;
 }
 if(current)chunks.push(current);
 return chunks;
}
