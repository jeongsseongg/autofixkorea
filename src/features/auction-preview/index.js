export function mount() {
var AUCTION_URL='https://autofix-chi.vercel.app/';
var vp=document.getElementById('ofaVP');
var track=document.getElementById('ofaTrack');
var px=0,paused=false,timer=null;
var lots=[
  {title:'제네시스 G80 사고차',year:'2022년',km:'42,000km',fuel:'가솔린',type:'전손차량',badge:'bc-red',sold:false,bids:8,image:'/assets/98f6a333b5b2f9e2'},
  {title:'벤츠 E300 보험처리차',year:'2021년',km:'58,000km',fuel:'가솔린',type:'미수선처리',badge:'bc-blue',sold:false,bids:5,image:'/assets/c69c8463b86f1040'},
  {title:'BMW 520d 침수이력',year:'2020년',km:'77,000km',fuel:'디젤',type:'침수차량',badge:'bc-orange',sold:true,bids:11,image:'/assets/e2ae9e3292e876a5'},
  {title:'아반떼 N 라인 사고차',year:'2023년',km:'18,000km',fuel:'가솔린',type:'상대방과실',badge:'bc-teal',sold:false,bids:4,image:'/assets/5afe0ce2d418e556'},
  {title:'카니발 리무진 수리차',year:'2022년',km:'39,000km',fuel:'디젤',type:'보험미가입',badge:'bc-navy',sold:false,bids:6,image:'/assets/e55e5772f3a1b349'},
  {title:'아이오닉 5 전기차 사고',year:'2023년',km:'24,000km',fuel:'전기',type:'전손차량',badge:'bc-red',sold:false,bids:9,image:'/assets/0998f05aaef60131'},
  {title:'쏘렌토 하이브리드 사고',year:'2021년',km:'63,000km',fuel:'하이브리드',type:'상대방과실',badge:'bc-blue',sold:true,bids:7,image:'/assets/f8e1073e7cf5b834'},
  {title:'K8 프리미엄 면책차량',year:'2022년',km:'31,000km',fuel:'가솔린',type:'음주면책',badge:'bc-orange',sold:false,bids:3,image:'/assets/e0855faa87d412b4'},
  {title:'GV70 수리필요 차량',year:'2023년',km:'26,000km',fuel:'디젤',type:'미수선처리',badge:'bc-teal',sold:false,bids:5,image:'/assets/b733e3a3e7f34e18'},
  {title:'모하비 더 마스터 사고',year:'2020년',km:'84,000km',fuel:'디젤',type:'무보험사고',badge:'bc-navy',sold:true,bids:10,image:'/assets/7178a2be162d149a'},
  {title:'레이 경차 수리차',year:'2021년',km:'29,000km',fuel:'가솔린',type:'상대방과실',badge:'bc-red',sold:false,bids:2,image:'/assets/7092129c6a67fdc5'},
  {title:'팰리세이드 대형SUV 사고',year:'2022년',km:'46,000km',fuel:'디젤',type:'전손차량',badge:'bc-blue',sold:false,bids:7,image:'/assets/d051687d49938a5c'},
  {title:'그랜저 IG 보험처리차',year:'2019년',km:'93,000km',fuel:'가솔린',type:'보험미가입',badge:'bc-orange',sold:true,bids:8,image:'/assets/e189e0b72926e904'},
  {title:'EV6 GT-Line 수리차',year:'2023년',km:'15,000km',fuel:'전기',type:'침수차량',badge:'bc-teal',sold:false,bids:4,image:'/assets/3bbc741283309516'},
  {title:'스포티지 하이브리드 사고',year:'2022년',km:'37,000km',fuel:'하이브리드',type:'상대방과실',badge:'bc-navy',sold:false,bids:6,image:'/assets/5c7481c29c88d41e'},
  {title:'SM6 중형세단 사고차',year:'2020년',km:'72,000km',fuel:'가솔린',type:'무보험사고',badge:'bc-red',sold:true,bids:5,image:'/assets/587e2aa3c2b39c87'},
  {title:'셀토스 컴팩트SUV 수리',year:'2021년',km:'41,000km',fuel:'가솔린',type:'미수선처리',badge:'bc-blue',sold:false,bids:3,image:'/assets/f9a46648f67aeb84'},
  {title:'K5 2.0 프레스티지 사고',year:'2022년',km:'34,000km',fuel:'가솔린',type:'상대방과실',badge:'bc-orange',sold:false,bids:4,image:'/assets/f6296072195a0ba5'},
  {title:'투싼 디젤 보험처리차',year:'2021년',km:'68,000km',fuel:'디젤',type:'전손차량',badge:'bc-teal',sold:false,bids:6,image:'/assets/0a480ce525fbdee0'}
];

function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function cardStep(){var c=track.querySelector('.ofa-card');return c?c.offsetHeight+8:104}
function move(v,anim){px=v;track.style.transition=anim?'transform .72s cubic-bezier(.4,0,.2,1)':'none';track.style.transform='translateY(-'+v+'px)'}
function step(){if(!lots.length)return;var cs=cardStep(),next=px+cs;if(next>=cs*lots.length*2){move(cs*lots.length,false);setTimeout(function(){move(cs*lots.length+cs,true)},20)}else move(next,true)}
function start(){if(lots.length<=1)return;clearInterval(timer);timer=setInterval(function(){if(!paused)step()},2400)}
function card(lot){
  var soldOverlay=lot.sold?'<div class="ofa-sold-overlay"><div class="ofa-sold-stamp">SOLD</div></div>':'';
  var priceSection=lot.sold
    ?'<div class="ofa-sold-txt">매각 완료</div>'
    :'<div class="ofa-price-box"><div class="ofa-price-val">비공개</div><div class="ofa-price-mask"><span class="ofa-mask-icon">🔒</span><span class="ofa-mask-txt">열람 제한</span></div></div><div class="ofa-bids">입찰 <b>'+lot.bids+'</b>회</div><span class="ofa-cta">상세 보기</span>';
  return '<a class="ofa-card'+(lot.sold?' sold':'')+' locked" href="'+AUCTION_URL+'">'+
    soldOverlay+
    '<div class="ofa-lock-layer"><div class="ofa-lock-chip">PRIVATE LOT</div><div class="ofa-lock-copy">게시글 전체 모자이크 처리<br>경매 페이지에서만 확인 가능</div></div>'+
    '<div class="ofa-thumb ofa-blur">'+
      '<img src="'+esc(lot.image)+'" alt="'+esc(lot.title)+'">'+
      '<div class="ofa-badge '+(lot.sold?'bc-gray':lot.badge)+'">'+esc(lot.sold?'매각완료':lot.type)+'</div>'+
    '</div>'+
    '<div class="ofa-info ofa-blur">'+
      '<div class="ofa-car-title">'+esc(lot.title)+'</div>'+
      '<div class="ofa-specs">'+esc([lot.year,lot.km,lot.fuel].join(' · '))+'</div>'+
      '<div class="ofa-desc">실제 사고 내용 및 차량 상태는 경매 페이지에서만 확인 가능합니다.</div>'+
    '</div>'+
    '<div class="ofa-right ofa-blur">'+
      '<div class="ofa-price-lbl">현재 입찰가</div>'+
      priceSection+
    '</div>'+
  '</a>';
}
function render(){track.innerHTML='';for(var r=0;r<3;r++){lots.forEach(function(lot){track.insertAdjacentHTML('beforeend',card(lot))})}requestAnimationFrame(function(){requestAnimationFrame(function(){move(cardStep()*lots.length,false);start()})})}
vp.addEventListener('mouseenter',function(){paused=true});
vp.addEventListener('mouseleave',function(){paused=false});
render();
}
