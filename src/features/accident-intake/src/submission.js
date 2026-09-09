import {publicKey} from '/src/config/supabase-public.js';
const endpoint='https://ytigiculewerivyytxza.supabase.co/functions/v1/autofix-accident-intake';
export function mountSubmission(snapshot){
 const status=document.querySelector('[data-save-status]'),save=document.querySelector('[data-save]');
 let credentials=null,busy=false,finished=false;
 async function api(body){
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:publicKey,Authorization:'Bearer '+publicKey},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const result=await response.json();
  if(!response.ok)throw new Error('접수를 완료하지 못했어요. 입력 내용은 유지됩니다. ('+(result.code||response.status)+', '+(result.traceId||'')+')');
  return result;
 }
 async function persist(){
  if(!document.querySelector('[data-intake-consent]').checked)throw new Error('상담 정보 수집·이용에 동의해주세요.');
  const data=snapshot();
  credentials??={id:crypto.randomUUID(),token:crypto.randomUUID()+crypto.randomUUID()};
  const manifest=data.photos.map(p=>({mime:p.file.type,size:p.file.size,category:p.category}));
  const result=await api({action:'start',...credentials,values:data.values,photos:manifest,consent:true});
  for(let i=0;i<data.photos.length;i++){
   status.textContent='차량 사진을 안전하게 저장하고 있어요. '+(i+1)+' / '+data.photos.length;
   const upload=await fetch(result.uploads[i],{method:'PUT',headers:{'Content-Type':data.photos[i].file.type},body:data.photos[i].file,signal:AbortSignal.timeout(120000)});
   if(!upload.ok){const body=await upload.json().catch(()=>({}));if(body.error!=='Duplicate'&&body.statusCode!=='409'&&upload.status!==409)throw new Error('사진 저장에 실패했어요. 다시 신청하면 이어서 저장합니다.');}
  }
  await api({action:'complete',...credentials});finished=true;
  status.textContent='상담 신청과 사진 접수가 완료되었습니다. 확인 후 연락드리겠습니다. 접수번호: '+credentials.id;
 }
 save.addEventListener('click',async()=>{
  if(busy||finished)return;busy=true;save.disabled=true;document.querySelector('[data-edit]').disabled=true;
  try{await persist();}catch(e){status.textContent=e.message;}
  finally{busy=false;save.disabled=finished;document.querySelector('[data-edit]').disabled=finished;}
 });
 document.querySelector('[data-copy]').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(snapshot().text);status.textContent='상담 내용을 복사했습니다.';}catch{status.textContent='상담 내용을 선택해서 복사해주세요.';}});
 return {reset(){credentials=null;finished=false;save.disabled=false;status.textContent='확인 후 상담 신청하기를 눌러주세요.';}};
}
