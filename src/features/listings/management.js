import {request} from '../../services/listings/index.js';
function el(tag,text){const n=document.createElement(tag);n.textContent=text;return n;}
async function members(message){
 const container=document.getElementById('lot-members');container.replaceChildren(el('h3','업체 계정'));
 const rows=await request('members');
 for(const row of rows){
  const item=el('div',row.name+' · '+row.login_id+' · '+row.status);
  if(row.role!=='admin')for(const [label,status] of [['승인','approved'],['이용 중지','suspended']]){
   const button=el('button',label);button.addEventListener('click',async()=>{
    try{await request('approve',{id:row.id,status});await members(message);message('업체 상태를 변경했습니다.');}catch(error){message(error.message);}
   });item.append(button);
  }container.append(item);
 }
}
async function sources(){
 const container=document.getElementById('lot-sources'),rows=await request('sources');
 container.replaceChildren(...rows.map(row=>el('div',row.label+' · '+row.channel+' · '+row.sender+' · '+(row.auto_publish?'자동 공유':'검토 후 공유'))));
}
export async function mountAdmin(message){
 await members(message);await sources();
 const dealerForm=document.getElementById('lot-dealer-form');
 dealerForm.onsubmit=async event=>{
  event.preventDefault();try{await request('dealer-save',Object.fromEntries(new FormData(dealerForm)));dealerForm.reset();await members(message);message('업체 계정을 저장했습니다.');}catch(error){message(error.message);}
 };
 const form=document.getElementById('lot-source-form');
 form.onsubmit=async event=>{
  event.preventDefault();const values=Object.fromEntries(new FormData(form));
  try{await request('source-add',{...values,auto_publish:values.auto_publish==='on'});form.reset();await sources();message('접수 허용 발신자를 등록했습니다.');}catch(error){message(error.message);}
 };
}
export async function editListing(container,lot,refresh,message){
 const original=el('button','접수 원본 확인');original.addEventListener('click',async()=>{
  try{const rows=await request('inbox',{id:lot.id});container.append(el('pre',rows.map(row=>row.raw_text).join('\n\n')));original.disabled=true;}catch(error){message(error.message);}
 });container.append(original,el('p',lot.review_reasons.join(' / ')));
 const form=document.createElement('form');
 const fields={title:'차량명',year:'연식',mileage_km:'주행거리(km)',price_krw:'가격(원)',fuel:'연료',accident_type:'사고유형',region:'지역',description:'설명'};
 for(const [key,label] of Object.entries(fields)){
  const wrapper=el('label',label),input=document.createElement(key==='description'?'textarea':'input');
  input.name=key;input.value=lot[key]??'';input.required=key!=='description';
  if(['year','mileage_km','price_krw'].includes(key)){input.type='number';input.min='0';input.step='1';}
  wrapper.append(input);form.append(wrapper);
 }
 const label=el('label','공유 상태'),select=document.createElement('select');select.name='status';
 for(const [value,title] of [['review','검토 대기'],['published','업체 공유'],['sold','판매 완료'],['archived','보관']]){const option=el('option',title);option.value=value;select.append(option);}
 select.value=lot.status;label.append(select);form.append(label,el('button','정보 저장'));
 form.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('button');button.disabled=true;
  try{await request('update',{id:lot.id,...Object.fromEntries(new FormData(form))});await refresh();message('매물 정보를 저장했습니다.');document.getElementById('lot-detail').close();}catch(error){message(error.message);}finally{button.disabled=false;}
 });container.append(form);
}
