const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function acquisition(input) {
  // Attribution is optional: blocked analytics must never block a real enquiry.
  if(!input || typeof input !== 'object') return null;
  const s = input.source;
  if(!uuid.test(input.visit) || !uuid.test(input.view) || !['mobile','desktop','tablet'].includes(input.device) ||
    !['live','test'].includes(input.mode) || !s || !['google','naver','meta','kakao','youtube','blog','referral','unknown'].includes(s.channel) ||
    !['paid','search','social','referral','unknown'].includes(s.medium) || !['tagged','referrer','unknown'].includes(s.confidence) ||
    typeof s.tagged !== 'boolean' || s.tagged !== (s.confidence === 'tagged')) return null;
  const code = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{0,80}$/.test(value) && !/(?:\d[ _-]*){8,}/.test(value) ? value : '';
  const term = typeof s.term === 'string' && s.term.length <= 60 && /^[\p{L}\p{N} _-]+$/u.test(s.term) &&
    !/(?:\d[ _-]*){8,}/.test(s.term) ? s.term : '';
  const source = {channel:s.channel,medium:s.medium,confidence:s.confidence,tagged:s.tagged,
    campaign:s.tagged ? code(s.campaign) : '',content:s.tagged ? code(s.content) : '',...(s.tagged && term ? {term} : {})};
  if(new TextEncoder().encode(JSON.stringify(source)).length>480)return null;
  return {visit:input.visit,view:input.view,device:input.device,mode:input.mode,source};
}
export function acquisitionLines(value) {
  const ctx = acquisition(value);
  if(!ctx) return ['유입 경로: 미확인 (출처 정보 없음 또는 수집 차단)'];
  const s=ctx.source, labels={naver:'네이버',google:'구글',meta:'인스타그램·페이스북',kakao:'카카오',youtube:'유튜브',blog:'블로그',referral:'외부 사이트',unknown:'출처 미확인'};
  const medium={paid:'광고',search:'검색 (광고 여부 미확인)',social:'소셜',referral:'외부 링크',unknown:'구분 정보 없음'};
  return [`유입 경로: ${labels[s.channel]} · ${medium[s.medium]}`,
    `확인 근거: ${s.confidence==='tagged'?'링크 구분 정보':s.confidence==='referrer'?'브라우저 출처':'미확인'}`,
    `접속 기기: ${ctx.device==='mobile'?'모바일':ctx.device==='desktop'?'PC':'태블릿'}`,
    ...(s.campaign ? ['캠페인: '+s.campaign] : []), ...(s.term ? ['광고 키워드: '+s.term] : []),
    '익명 방문번호: '+ctx.visit];
}
