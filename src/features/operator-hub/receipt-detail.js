import {$,api,node,labels,statuses,download} from './api.js';
import {questions,conditionFields,serviceTypes,accidentTypes} from '../../../consultation/src/form-fields.js';
let current=null,urls=[],generation=0,call=api;
const fields={name:'성함',contact:'연락처',phone:'연락처',brand:'제조사',model:'세부 모델·등급',service:'접수 구분',year:'연식',mileage:'주행거리',region:'지역',price:'희망금액',memo:'메모',message:'문의 내용',subject:'제목',sender:'발신자',unknownQuestions:'확인이 필요한 항목',vehiclePhotosLater:'차량 사진 추후 제출',interiorPhotosLater:'실내 사진 추후 제출',airbagDetail:'에어백 상세',financeAmount:'할부·저당 금액',financeDetail:'할부·저당 상세'};
export function clearDetail(){generation++;urls.forEach(URL.revokeObjectURL);urls=[];current=null;$('detail-body').replaceChildren();$('note').value='';}
function answer(key,value,names){
 if(key==='service')return {accidentSale:'사고차 매입',breakdownSale:'고장차 매입',accidentRepair:'사고차 수리'}[value]||String(value);
 if(key==='accidentType')return accidentTypes.find(row=>row[0]===value)?.[1]||String(value);
 if(key==='unknownQuestions')return String(value).split(',').map(id=>names[id]||id).join(', ');
 if(typeof value==='boolean')return value?'예':'아니오';return typeof value==='object'?JSON.stringify(value,null,2):String(value);
}
async function photo(row,index,container,version){
 try{
  const blob=await call('photo',{source:row.source,id:row.id,index});if(version!==generation)return;
  const url=URL.createObjectURL(blob);urls.push(url);const file=row.photos[index],figure=node('figure');
  const name=file.name||'autofix-'+row.id+'-'+(index+1)+'.'+(blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg');
  const link=node('a','원본 열기');link.href=url;link.target='_blank';link.rel='noopener noreferrer';
  if(['image/jpeg','image/png','image/webp'].includes(blob.type)){const image=node('img');image.src=url;image.alt='접수 사진 '+(index+1);link.prepend(image);}else link.textContent=file.name||'첨부파일 '+(index+1);
  const save=node('a','사진 '+(index+1)+' 원본 저장');save.href=url;save.download=name;figure.append(link,save);container.append(figure);
 }catch{if(version===generation)container.append(node('p','사진 '+(index+1)+'을 불러오지 못했습니다.'));}
}
export async function openDetail(key){
 clearDetail();const version=generation,row=await call('detail',key);if(version!==generation)return;current=row;
 $('detail-title').textContent=labels[row.source]+' 접수 상세';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(row.created_at)).map(p=>[p.type,p.value]));
 const body=$('detail-body'),time=`${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
 body.append(node('p','원본번호: '+row.id),node('p',time+' KST'));
 const summary=node('dl');summary.append(node('dt','진행 상태'),node('dd',statuses[row.progress]||'확인 필요'));body.append(summary);
 const names={...Object.fromEntries(questions.map(q=>[q.id,q.label])),...fields,...Object.fromEntries(conditionFields(row.fields.service).map(([id,label])=>[id,label]))};
 const answers=node('dl');for(const [key,value] of Object.entries(row.fields))answers.append(node('dt',names[key]||key),node('dd',answer(key,value,names)));body.append(answers);
 const phone=String(row.fields.contact||row.fields.phone||'').replace(/[^0-9]/g,'');
 if(/^0\d{9,10}$/.test(phone)){const copy=node('button','연락처 복사');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(phone);copy.textContent='복사했습니다.';}catch{copy.textContent='복사하지 못했습니다.';}});body.append(copy);}
 body.append(node('h3','접수 사진·첨부 원본'));const photos=node('div','','hub-photos');body.append(photos);if(!row.photos.length)photos.append(node('p','첨부 사진이 없습니다.'));
 const button=node('button','전체 입력 원본 JSON 저장');button.type='button';button.addEventListener('click',()=>download('autofix-'+row.id+'.json',row));body.append(button);
 $('progress').value=row.progress;$('note').value=row.note||'';$('save-status').textContent='';$('detail').showModal();await Promise.all(row.photos.map((_,index)=>photo(row,index,photos,version)));
}
export function mountDetail(refresh,gateway=api){
 call=gateway;$('close').addEventListener('click',()=>{$('detail').close();clearDetail();});$('detail').addEventListener('close',clearDetail);
 $('update').addEventListener('submit',async event=>{
  event.preventDefault();if(!current)return;const button=event.submitter;button.disabled=true;
  try{await call('update',{source:current.source,id:current.id,status:$('progress').value,note:$('note').value});current.progress=$('progress').value;$('save-status').textContent='저장했습니다.';await refresh();}
  catch(error){$('save-status').textContent=error.message;}finally{button.disabled=false;}
 });
}
