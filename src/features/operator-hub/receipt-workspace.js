import {authenticate,hasSession,logout,request} from '../../services/listings/index.js';
import {$,api,node,labels,statuses,download} from './api.js';
import {openDetail,mountDetail,clearDetail} from './receipt-detail.js';
import {receiptTarget,enterReceiptWorkspace,watchReceiptNavigation} from './receipt-route.js';
import {vehicleName,receiptDate,serviceName} from './receipt-fields.js';
let items=[],offset=0,hasMore=false,gateway,target=null;
function render(){
 const search=$('search').value.trim().toLowerCase(),visible=items.filter(row=>JSON.stringify([row.id,row.fields]).toLowerCase().includes(search));
 $('rows').replaceChildren(...visible.map(row=>{
  const card=node('article','','hub-card'),identity=node('div','','hub-card-identity');
  identity.append(node('span',serviceName(row.fields.service),'hub-chip'),node('h3',vehicleName(row.fields)),node('p',labels[row.source]+' · '+row.id.replaceAll('-','').slice(-8).toUpperCase()));
  const contact=node('div','','hub-card-contact');contact.append(node('strong',row.fields.name||row.fields.contact||row.fields.phone||'연락처 확인 필요'),node('span',receiptDate(row.created_at)));
  const state=node('div','','hub-card-state');state.append(node('span',statuses[row.progress]||'확인 필요','receipt-status'),node('small',row.submission_status==='complete'?'접수 완료':'사진 업로드 대기'));
  if(row.telegram_status==='failed')state.append(node('small','알림 전송 확인 필요'));
  state.querySelector('.receipt-status').dataset.progress=row.progress;
  const button=node('button','접수 보기 →','hub-button-secondary');button.addEventListener('click',()=>run(()=>openDetail({source:row.source,id:row.id})));
  card.append(identity,contact,state,button);return card;
 }));
 $('status').textContent=items.length?'이 페이지 '+items.length+'건 · 검색 결과 '+visible.length+'건':'접수 내역이 없습니다.';
 $('previous').disabled=offset===0;$('next').disabled=!hasMore;$('page').textContent=offset/50+1+' 페이지';
}
async function refresh(){
 $('refresh').disabled=true;
 try{const result=await gateway.api('list',{source:$('source').value,offset});items=result.items;hasMore=result.hasMore;render();}
 finally{$('refresh').disabled=false;}
}
function showLogin(){
 items=[];$('rows').replaceChildren();clearDetail();$('detail').close();$('workspace').hidden=true;$('login').hidden=false;$('logout').hidden=true;
}
function authorized(key){
 target=key;$('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;
 $('workspace').classList.toggle('hub-direct-mode',Boolean(key));$('all-receipts').hidden=!key;
 if(key)$('status').textContent='선택한 접수의 입력 내용과 원본 사진을 확인합니다.';
}
const state=()=>enterReceiptWorkspace({location:window.location.href,gateway,login:showLogin,authorized,openDetail,refresh});
async function run(task){try{$('error').textContent='';await task();}catch(error){$('error').textContent=error.message;}}
export async function mount(dependencies={}){
 gateway={api,authenticate,hasSession,logout,request,...dependencies};
 let initial=null;try{initial=receiptTarget(window.location.href);}catch{$('all-receipts').hidden=false;}
 $('direct-hint').hidden=!initial; // run(state) renders invalid-link errors after handlers are bound.
 mountDetail(async()=>{if(!target)await refresh();},gateway.api);
 watchReceiptNavigation(window,()=>run(state));
 $('login-form').addEventListener('submit',event=>{event.preventDefault();run(async()=>{const button=event.submitter;button.disabled=true;try{await gateway.authenticate('admin',event.target.elements.password.value);event.target.reset();await state();}finally{button.disabled=false;}});});
 $('logout').addEventListener('click',()=>run(async()=>{try{await gateway.logout();}finally{showLogin();}}));
 $('refresh').addEventListener('click',()=>run(()=>target?openDetail(target):refresh()));$('search').addEventListener('input',render);
 $('source').addEventListener('change',()=>run(async()=>{offset=0;await refresh();}));
 $('previous').addEventListener('click',()=>run(async()=>{offset=Math.max(0,offset-50);await refresh();}));$('next').addEventListener('click',()=>run(async()=>{offset+=50;await refresh();}));
 $('export').addEventListener('click',()=>download('autofix-receipts.json',items));await run(state);
}
