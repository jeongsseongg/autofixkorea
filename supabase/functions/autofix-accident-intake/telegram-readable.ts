import {receiptGroups,receiptLabels,receiptAnswer} from './telegram-content.ts';
import {receiptIdentity,vehicleTitle} from './telegram-receipt-display.ts';
import {acquisition,acquisitionLines} from './acquisition.js';
const services:Record<string,string>={accidentSale:'사고차 매입',breakdownSale:'고장차 매입',accidentRepair:'사고차 수리'};
const hasValue=(value:unknown)=>value!==''&&value!==null&&value!==undefined;
export function readableReceipt(row:any){
 const values=row.values,labels:Record<string,string>={...receiptLabels(values),name:'고객명',memo:'고객 요청',message:'추가 내용'};
 const phone=String(values.contact||'').replace(/[^0-9]/g,'').replace(/^(0\d{2})(\d{3,4})(\d{4})$/,'$1-$2-$3');
 const lines=[`[오토픽스코리아 · ${services[values.service]||'차량 접수'}]`];
 if(acquisition(row.acquisition)?.mode==='test')lines.push('시험 접수 · 실제 고객 아님');
 lines.push('접수일시: '+receiptIdentity(row).time,...(values.name?['고객명: '+values.name]:[]),'연락처: '+(phone||'미입력'),'','차량: '+vehicleTitle(values,32000));
 const used=new Set(['service','name','contact','manufacturer','group','model','unknownQuestions','vehiclePhotosLater','interiorPhotosLater']);
 for(const [title,keys]of receiptGroups){
  const present=keys.filter(key=>!used.has(key)&&hasValue(values[key]));
  if(!present.length)continue;
  lines.push('',title==='매입·수리 접수'?'접수 구분':title);
  for(const key of present){used.add(key);lines.push((labels[key]||'추가 내용')+': '+receiptAnswer(key,values[key],labels));}
 }
 const remaining=Object.keys(values).filter(key=>!used.has(key)&&hasValue(values[key]));
 if(remaining.length)lines.push('','고객 요청 및 추가 내용');
 for(const key of remaining)lines.push((labels[key]||'추가 내용')+': '+receiptAnswer(key,values[key],labels));
 lines.push('',row.photos.length?'첨부 사진: '+row.photos.length+'장':'첨부 사진: 없음');
 if(values.vehiclePhotosLater||values.interiorPhotosLater)lines.push('사진 추후 제출 선택');
 const unknown=String(values.unknownQuestions||'').split(',').filter(Boolean).length;
 if(unknown)lines.push('미확인 항목: '+unknown+'개 · 전체 접수 보기에서 확인');
 if(acquisition(row.acquisition))lines.push('',...acquisitionLines(row.acquisition).filter(line=>/^(유입 경로|접속 기기|광고 키워드):/.test(line)).map(line=>line.replace('접속 기기: PC','접속 기기: 컴퓨터')));
 return lines.join('\n');
}
