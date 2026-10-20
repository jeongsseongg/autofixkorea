const channels={naver:'네이버',google:'구글',meta:'인스타그램·페이스북',kakao:'카카오',youtube:'유튜브',blog:'블로그',referral:'외부 사이트',unknown:'출처 미확인'};
const media={paid:'광고',search:'검색·광고 여부 미확인',social:'소셜',referral:'외부 링크',unknown:'구분 정보 없음'};
const unique=items=>new Set(items).size;
const formKey=e=>e.visit+':'+e.data.form;
const rate=(a,b)=>b?Math.round(a/b*1000)/10:0;
function grouped(rows,key){const map=new Map();for(const e of rows){const k=key(e);if(!map.has(k))map.set(k,[]);map.get(k).push(e);}return map;}
function stats(rows,now){
 const starts=new Set(rows.filter(e=>e.type==='form_start').map(formKey));
 const successes=new Set(rows.filter(e=>e.type==='form_success').map(formKey));
 const activity=new Map();for(const e of rows)activity.set(e.visit,Math.max(activity.get(e.visit)||0,Date.parse(e.received_at)));
 let abandoned=0;
 for(const key of starts)if(!successes.has(key)&&+new Date(now)-(activity.get(key.split(':')[0])||0)>=1800000)abandoned++;
 const visits=unique(rows.map(e=>e.visit));
 return {visits,phoneClicks:rows.filter(e=>e.type==='contact_click'&&e.data.kind==='phone').length,
 kakaoClicks:rows.filter(e=>e.type==='contact_click'&&e.data.kind==='kakao').length,
 starts:starts.size,submits:successes.size,abandoned,rate:rate(unique(rows.filter(e=>e.type==='form_success').map(e=>e.visit)),visits)};
}
export function acquisitionReport(rows,first,now){
 const routes=[...grouped(rows,e=>JSON.stringify([first.get(e.visit).channel,first.get(e.visit).medium]))].map(([key,events])=>{
 const [channel,medium]=JSON.parse(key);return {channel,medium,label:`${channels[channel]} · ${media[medium]}`,...stats(events,now)};
 }).sort((a,b)=>b.visits-a.visits);
 const keywords=[...grouped(rows.filter(e=>first.get(e.visit).term),e=>JSON.stringify([first.get(e.visit).channel,first.get(e.visit).term]))]
 .map(([key,events])=>{const [channel,term]=JSON.parse(key);return {channel,term,...stats(events,now)};}).sort((a,b)=>b.submits-a.submits||b.visits-a.visits);
 const journeys=[...grouped(rows,e=>e.visit)].filter(([,events])=>events.some(e=>e.type==='contact_click'||e.type.startsWith('form_')))
 .map(([visit,events])=>{
 const source=first.get(visit),steps=events.filter(e=>e.type==='form_step'||e.type==='form_progress');
 const last=steps.at(-1),success=events.filter(e=>e.type==='form_success'),started=events.some(e=>e.type==='form_start');
 const activity=Math.max(...events.map(e=>Date.parse(e.received_at)));
 const state=success.length?'접수 완료':started?(+new Date(now)-activity>=1800000?'작성 중단 추정':'작성 중'):'버튼 클릭';
 return {visit,source,device:events[0].device,startedAt:events[0].ts,lastAt:events.at(-1).ts,state,
 lastStep:last?.data.step || '',percent:success.length?100:last?.data.percent ?? 0,
 receipts:[...new Set(success.filter(e=>e.data.serverVerified===true).map(e=>e.data.receipt))],
 actions:events.filter(e=>['page_view','contact_click','form_start','form_step','form_attempt','form_success','form_error'].includes(e.type))
 .map(e=>({at:e.ts,type:e.type,page:e.page,...e.data})).slice(-80)};
 }).sort((a,b)=>Date.parse(b.lastAt)-Date.parse(a.lastAt));
 return {routes,keywords,journeys:journeys.slice(0,100),journeyCount:journeys.length};
}
