export const serviceTypes=[
 ['accidentSale','사고차 판매','수리 전, 현재 상태의 매입 조건을 비교해요'],
 ['breakdownSale','고장차 판매','고장 부위와 증상에 맞는 매입 조건을 확인해요'],
 ['accidentRepair','사고차 수리','손상 부위와 필요한 수리 범위를 상담해요'],
];
export const accidentTypes=[
 ['uninsured','보험처리 불가 사고','음주사고 · 무보험 사고'],
 ['single','자차보험 미가입 단독사고','내 차량 수리비를 직접 부담하는 사고'],
 ['other','상대방 과실 사고','미수선 · 분손 · 전손 비교가 필요한 사고'],
];
export const hasAirbag=v=>v.service!=='breakdownSale'&&Boolean(v.airbag?.trim()&&!['미전개','확인 필요'].includes(v.airbag.trim()));
export const hasFinance=v=>Boolean(v.finance?.trim()&&v.finance.trim()!=='없음');
export const questions=[
 {id:'service',title:'어떤 상담이 필요하신가요?',label:'상담 구분',kind:'cards',help:'차량 상태를 편하게 알려주세요. 내 차에 맞는 판매·수리 방법을 함께 찾아볼게요.'},
 {id:'accidentType',title:'어떤 사고인가요?',label:'사고 유형',kind:'cards',when:'accident'},
 {id:'manufacturer',title:'차량 제조사가 어디인가요?',label:'제조사',kind:'combo'},
 {id:'group',title:'차종을 알려주세요.',label:'차종',kind:'combo'},
 {id:'model',title:'세부 모델이나 등급을 알려주세요.',label:'세부 모델·등급',kind:'combo',optional:true,help:'예: QM6 LPe RE 시그니처. 알고 계신 모델명이나 등급을 적어주셔도 좋아요.'},
 {id:'plate',title:'차량번호가 어떻게 되나요?',label:'차량번호',placeholder:'예: 123가4567'},
 {id:'year',title:'몇 년식 차량인가요?',label:'연식',kind:'combo',numeric:true,min:1900,max:new Date().getFullYear()+1},
 {id:'mileage',title:'얼마나 주행했나요?',label:'주행거리',kind:'number',unit:'km',step:1000},
 {id:'region',title:'차량이 어디에 있나요?',label:'차고지',kind:'combo',help:'시·도와 시·군·구를 알려주세요. 예: 전북 전주'},
 {id:'fuel',title:'어떤 연료를 사용하나요?',label:'유류타입',kind:'combo'},
 {id:'owner',title:'차량 명의는 어떻게 되어 있나요?',label:'차량 명의',kind:'combo'},
 {id:'finance',title:'할부·저당·압류가 있나요?',label:'할부·저당·압류 여부',kind:'combo'},
 {id:'ignition',title:'시동을 걸 수 있나요?',label:'시동 가능 여부',kind:'combo'},
 {id:'driving',title:'차량이 주행 가능한가요?',label:'주행 가능 여부',kind:'combo'},
 {id:'airbag',title:'에어백이 전개됐나요?',label:'에어백 전개 여부',kind:'combo',when:'accident'},
 {id:'priorHistory',title:'사고 전 차량 이력을 알려주세요.',label:'사고 전 보험·사고 이력',kind:'combo',optional:true,when:'accident'},
 {id:'condition',title:'차량 상태를 조금 더 알려주세요.',label:'차량 상세 상태',kind:'details',help:'확인된 내용을 적어주세요. 아직 진단 전인 부분은 “확인 필요”로 적으셔도 괜찮아요.'},
 {id:'photos',title:'차량 사진을 보여주세요.',label:'차량 사진',kind:'photos',help:'사진에 상태가 잘 보일수록 내 차의 가치를 더 정확히 전달할 수 있어요. 차량 전체와 손상·고장 부위를 함께 올려주세요. 실내 사진을 포함해 총 30장까지 가능해요.'},
 {id:'repair',title:'받아보신 수리 견적이 있나요?',label:'공업사 수리 견적',kind:'money',optional:true,when:'self'},
 {id:'fault',title:'상대방 과실은 몇 %인가요?',label:'상대방 과실비율',kind:'number',unit:'%',max:100,optional:true,when:'other'},
 {id:'insuranceRepair',title:'보험사 수리 견적은 얼마인가요?',label:'보험사 수리 견적',kind:'money',optional:true,when:'other'},
 {id:'settlement',title:'미수선 예상금액을 알고 계신가요?',label:'미수선 예상금액',kind:'money',optional:true,when:'other'},
 {id:'insuredValue',title:'보험사 차량가액은 얼마인가요?',label:'보험사 차량가액',kind:'money',optional:true,when:'other'},
 {id:'otherQuote',title:'다른 곳에서 받은 견적이 있나요?',label:'다른 업체 견적',kind:'money',optional:true,when:'sale',help:'폐차장이나 다른 매입업체에서 받은 금액이 있다면 알려주세요.'},
 {id:'desired',title:'마지막으로, 판매 희망금액을 알려주세요.',label:'희망가',kind:'money',when:'sale',min:1,help:'희망금액을 기준으로 비교견적을 시작해요. 확정 가격은 아니니, 원하시는 금액을 편하게 적어주세요.'},
 {id:'budget',title:'마지막으로, 생각하신 수리 예산이 있나요?',label:'수리 희망 예산',kind:'money',optional:true,when:'repairService',help:'예산이 정해져 있다면 알려주세요. 아직 정하지 않으셨다면 건너뛰셔도 괜찮아요.'},
 {id:'contact',title:'상담 결과를 안내받을 연락처를 알려주세요.',label:'연락처',kind:'tel',placeholder:'연락받으실 번호'},
];
export function activeQuestions(v){
 const accident=v.service!=='breakdownSale', other=accident&&v.accidentType==='other';
 const flags={accident,other,self:!other,sale:v.service!=='accidentRepair',repairService:v.service==='accidentRepair'};
 return questions.filter(q=>!q.when||flags[q.when]);
}
export function conditionFields(service){
 if(service==='breakdownSale')return [
  ['damagePart','고장 부위','예: 엔진 / 변속기 / 전기계통 / 하체. 모르면 확인 필요',true],
  ['symptoms','구체적인 증상','예: 시동은 걸리지만 가속이 안 되고 엔진 경고등이 켜져요.',true],
  ['diagnosis','정비소 진단 내용','예: 변속기 교환 필요 진단 / 아직 진단받지 못했어요',true],
  ['onset','증상이 시작된 시점·상황','예: 지난주부터 냉간 시동 때 소음이 발생해요.',false],
 ];
 return [
  ['damagePart','사고로 손상된 부위','예: 앞범퍼 / 라디에이터 / 조수석 도어 / 하체',true],
  ['symptoms','현재 손상 상태','예: 냉각수 누수와 전면 프레임 변형이 있어요.',true],
  ['repairScope',service==='accidentRepair'?'수리를 원하시는 범위':'수리·점검 내용','예: 전면 외판과 냉각계통 수리 / 전체 안전 점검',service==='accidentRepair'],
  ['diagnosis','정비소 진단·견적 설명','예: 정비사업소 가견적 800~900만원. 구조물 추가 점검 필요',false],
 ];
}
export function arrows(direction){return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="'+(direction==='up'?'m6 15 6-6 6 6':'m6 9 6 6 6-6')+'"/></svg>';}
export function photoMarkup(interior=false){return '<div class="photo-guide">'+(interior?'전개 부위가 보이는 실내 전체 · 운전석 · 조수석 · 커튼 에어백':'차량 전체 · 손상·고장 부위 · 계기판 · 견적서')+'</div><label class="photo-drop" data-drop><input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple data-photo-input><span class="upload-plus">＋</span><strong>사진 추가하기</strong><span>눌러서 선택하거나 여기에 끌어오세요</span><small>실내·차량 사진 합계 최대 30장 · 장당 20MB</small></label><div class="photo-heading">첨부 사진 <strong data-photo-count>0 / 30</strong></div><p class="form-error" data-photo-error role="alert"></p><div class="photo-grid" data-photo-grid></div>';}
