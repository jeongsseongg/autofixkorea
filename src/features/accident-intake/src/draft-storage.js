const draftNamespace=document.body.dataset.brand==='solution'?'solution':'autofix';
const draftKey=draftNamespace+'-consultation-draft-v1';
export function mountDraftStorage(snapshot,status){
 let db,ready=false,queue=Promise.resolve(),fingerprint='',photoFailure=false;
 const signature=photos=>JSON.stringify(photos.map(p=>[p.category,p.file.name,p.file.size,p.file.lastModified]));
 function open(){return new Promise((resolve,reject)=>{
  const request=indexedDB.open(draftNamespace+'-consultation',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('draft');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });}
 function transaction(mode,action){return new Promise((resolve,reject)=>{
  const tx=db.transaction('draft',mode),request=action(tx.objectStore('draft'));
  tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });}
 async function load(){
  let meta=null,photos=[];
  try{meta=JSON.parse(localStorage.getItem(draftKey)||'null');}catch{status.textContent='자동 저장을 사용할 수 없는 브라우저예요.';}
  try{db=await open();photos=await transaction('readonly',s=>s.get('photos'))||[];}
  catch{photoFailure=true;status.textContent='사진 자동 저장을 사용할 수 없어요. 완료 후 상담서를 저장해주세요.';}
  fingerprint=signature(photos);ready=true;return {meta,photos};
 }
 function save(){
  if(!ready)return;
  const current=snapshot();
  try{localStorage.setItem(draftKey,JSON.stringify({values:current.values,questionId:current.questionId,review:current.review}));}
  catch{status.textContent='입력 내용이 자동 저장되지 않았어요. 브라우저 저장 공간을 확인해주세요.';return;}
  const photos=current.photos.map(p=>({file:p.file,category:p.category})),key=signature(photos);
  if(key===fingerprint&&!photoFailure){status.textContent='이 브라우저에 자동 저장됨';return;}
  if(!db){status.textContent='입력 내용 저장됨 · 사진 자동 저장은 사용할 수 없어요';return;}
  status.textContent='사진을 자동 저장하고 있어요…';
  queue=queue.then(async()=>{
   try{await transaction('readwrite',s=>s.put(photos,'photos'));fingerprint=key;photoFailure=false;status.textContent='내용과 사진이 자동 저장됨';}
   catch{photoFailure=true;status.textContent='내용 저장됨 · 사진 저장 실패. 저장 공간을 확인해주세요.';}
  });
 }
 return {load,save};
}
