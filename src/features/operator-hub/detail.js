import {$,api,node,labels,statuses,download} from './api.js';
let current=null,urls=[],generation=0;
const fields={name:'성함',contact:'연락처',phone:'연락처',brand:'제조사',model:'차종',year:'연식',mileage:'주행거리',region:'지역',price:'희망금액',service:'서비스',accidentType:'사고 유형',memo:'메모',message:'문의 내용'};
export function clearDetail(){generation++;urls.forEach(URL.revokeObjectURL);urls=[];current=null;$('detail-body').replaceChildren();$('note').value='';}
async function photo(row,index,container,version){
 try{
  const blob=await api('photo',{source:row.source,id:row.id,index});if(version!==generation)return;
  const url=URL.createObjectURL(blob);urls.push(url);
  if(['image/jpeg','image/png','image/webp'].includes(blob.type)){const image=document.createElement('img');image.src=url;image.alt='접수 사진 '+(index+1);container.append(image);}
  else{const link=node('a',row.photos[index].name||'첨부파일 '+(index+1));link.href=url;link.download=row.photos[index].name||'attachment';container.append(link);}
 }catch{if(version===generation)container.append(node('p','사진 '+(index+1)+'을 불러오지 못했습니다.'));}
}
export async function openDetail(key){
 clearDetail();const version=generation,row=await api('detail',key);if(version!==generation)return;current=row;
 $('detail-title').textContent=labels[row.source]+' 접수 상세';
 const body=$('detail-body');body.append(node('p',row.id),node('p',new Date(row.created_at).toLocaleString('ko-KR')));
 const answers=node('dl','');
 for(const [key,value] of Object.entries(row.fields))answers.append(node('dt',fields[key]||key),node('dd',typeof value==='object'?JSON.stringify(value):String(value)));
 body.append(answers);const photos=node('div','','hub-photos');body.append(photos);
 const button=node('button','원본 JSON 내려받기');button.addEventListener('click',()=>download('autofix-'+row.id+'.json',row));body.append(button);
 $('progress').value=row.progress;$('note').value=row.note;$('save-status').textContent='';$('detail').showModal();
 await Promise.all(row.photos.map((_,index)=>photo(row,index,photos,version)));
}
export function mountDetail(refresh){
 $('close').addEventListener('click',()=>{$('detail').close();clearDetail();});$('detail').addEventListener('close',clearDetail);
 $('update').addEventListener('submit',async event=>{
  event.preventDefault();if(!current)return;const button=event.submitter;button.disabled=true;
  try{await api('update',{source:current.source,id:current.id,status:$('progress').value,note:$('note').value});$('save-status').textContent='저장했습니다.';await refresh();}
  catch(error){$('save-status').textContent=error.message;}finally{button.disabled=false;}
 });
}
