const channels={naver:'네이버',google:'구글',meta:'인스타·페이스북',kakao:'카카오',youtube:'유튜브',blog:'블로그',referral:'외부 사이트',unknown:'출처 미확인'};
const media={paid:'광고',search:'검색(광고 여부 미확인)',social:'소셜',referral:'외부 링크',unknown:'구분 미확인'};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const count=value=>Number.isFinite(value)&&value>=0?value.toLocaleString('ko-KR'):'미수집';
export const plain=value=>Array.from(String(value??'미수집').replace(/(?:\d[ _-]*){8,}/g,'[비공개]').replace(/\s+/g,' ')).slice(0,28).join('');
export const sourceLabel=source=>`${channels[source?.channel]??channels.unknown}${source?.medium?' '+(media[source.medium]??media.unknown):''}`;
const top=map=>[...map].sort((a,b)=>b[1]-a[1]).slice(0,2);
const add=(map,key)=>map.set(key,(map.get(key)??0)+1);
function stepLabel(report,id){return plain((report.steps??[]).find(row=>row.step===id)?.label??'단계 미확인');}
export function journeySummary(report){
 if(!Array.isArray(report.journeys)||report.journeyCount!==report.journeys.length)return {count:'확인불가',abandoned:'확인불가',received:'확인불가'};
 const receipts=new Set(),abandoned=new Map(),received=new Map();
 for(const row of report.journeys){
  const source=`${sourceLabel(row.source)} / ${plain(row.source?.term??'키워드 미수집')}`;
  if(row.state==='작성 중단 추정')add(abandoned,`${source} / ${stepLabel(report,row.lastStep)}`);
  for(const id of row.receipts??[])if(uuid.test(id)&&!receipts.has(id)){receipts.add(id);add(received,source);}
 }
 const unverified=!receipts.size&&report.summary?.formSuccesses!==0;
 return {count:unverified?'미확인':count(receipts.size)+'건',
  abandoned:top(abandoned).map(([key,n])=>`${key} ${n}방문`).join(' · ')||'없음',
  received:top(received).map(([key,n])=>`${key} ${n}건`).join(' · ')||(unverified?'미확인':'연결 기록 없음')};
}
