import {arrows,conditionFields} from './form-fields.js';
import {mountCombo,suggestions} from './vehicle-selection.js';
export function answerInput(q,values,onSave){
 const wrap=document.createElement('div');wrap.className='answer-control';
 const input=document.createElement('input');input.id='answer-'+q.id;input.name=q.id;input.setAttribute('aria-label',q.label);
 input.value=values[q.id]??'';input.required=!q.optional;input.autocomplete='off';input.maxLength=100;
 input.type=['money','number'].includes(q.kind)?'number':'text';input.step='1';
 if(q.kind==='tel'){input.type='tel';input.inputMode='tel';input.pattern='0[0-9() -]{8,15}';input.maxLength=16;}
 if(q.kind==='number'||q.kind==='money'||q.numeric){input.inputMode='numeric';input.min=q.min??0;if(q.max)input.max=q.max;}
 input.placeholder=q.placeholder??(q.kind==='combo'?'목록에서 선택하거나 직접 입력':q.kind==='money'?'예: 600':q.id==='mileage'?'예: 50000':'직접 입력해주세요');
 input.addEventListener('input',()=>onSave(input.value));wrap.append(input);
 if(q.unit||q.kind==='money'){const unit=document.createElement('span');unit.className='input-unit';unit.textContent=q.kind==='money'?'만원':q.unit;wrap.append(unit);}
 if(q.kind==='combo')return comboControl(wrap,input,q,values);
 if(['money','number'].includes(q.kind))numberButtons(wrap,input,q,onSave);
 return {element:wrap};
}
function comboControl(wrap,input,q,values){
 input.role='combobox';input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls','options-'+q.id);
 const toggle=document.createElement('button');toggle.type='button';toggle.className='arrow-button';toggle.dataset.toggle='';
 toggle.setAttribute('aria-label',q.label+' 목록 열기');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','options-'+q.id);toggle.innerHTML=arrows('down');
 const menu=document.createElement('div');menu.className='combo-menu';menu.dataset.menu='';menu.hidden=true;
 menu.innerHTML='<button class="list-scroll" type="button" data-scroll="-1" aria-label="목록 위로 스크롤">'+arrows('up')+'</button><div role="listbox" id="options-'+q.id+'" aria-label="'+q.label+' 선택"></div><p data-empty hidden>목록에 없어도 입력한 내용으로 계속할 수 있어요.</p><button class="list-scroll" type="button" data-scroll="1" aria-label="목록 아래로 스크롤">'+arrows('down')+'</button>';
 wrap.append(toggle,menu);const combo=mountCombo(wrap,suggestions(q.id,values,window.__FIRST_CAR_TAXONOMY__));return {element:wrap,close:combo.close};
}
function numberButtons(wrap,input,q,onSave){
 const group=document.createElement('div');group.className='number-arrows';
 for(const d of [1,-1]){
  const b=document.createElement('button');b.type='button';b.className='arrow-button';b.setAttribute('aria-label',q.label+(d===1?' 증가':' 감소'));b.innerHTML=arrows(d===1?'up':'down');
  b.addEventListener('click',()=>{input.value=String(Math.max(q.min??0,Math.min(q.max??Number.MAX_SAFE_INTEGER,(Number(input.value)||0)+d*(q.step??1))));onSave(input.value);});group.append(b);
 }wrap.append(group);
}
export function detailInputs(values){
 const block=document.createElement('div');block.className='condition-details';
 for(const [id,label,placeholder,required] of conditionFields(values.service)){
  const title=document.createElement('label');title.htmlFor='detail-'+id;title.textContent=label+(required?' *':'');title.className='airbag-label';
  const area=document.createElement('textarea');area.id='detail-'+id;area.name=id;area.className='airbag-description';area.placeholder=placeholder;area.required=required;area.maxLength=500;area.value=values[id]??'';
  area.addEventListener('input',()=>{values[id]=area.value;});block.append(title,area);
 }return block;
}
