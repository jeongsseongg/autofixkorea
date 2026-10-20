const short=(value,max=100)=>Array.from(String(value??'미제공').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')).slice(0,max).join('');
export function channelSummary(row,files){
 const f=row.fields??{},phone=String(f.contact?.phone_number??'').replace(/[^0-9]/g,'');
 const digits=/^0\d{9,10}$/.test(phone)?phone:'';
 const date=new Date(row.created_at);
 const time=Number.isNaN(+date)?'일시 확인 필요':new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
 const text=[`[오토픽스코리아 · ${row.channel==='email'?'이메일':'텔레그램'} 접수]`,
  `접수번호 ${row.id} · ${time} 한국 시간`,
  `보낸 사람: ${short(f.name||f.from?.name||f.sender)}`,
  `연락처: ${digits||'미제공 · 상세 내용 확인'}`,
  `내용: ${short([f.subject,f.message].filter(Boolean).join(' · '),180)||'첨부 내용 확인'}`,
  `첨부 ${files.filter(file=>file.name!=='original.eml').length}개 · 원문과 파일은 접수함에 보관`,
  `유입: ${row.channel==='email'?'이메일':'텔레그램'} 수신 · 검색·광고 경로 미확인${f.attachmentStatus?' · 원본 첨부 확인 필요':''}`,
  '상세보기 (로그인 후 접수번호 검색): https://www.autofixkorea.com/hub/'].join('\n');
 return {text,...(digits?{reply_markup:{inline_keyboard:[[{text:'전화번호 복사',copy_text:{text:digits}}]]}}:{})};
}
