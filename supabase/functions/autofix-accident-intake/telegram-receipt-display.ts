export function receiptCheckpoint(row:any){try{return JSON.parse(row.telegram_message_id||'null');}catch{return null;}}
export function receiptLayout(row:any){const saved=receiptCheckpoint(row);return !saved||saved.receipt_layout===4?4:saved.receipt_layout===3?3:saved.receipt_layout===2?2:1;}
export const receiptShort=(value:unknown,max=80)=>Array.from(String(value??'확인 필요').replace(/\s+/g,' ').trim()).slice(0,max).join('');
export function vehicleTitle(values:any,limit=90){
 const parts=[values.manufacturer,values.group,values.model].filter(v=>typeof v==='string'&&v.trim()).map(v=>receiptShort(v,limit));
 const normal=(v:string)=>v.toLocaleLowerCase().replace(/[()_/·-]+/g,' ').replace(/\s+/g,' ').trim();
 return receiptShort(parts.filter((v,i)=>!parts.some((other,j)=>j!==i&&(normal(other)===normal(v)?j<i:(' '+normal(other)+' ').includes(' '+normal(v)+' ')))).join(' ')||'차량 정보 확인 필요',limit);
}
export function receiptIdentity(row:any){
 const date=new Date(row.completed_at||row.created_at),valid=Number.isFinite(+date);
 const parts=valid?Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value])):{};
 const clean=receiptLayout(row)>=3,suffix=String(row.id).replaceAll('-','').slice(-8).toUpperCase();
 const time=valid?`${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${clean?'한국 시간':'KST'}`:'접수일 확인 필요';
 const label=clean?`${valid?parts.year+parts.month+parts.day:'날짜미확인'}-${Number.parseInt(suffix,16).toString().padStart(10,'0')}`:`AF-${valid?parts.month+parts.day:'미확인'}-${suffix}`;
 return {time,label,vehicle:vehicleTitle(row.values),url:'https://www.autofixkorea.com/hub/?view=receipt#'+new URLSearchParams({source:'accident',id:row.id})};
}
export function receiptButtons(row:any){
 const digits=String(row.values.contact||'').replace(/[^0-9]/g,''),copy=/^0\d{9,10}$/.test(digits)?{text:'전화번호 복사',copy_text:{text:digits}}:null;
 if(receiptLayout(row)<2)return copy?{inline_keyboard:[[copy]]}:undefined;
 return {inline_keyboard:[[{text:'전체 접수 보기',url:receiptIdentity(row).url}],...(copy?[[copy]]:[])]};
}
