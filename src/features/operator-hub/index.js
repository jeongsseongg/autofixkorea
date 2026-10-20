import {authenticate,hasSession,logout,request} from '../../services/listings/index.js';
import {$,api,node,labels,statuses,download} from './api.js';
import {openDetail,mountDetail,clearDetail} from './detail.js';
let items=[],offset=0,hasMore=false;
function render(){
 const search=$('search').value.trim().toLowerCase();
 const visible=items.filter(row=>JSON.stringify([row.id,row.fields]).toLowerCase().includes(search));
 $('rows').replaceChildren(...visible.map(row=>{
  const card=node('article','','hub-card');
  card.append(node('span',labels[row.source],'hub-chip'),node('h3',row.fields.subject||[row.fields.brand,row.fields.model].filter(Boolean).join(' ')||'상담 접수'));
  card.append(node('p',new Date(row.created_at).toLocaleString('ko-KR')),node('p',row.fields.name||row.fields.contact||row.fields.phone||'원본에서 확인'),node('p',statuses[row.progress]+' · '+(row.submission_status==='complete'?'접수 완료':'사진 업로드 대기')));
  if(row.telegram_status==='failed')card.append(node('p','텔레그램 알림 실패 · 접수 원본은 저장되어 있습니다.'));
  const button=node('button','입력 내용·사진 확인');button.addEventListener('click',()=>openDetail({source:row.source,id:row.id}).catch(error=>{$('error').textContent=error.message;}));card.append(button);return card;
 }));
 $('status').textContent=items.length?'이 페이지 '+items.length+'건 · 검색 결과 '+visible.length+'건':'접수 내역이 없습니다.';
 $('previous').disabled=offset===0;$('next').disabled=!hasMore;$('page').textContent=offset/50+1+' 페이지';
}
async function refresh(){
 $('refresh').disabled=true;
 try{const result=await api('list',{source:$('source').value,offset});items=result.items;hasMore=result.hasMore;render();}
 finally{$('refresh').disabled=false;}
}
function showLogin(){
 items=[];$('rows').replaceChildren();clearDetail();$('detail').close();$('workspace').hidden=true;$('login').hidden=false;$('logout').hidden=true;
}
async function state(){
 if(!hasSession())return showLogin();
 const user=await request('me');if(user.role!=='admin'){showLogin();throw new Error('기존 업체 계정으로는 열 수 없습니다. 관리자 비밀번호로 로그인해 주세요.');}
 $('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;await refresh();
}
async function run(task){try{$('error').textContent='';await task();}catch(error){$('error').textContent=error.message;}}
export async function mount(){
 mountDetail(refresh);
 $('login-form').addEventListener('submit',event=>{event.preventDefault();run(async()=>{const button=event.submitter;button.disabled=true;try{await authenticate('admin',event.target.elements.password.value);event.target.reset();await state();}finally{button.disabled=false;}});});
 $('logout').addEventListener('click',()=>run(async()=>{try{await logout();}finally{showLogin();}}));
 $('refresh').addEventListener('click',()=>run(refresh));$('search').addEventListener('input',render);
 $('source').addEventListener('change',()=>run(async()=>{offset=0;await refresh();}));
 $('previous').addEventListener('click',()=>run(async()=>{offset=Math.max(0,offset-50);await refresh();}));
 $('next').addEventListener('click',()=>run(async()=>{offset+=50;await refresh();}));
 $('export').addEventListener('click',()=>download('autofix-receipts.json',items));await run(state);
}
