import {node} from './api.js';
let urls=[],generation=0;
export function clearGallery(){generation++;urls.forEach(URL.revokeObjectURL);urls=[];}
export function renderGallery(row,call){
 const version=generation,section=node('section','','receipt-gallery');
 const heading=node('div','','receipt-section-heading');heading.append(node('h3','차량 사진'),node('span',row.photos.length+' PHOTOS'));section.append(heading);
 if(!row.photos.length){const empty=node('div','','receipt-photo-empty');empty.append(node('span','사진 미첨부'),node('p','등록된 사진이 없습니다.'));section.append(empty);return section;}
 const stage=node('div','','receipt-photo-stage'),image=node('img'),loading=node('p','사진을 불러오는 중입니다.','receipt-photo-loading');image.hidden=true;stage.append(image,loading);
 const open=node('a','원본 열기 ↗','hub-button-secondary');open.target='_blank';open.rel='noopener noreferrer';
 const save=node('a','원본 저장 ↓','hub-button-primary');open.hidden=true;save.hidden=true;
 const actions=node('div','','receipt-photo-actions'),count=node('span','');actions.append(count,open,save);
 const thumbs=node('div','','receipt-thumbnails'),entries=[];let selected=-1,manual=false;
 function select(index){const item=entries[index];if(!item?.url)return;selected=index;if(item.isImage)image.src=item.url;else image.removeAttribute('src');image.alt='접수 사진 '+(index+1);image.hidden=!item.isImage;loading.hidden=item.isImage;loading.textContent=item.name;open.href=item.url;save.href=item.url;save.download=item.name;open.hidden=false;save.hidden=false;count.textContent=(index+1)+' / '+row.photos.length;entries.forEach((entry,i)=>entry?.button.setAttribute('aria-pressed',String(i===index)));}
 row.photos.forEach((file,index)=>{
  const button=node('button','','receipt-thumbnail');button.type='button';button.setAttribute('aria-label','사진 '+(index+1)+' 보기');button.setAttribute('aria-pressed','false');button.disabled=true;button.append(node('span',String(index+1)));thumbs.append(button);entries[index]={button};button.addEventListener('click',()=>{manual=true;select(index);});
  call('photo',{source:row.source,id:row.id,index}).then(blob=>{
   if(version!==generation)return;const url=URL.createObjectURL(blob);urls.push(url);
   const isImage=['image/jpeg','image/png','image/webp'].includes(blob.type);
   if(isImage){const thumbnail=node('img');thumbnail.src=url;thumbnail.alt='';button.replaceChildren(thumbnail);}else button.textContent='첨부 '+(index+1);button.disabled=false;
   Object.assign(entries[index],{url,isImage,name:file.name||'autofix-'+row.id+'-'+(index+1)+'.'+(blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':isImage?'jpg':'bin')});
   if(!manual&&(index===0||selected<0))select(index);
  }).catch(()=>{if(version===generation){button.textContent='불러오기 실패';loading.textContent='일부 사진을 불러오지 못했습니다.';}});
 });
 section.append(stage,actions,thumbs);return section;
}
