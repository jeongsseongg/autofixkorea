import {activeQuestions,conditionFields,hasAirbag} from './form-fields.js';
export function validate(input){
 const values=input.values;
 if(!values||typeof values!=='object'||Array.isArray(values)||input.consent!==true)throw new Error('CONSENT_OR_VALUES_REQUIRED');
 if(Object.keys(values).length>50)throw new Error('INVALID_VALUES');
 const v={};for(const [key,value] of Object.entries(values)){if(!/^[a-zA-Z]+$/.test(key)||!['string','boolean'].includes(typeof value)||String(value).length>1000)throw new Error('INVALID_VALUES');v[key]=value;}
 if(!['accidentSale','breakdownSale','accidentRepair'].includes(v.service))throw new Error('INVALID_SERVICE');
 if(v.service!=='breakdownSale'&&!['uninsured','single','other'].includes(v.accidentType))throw new Error('INVALID_ACCIDENT');
 for(const q of activeQuestions(v)){
  if(['photos','details'].includes(q.kind))continue;
  const value=String(v[q.id]??'').trim();
  if(!q.optional&&!value)throw new Error('REQUIRED_'+q.id);
  if(value&&(q.numeric||['number','money'].includes(q.kind))&&(!/^\d+$/.test(value)||Number(value)<(q.min??0)||Number(value)>(q.max??Number.MAX_SAFE_INTEGER)))throw new Error('INVALID_NUMBER');
 }
 if(!/^0\d{9,10}$/.test(String(v.contact).replace(/[() -]/g,'')))throw new Error('INVALID_PHONE');
 for(const [key,,,required] of conditionFields(v.service))if(required&&!String(v[key]??'').trim())throw new Error('INVALID_CONDITION');
 if(hasAirbag(v)&&!String(v.airbagDetail??'').trim())throw new Error('AIRBAG_DETAILS_REQUIRED');
 if(!Array.isArray(input.photos)||input.photos.length<1||input.photos.length>30)throw new Error('INVALID_PHOTOS');
 const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 const photos=input.photos.map((p,i)=>{if(!extensions[p.mime]||!Number.isInteger(p.size)||p.size<12||p.size>20971520||!['vehicle','interior'].includes(p.category))throw new Error('INVALID_PHOTO');return {mime:p.mime,size:p.size,category:p.category,path:input.id+'/'+i+'.'+extensions[p.mime]};});
 if(!photos.some(p=>p.category==='vehicle')||(hasAirbag(v)&&!photos.some(p=>p.category==='interior')))throw new Error('REQUIRED_PHOTO_MISSING');
 return {values:v,photos};
}
export function imageMatches(bytes,mime){
 if(mime==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(mime==='image/png')return [137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x);
 return new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
}
