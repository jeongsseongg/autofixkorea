import {mountRegistration} from './registration.js';
import {authenticate,request,hasSession,logout} from '../../services/listings/index.js';
import {mountAdmin,editListing} from './management.js';
const $=id=>document.getElementById('lot-'+id);
const states={review:'검토 대기',published:'판매 중',sold:'판매 완료',archived:'보관'};
let dealer=null,photoUrls=[],generation=0;
function node(tag,text,className){const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;}
export function message(value){$('message').textContent=value;}
function clearPhotos(){generation++;for(const url of photoUrls)URL.revokeObjectURL(url);photoUrls=[];}
async function loadPhoto(container,lot,index){
 const current=generation;
 try{
  const blob=await request('photo',{id:lot.id,index});if(current!==generation)return;
  const url=URL.createObjectURL(blob);photoUrls.push(url);
  const image=document.createElement('img');image.src=url;image.alt=lot.title+' 사진 '+(index+1);container.append(image);
 }catch{container.append(node('p','사진을 불러오지 못했습니다.'));}
}
function card(lot){
 const article=node('article','','lot-card');
 article.append(node('p',states[lot.status],'lot-status'),node('h3',lot.title||'정보 확인 중'));
 article.append(node('p',[lot.year&&lot.year+'년',lot.mileage_km!==null&&Number(lot.mileage_km).toLocaleString()+'km',lot.fuel].filter(Boolean).join(' · ')));
 article.append(node('p',lot.price_krw===null?'가격 확인 필요':Number(lot.price_krw).toLocaleString()+'원','lot-price'));
 const button=node('button','사진·상세정보');button.addEventListener('click',()=>run(()=>detail(lot)));article.append(button);return article;
}
async function detail(lot){
 clearPhotos();const container=$('detail-body');container.replaceChildren(node('h2',lot.title||'정보 확인 중'));
 container.append(node('p',[states[lot.status],lot.region,lot.accident_type].join(' · ')),node('p',lot.description));
 const photos=node('div','','lot-photos');container.append(photos);$('detail').showModal();
 if(dealer.role==='admin')await editListing(container,lot,refresh,message);
 await Promise.all(lot.photos.map((_,index)=>loadPhoto(photos,lot,index)));
}
async function run(action){try{message('처리 중…');await action();message('');}catch(error){message(error.message);}}
async function refresh(){
 const lots=await request('list');$('list').replaceChildren(...lots.map(card));
 if(!lots.length)$('list').append(node('p','현재 공유된 매물이 없습니다.'));
}
async function state(){
 clearPhotos();for(const id of ['login','pending','market','admin'])$(id).hidden=true;
 $('logout').hidden=!hasSession();
 if(!hasSession()){$('login').hidden=false;return;}
 try{dealer=await request('me');}catch(error){$('login').hidden=false;throw error;}
 if(dealer.status!=='approved'){$('pending').hidden=false;return;}
 $('market').hidden=false;await refresh();
 if(dealer.role==='admin'){$('admin').hidden=false;await mountAdmin(message);mountRegistration(message,refresh);}
}
export async function mount(){
 $('role').addEventListener('change',()=>{const role=$('role').value;$('dealer-id').hidden=role!=='dealer';$('setup-code').hidden=role!=='setup';});
 $('login-form').addEventListener('submit',async event=>{
  event.preventDefault();const values=Object.fromEntries(new FormData(event.target));
  const buttons=[...event.target.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{
   message('로그인 확인 중…');const active=await authenticate(values.role,values.password,values.login_id,values.code);
   event.target.reset();await state();message(active?'로그인했습니다.':'');
  }catch(error){message(error.message);}finally{buttons.forEach(b=>b.disabled=false);}
 });
 $('logout').addEventListener('click',()=>run(async()=>{try{await logout();}finally{dealer=null;$('detail').close();$('detail-body').replaceChildren();$('list').replaceChildren();await state();}}));
 $('close').addEventListener('click',()=>$('detail').close());
 $('detail').addEventListener('close',()=>{clearPhotos();$('detail-body').replaceChildren();});
 $('refresh').addEventListener('click',()=>run(state));$('reload').addEventListener('click',()=>run(refresh));
 await run(state);
}
