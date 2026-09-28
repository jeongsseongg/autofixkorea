const labels = {차량명:'title',연식:'year',주행거리:'mileage_km',가격:'price_krw',연료:'fuel',사고유형:'accident_type',지역:'region',설명:'description'};
const required = ['title','year','mileage_km','price_krw','fuel','accident_type','region'];
export function amount(value, unit) {
 const text=String(value||'').replaceAll(',','').trim();
 const match=text.match(unit==='price'?/^(\d+(?:\.\d+)?)\s*(원|만원|억)$/ : /^(\d+)\s*(km|킬로미터)?$/i);
 if(!match)return null;
 const multiplier=unit==='price'?({'원':1,'만원':10000,'억':100000000}[match[2]]):1;
 const number=Number(match[1])*multiplier;
 return Number.isSafeInteger(number)&&number>=0&&number<=(unit==='price'?100000000000:10000000)?number:null;
}
export function normalize(text, photos=[], album=false) {
 const fields={}, reasons=[];
 for(const line of text.split(/\r?\n/)) {
  const match=line.match(/^\s*([^:：]+)[:：]\s*(.*)$/);
  const key=match&&labels[match[1].trim()];
  if(key){if(Object.hasOwn(fields,key))reasons.push('중복 항목: '+match[1]);fields[key]=match[2].trim();}
 }
 const year=/^(19|20)\d{2}년?$/.test(fields.year||'')?Number(fields.year.replace('년','')):null;
 const listing={title:(fields.title||'').slice(0,120),year,mileage_km:amount(fields.mileage_km,'distance'),
  price_krw:amount(fields.price_krw,'price'),fuel:(fields.fuel||'').slice(0,40),
  accident_type:(fields.accident_type||'').slice(0,60),region:(fields.region||'').slice(0,80),
  description:(fields.description||'').slice(0,1500),photos};
 // Raw messages (including owner contacts) remain in the service-only inbox.
 const privatePattern=/(?:\d[\s-]*){9,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|카카오|카톡|전화|연락처/i;
 for(const key of ['title','fuel','accident_type','region','description']) {
  if(privatePattern.test(listing[key])){listing[key]='';reasons.push('연락처 포함 항목 확인: '+key);}
 }
 for(const key of required)if(listing[key]===null||listing[key]==='')reasons.push('필수 항목: '+key);
 if(!photos.length)reasons.push('차량 사진 필요');
 if(album)reasons.push('사진 묶음 확인 필요');
 return {...listing,review_reasons:reasons};
}
export function imageType(bytes) {
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 throw new Error('INVALID_IMAGE');
}
