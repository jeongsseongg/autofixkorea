import {request} from '../../services/listings/index.js';
const fields={title:'차량명',year:'연식',mileage_km:'주행거리',price_krw:'가격',fuel:'연료',accident_type:'사고유형',region:'지역',description:'설명'};
function encode(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('사진을 읽지 못했습니다.'));reader.readAsDataURL(file);});}
export function mountRegistration(message,refresh){
 const form=document.getElementById('lot-register-form');if(form.dataset.ready)return;
 form.dataset.ready='true';const anchor=form.firstElementChild;
 for(const [name,text] of Object.entries(fields)){
  const label=document.createElement('label');label.textContent=text+(name==='price_krw'?'(원)':name==='mileage_km'?'(km)':'');
  const input=document.createElement(name==='description'?'textarea':'input');input.name=name;input.required=name!=='description';input.maxLength=name==='description'?1000:100;
  if(['year','mileage_km','price_krw'].includes(name)){input.type='number';input.min='0';input.step='1';}
  label.append(input);form.insertBefore(label,anchor);
 }
 let eventId=crypto.randomUUID();
 form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('button');button.disabled=true;
  try{
   const data=new FormData(form),files=data.getAll('photos').filter(f=>f.size);
   if(!files.length||files.length>10||files.reduce((sum,f)=>sum+f.size,0)>9*1024*1024)throw new Error('사진은 1~10장, 합계 9MB까지 등록할 수 있습니다.');
   const text=Object.entries(fields).map(([key,label])=>label+': '+String(data.get(key)||'').replaceAll('\n',' ')+(key==='price_krw'?'원':key==='mileage_km'?'km':'')).join('\n');
   message('사진과 매물을 등록하고 있습니다.');await request('create',{event:eventId,text,photos:await Promise.all(files.map(encode))});
   eventId=crypto.randomUUID();form.reset();await refresh();message('검토 대기로 등록했습니다. 상세정보에서 확인 후 업체에 공유하세요.');
  }catch(error){message(error.message);}finally{button.disabled=false;}
 };
}
