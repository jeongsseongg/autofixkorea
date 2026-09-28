import '../assets/vehicle-data.js';
import {mountReasonDialog} from './reason-dialog.js';
import {mountDraftStorage} from './draft-storage.js';
import {serviceTypes,accidentTypes,activeQuestions,hasAirbag,hasFinance,photoMarkup,conditionFields} from './form-fields.js';
import {answerInput,detailInputs} from './question-controls.js';
import {consultationText,renderConsultation} from './consultation-summary.js';
import {mountPhotos} from './photo-attachments.js';
import {mountSubmission} from './submission.js';
const form=document.querySelector('#purchase-form'),field=document.querySelector('[data-question-field]');
const error=document.querySelector('[data-form-error]'),next=document.querySelector('[data-next]'),prev=document.querySelector('[data-prev]');
const values={},pool=[];let position=0,controls=[],draft;
const photoArea=document.querySelector('[data-photo-area]');photoArea.innerHTML=photoMarkup();
const attachments=mountPhotos(photoArea,{pool,category:'vehicle'});
const airbagArea=document.querySelector('[data-airbag-area]');
airbagArea.innerHTML='<label class="airbag-label" for="airbag-detail">어떤 부위의 에어백이 전개됐나요? *</label><textarea id="airbag-detail" class="airbag-description" maxlength="500" placeholder="예: 운전석 핸들과 조수석 대시보드 에어백이 전개됐어요."></textarea><p class="airbag-example">전개 부위가 보이는 실내 사진도 함께 올려주세요.</p>'+photoMarkup(true);
const interior=mountPhotos(airbagArea,{pool,category:'interior'});
airbagArea.querySelector('textarea').addEventListener('input',e=>{values.airbagDetail=e.target.value;});
const financeArea=document.querySelector('[data-finance-area]');
const list=()=>activeQuestions(values),question=()=>list()[position];
const selectedPhotos=()=>pool.filter(p=>p.category!=='interior'||hasAirbag(values));
const submission=mountSubmission(()=>({values:{...values},text:consultationText(values),photos:selectedPhotos()}));
function showConditionals(){
 airbagArea.hidden=question().id!=='airbag'||!hasAirbag(values);
 financeArea.hidden=question().id!=='finance'||!hasFinance(values);
}
function saveValue(q,value){
 if(q.id==='manufacturer'&&values[q.id]!==value){delete values.group;delete values.model;}
 if(q.id==='group'&&values[q.id]!==value)delete values.model;
 values[q.id]=value;showConditionals();draft?.save();
}
function cards(q){
 const box=document.createElement('div');box.className='accident-choices';
 for(const [id,title,hint] of q.id==='service'?serviceTypes:accidentTypes){
  const b=document.createElement('button');b.type='button';b.className='accident-option';b.setAttribute('aria-pressed',String(values[q.id]===id));
  const strong=document.createElement('strong');strong.textContent=title;const small=document.createElement('small');small.textContent=hint;b.append(strong,small);
  b.addEventListener('click',()=>{if(q.id==='service'&&values.service!==id){for(const key of ['damagePart','symptoms','diagnosis','onset','repairScope'])delete values[key];}values[q.id]=id;show(position+1);});box.append(b);
 }field.append(box);
}
function financeDetails(){
 financeArea.replaceChildren();
 const label=document.createElement('label');label.className='airbag-label';label.htmlFor='answer-balance';label.textContent='남은 할부금 (알고 계신 경우)';
 const control=answerInput({id:'balance',label:'남은 할부금',kind:'money',optional:true},values,v=>{values.balance=v;});
 const check=document.createElement('label');check.className='payoff-check';
 const input=document.createElement('input');input.type='checkbox';input.checked=Boolean(values.payoff);input.addEventListener('change',()=>{values.payoff=input.checked;});
 const copy=document.createElement('span');copy.textContent='판매대금으로 남은 할부금 정리를 원해요';check.append(input,copy);
 const hint=document.createElement('p');hint.className='airbag-example';hint.textContent='잔액과 매입금액을 확인한 뒤 정리 방법을 안내해드려요.';
 financeArea.append(label,control.element);if(values.service!=='accidentRepair')financeArea.append(check,hint);
}
function show(index){
 position=index;controls.forEach(c=>c.close?.());controls=[];field.replaceChildren();error.textContent='';
 const q=question();document.querySelector('[data-question-title]').textContent=q.id==='condition'?(values.service==='breakdownSale'?'어디가 고장났고, 어떤 증상이 있나요?':'어느 부위가 손상됐나요?'):q.title;
 document.querySelector('[data-question-help]').textContent=q.help?.replaceAll('오토픽스코리아',document.body.dataset.brandName||'오토픽스코리아')??(q.optional?'아직 모르신다면 건너뛰어도 괜찮아요.':q.kind==='combo'?'목록에서 고르거나 편하게 직접 적어주세요.':'');
 form.querySelector('.purchase-actions').hidden=q.id==='service';photoArea.hidden=q.kind!=='photos';prev.hidden=!position;next.hidden=q.kind==='cards';
 next.textContent=position===list().length-1?'상담 내용 확인 →':'다음 →';document.querySelector('[data-skip]').hidden=!q.optional;
 if(q.kind==='cards')cards(q);
 else if(q.kind==='details')field.append(detailInputs(values));
 else if(q.kind!=='photos'){const c=answerInput(q,values,v=>saveValue(q,v));controls.push(c);field.append(c.element);}
 if(q.id==='otherQuote'){
  const label=document.createElement('label');label.className='airbag-label';label.htmlFor='answer-quoteSource';label.textContent='견적받은 곳 (선택)';
  const c=answerInput({id:'quoteSource',label:'견적받은 곳',optional:true,placeholder:'예: 폐차장 / 매입업체'},values,v=>{values.quoteSource=v;});field.append(label,c.element);
 }
 if(q.id==='finance')financeDetails();
 showConditionals();attachments.render();interior.render();updateStages();draft?.save();document.querySelector('[data-question-title]').focus({preventScroll:true});
}
function valid(){
 const q=question();let message='';
 if(q.kind==='details'){
  const missing=conditionFields(values.service).find(([id,,,required])=>required&&!values[id]?.trim());
  if(missing)message='부위와 상태를 적어주세요. 진단 전이라면 확인 필요로 적으셔도 돼요.';
 }else if(q.kind!=='photos'&&q.kind!=='cards'){
  const input=field.querySelector('input'),v=values[q.id]?.trim();
  if(!v&&!q.optional)message='답변을 입력하거나 목록에서 선택해주세요.';
  if(input&&!input.checkValidity())message='숫자와 입력 범위를 확인해주세요.';
  if(v&&(q.numeric||['number','money'].includes(q.kind))&&(!/^\d+$/.test(v)||Number(v)<(q.min??0)||Number(v)>(q.max??Number.MAX_SAFE_INTEGER)))message='숫자와 입력 범위를 확인해주세요.';
 }
 if(q.id==='airbag'&&hasAirbag(values)&&(!values.airbagDetail?.trim()||!interior.photos.length))message='전개된 부위 설명과 실내 사진을 1장 이상 첨부해주세요.';
 if(q.id==='finance'&&hasFinance(values)&&values.balance&&!/^\d+$/.test(values.balance))message='남은 할부금은 숫자로 입력해주세요.';
 if(message){error.textContent=message;return false;}return true;
}
function review(){
 renderConsultation(document.querySelector('[data-review-details]'),consultationText(values));
 document.querySelector('[data-review-photos]').replaceChildren(...selectedPhotos().map((p,i)=>{const img=document.createElement('img');img.src=p.url;img.alt='첨부 사진 '+(i+1);return img;}));
 form.hidden=true;document.querySelector('[data-review]').hidden=false;submission.reset();updateStages(true);draft?.save();document.querySelector('#review-title').focus({preventScroll:true});
}
async function advance(){
 next.disabled=true;await Promise.all([attachments.ready(),interior.ready()]);next.disabled=false;
 if(!valid())return;
 if(question().kind==='photos'&&!attachments.photos.length){error.textContent='차량 사진을 1장 이상 첨부해주세요.';return;}
 if(position<list().length-1)show(position+1);else review();
}
next.addEventListener('click',advance);prev.addEventListener('click',()=>show(Math.max(0,position-1)));
document.querySelector('[data-skip]').addEventListener('click',()=>{values[question().id]='';if(position<list().length-1)show(position+1);else review();});
form.addEventListener('submit',e=>{e.preventDefault();advance();});
document.querySelector('[data-edit]').addEventListener('click',()=>{form.hidden=false;document.querySelector('[data-review]').hidden=true;show(0);});
document.addEventListener('click',e=>{if(!e.target.closest('.answer-control'))controls.forEach(c=>c.close?.());});
function updateStages(isReview=false){
 const id=question().id,index=isReview?3:['service','accidentType'].includes(id)?0:position>=list().findIndex(q=>q.id==='photos')?2:1;
 document.querySelectorAll('[data-stage]').forEach((item,i)=>{item.classList.toggle('is-complete',i<index);if(i===index)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
 document.querySelector('.purchase-layout').classList.toggle('is-answering',position>1||isReview);
}
async function restoreDraft(){
 form.inert=true;
 draft=mountDraftStorage(()=>({values,questionId:question()?.id,review:form.hidden,photos:pool}),document.querySelector('[data-draft-status]'));
 const saved=await draft.load();
 if(saved.meta?.values)Object.assign(values,saved.meta.values);
 try{const seed=JSON.parse(sessionStorage.getItem('autofix-consultation-prefill')||'null');if(seed){Object.assign(values,seed);sessionStorage.removeItem('autofix-consultation-prefill');}}catch{}
 if(document.body.dataset.brand==='solution')values.brand='solution';
 for(const p of saved.photos)pool.push({...p,url:URL.createObjectURL(p.file)});
 airbagArea.querySelector('textarea').value=values.airbagDetail||'';
 show(Math.max(0,list().findIndex(q=>q.id===saved.meta?.questionId)));
 if(saved.meta?.review)review();
 form.inert=false;
}
for(const event of ['input','change','attachments-changed'])form.addEventListener(event,()=>draft?.save());
mountReasonDialog();
restoreDraft();
