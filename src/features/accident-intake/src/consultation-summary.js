import {serviceTypes,accidentTypes,hasAirbag,hasFinance} from './form-fields.js';
export const amount=v=>String(v??'').trim()?Number(v).toLocaleString('ko-KR')+'만 원':'미확인';
export function consultationText(v){
 const text=x=>String(x??'').trim()||'확인 필요';
 const sale=v.service!=='accidentRepair',accident=v.service!=='breakdownSale';
 const other=accident&&v.accidentType==='other';
 const vehicle=[v.manufacturer,v.group,v.model].filter(Boolean).join(' ');
 const lines=[
  ...(v.brand==='solution'?['**상담 브랜드 :** 사고차솔루션']:[]),
  '**상담 구분 :** '+(serviceTypes.find(t=>t[0]===v.service)?.[1]??'확인 필요'),
  '**차량명 :** '+vehicle+' ('+text(v.plate)+')',
  '**차량 년식 :** '+text(v.year)+'년식',
  '**주행 거리 :** '+(v.mileage?Number(v.mileage).toLocaleString('ko-KR')+' km':'확인 필요'),
  '**차고지 :** '+text(v.region),
  '**유류타입 :** '+text(v.fuel),
  (sale?'**희망가 :** '+amount(v.desired)+(v.otherQuote?' ('+text(v.quoteSource)+' 견적 '+amount(v.otherQuote)+')':''):'**수리 희망 예산 :** '+amount(v.budget)),
 ];
 if(accident)lines.push('**보험 이력 :** '+(accidentTypes.find(t=>t[0]===v.accidentType)?.[1]??'확인 필요')+' / 사고 전 이력: '+text(v.priorHistory));
 lines.push('**차량 내용 :**','- **명의 :** '+text(v.owner),'- **저당/압류·할부 여부 :** '+text(v.finance));
 if(hasFinance(v)){lines.push('- **남은 할부금 :** '+amount(v.balance));if(sale)lines.push('- **판매대금으로 할부 정리 :** '+(v.payoff?'요청':'요청하지 않음'));}
 lines.push('- **시동 및 주행 :** 시동 '+text(v.ignition)+' / 주행 '+text(v.driving));
 if(accident)lines.push('- **에어백 전개 :** '+text(v.airbag)+(hasAirbag(v)?' ('+text(v.airbagDetail)+')':''));
 lines.push('- **'+(accident?'사고 손상':'고장')+' 부위 :** '+text(v.damagePart),'- **증상·상태 :** '+text(v.symptoms));
 if(v.service==='breakdownSale')lines.push('- **발생 시점·상황 :** '+text(v.onset));
 else lines.push('- **수리 희망·점검 범위 :** '+text(v.repairScope));
 lines.push('- **정비소 진단·견적 설명 :** '+text(v.diagnosis));
 if(other)lines.push('- **상대방 과실 :** '+(v.fault?v.fault+'%':'확인 필요'),'- **보험사 수리 견적 :** '+amount(v.insuranceRepair),'- **미수선 예상금액 :** '+amount(v.settlement),'- **보험사 차량가액 :** '+amount(v.insuredValue));
 else lines.push('- **수리 견적 :** '+amount(v.repair));
 return lines.join('\n\n');
}
export function renderConsultation(target,text){
 target.replaceChildren(...text.split('\n\n').map(line=>{
  const p=document.createElement('p'),match=line.match(/^(?:- )?\*\*(.+?)\*\*(.*)$/);
  if(!match){p.textContent=line;return p;}
  const strong=document.createElement('strong');strong.textContent=match[1];p.append(strong,document.createTextNode(match[2]));return p;
 }));
}
