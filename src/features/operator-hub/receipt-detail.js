import {$,api,node,statuses,download} from './api.js';
import {serviceName,vehicleName,receiptDate,renderFields} from './receipt-fields.js';
import {renderGallery,clearGallery} from './receipt-gallery.js';
let current=null,generation=0,call=api;
export function clearDetail(){generation++;clearGallery();current=null;$('detail-body').replaceChildren();$('note').value='';}
function overview(row){
 const section=node('section','','receipt-overview'),heading=node('div'),badges=node('div','','receipt-badges');
 badges.append(node('span',serviceName(row.fields.service),'receipt-service'),node('span',statuses[row.progress]||'확인 필요','receipt-status'));
 badges.querySelector('.receipt-status').dataset.progress=row.progress;
 const short='AF-'+row.id.replaceAll('-','').slice(-8).toUpperCase();
 heading.append(badges,node('h3',vehicleName(row.fields)),node('p',short+' · '+receiptDate(row.created_at)+' 접수'));
 const contact=node('div','','receipt-contact'),phone=String(row.fields.contact||row.fields.phone||'').replace(/[^0-9]/g,'');
 contact.append(node('span',row.fields.name||'연락처'),node('strong',phone.replace(/^(0\d{2})(\d{3,4})(\d{4})$/,'$1-$2-$3')||'미입력'));
 if(/^0\d{9,10}$/.test(phone)){const copy=node('button','연락처 복사','hub-button-secondary');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(phone);copy.textContent='복사했습니다.';}catch{copy.textContent='복사하지 못했습니다.';}});contact.append(copy);}
 section.append(heading,contact);return section;
}
export async function openDetail(key){
 clearDetail();const version=generation,row=await call('detail',key);if(version!==generation)return;current=row;
 $('detail-title').textContent='차량 접수 상세';const body=$('detail-body');body.append(overview(row));
 const columns=node('div','','receipt-columns');columns.append(renderGallery(row,call),renderFields(row.fields));body.append(columns);
 const original=node('details','','receipt-original');original.append(node('summary','원본 정보 및 내보내기'),node('p','원본번호: '+row.id));
 const exportButton=node('button','전체 입력 원본 저장','hub-button-secondary');exportButton.type='button';exportButton.addEventListener('click',()=>download('autofix-'+row.id+'.json',row));original.append(exportButton);body.append(original);
 $('progress').value=row.progress;$('note').value=row.note||'';$('save-status').textContent='';$('detail').showModal();
}
export function mountDetail(refresh,gateway=api){
 call=gateway;$('close').addEventListener('click',()=>{$('detail').close();clearDetail();});$('detail').addEventListener('close',clearDetail);
 $('update').addEventListener('submit',async event=>{
  event.preventDefault();if(!current)return;const button=event.submitter;button.disabled=true;
  try{await call('update',{source:current.source,id:current.id,status:$('progress').value,note:$('note').value});current.progress=$('progress').value;$('detail-body').querySelector('.receipt-status').dataset.progress=current.progress;$('detail-body').querySelector('.receipt-status').textContent=statuses[current.progress];$('save-status').textContent='저장했습니다.';await refresh();}
  catch(error){$('save-status').textContent=error.message;}finally{button.disabled=false;}
 });
}
