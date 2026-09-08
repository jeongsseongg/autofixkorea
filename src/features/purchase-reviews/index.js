export function mount() {
var IMG='/review-images/';
var reviews=[
  {
    type:'사고차매입', cls:'buy', date:'2026.06.05', views:'조회 1,684',
    img:'review-02.jpg', car:'K8 하이브리드', title:'K8 하이브리드 후방 사고차 4,800,000원 매입',
    short:'폐차 이야기만 들었던 후방 사고 차량. 오토픽스코리아 제휴업체가 동일 보대 차량을 보유해 매입이 가능했습니다.',
    price:'4,800,000원',
    process:'K8 하이브리드는 후방 충격으로 트렁크 플로어와 리어 패널 손상이 큰 상태였습니다. 일반 업체는 폐차 기준으로만 안내했지만, 오토픽스코리아 제휴업체 중 동일 보대 차량을 확보한 업체가 있어 부품 활용과 복원 가능성을 함께 계산했습니다. 사진 접수, 후방 골격 확인, 제휴업체 매칭, 견인 일정 확정 순서로 진행했고 최종 4,800,000원에 사고차매입을 완료했습니다.'
  },
  {
    type:'미수선후매각', cls:'unsold', date:'2026.06.04', views:'조회 2,031',
    img:'review-16.jpg', car:'아이오닉5', title:'아이오닉5 미수선 후 사고차 판매 21,500,000원',
    short:'미수선 합의금과 차량 매각 금액을 합산하니 중고차 시세를 넘었습니다. 수리하지 않고 판매한 성공 사례입니다.',
    price:'21,500,000원',
    process:'아이오닉5는 사고 후 수리 진행 전 미수선 처리와 차량 매각을 동시에 검토했습니다. 전기차는 배터리, 하체, 고전압 계통 리스크 때문에 수리 후 판매해도 감가가 크게 남을 수 있습니다. 오토픽스코리아는 미수선 금액과 사고차 판매 금액을 분리 계산했고, 최종 차량 매각 21,500,000원으로 정리했습니다. 고객은 미수선 금액까지 합산해 중고차 시세를 넘는 결과를 얻었습니다.'
  },
  {
    type:'사고차수리', cls:'repair', date:'2026.06.03', views:'조회 1,242',
    img:'review-10.jpg', car:'쉐보레 스파크', title:'쉐보레 스파크 전면파손 수리비 600,000원',
    short:'센터 견적 200만원이 나온 전면파손 차량. 오토픽스코리아 수리 연결로 60만원에 해결했습니다.',
    price:'600,000원',
    process:'쉐보레 스파크는 전면 범퍼와 하부 부품 손상으로 센터 견적이 약 2,000,000원까지 나온 상황이었습니다. 차량가 대비 수리비가 과도해 폐차나 매각까지 고민했지만, 오토픽스코리아 협력 수리 루트를 통해 필요한 부품과 공임만 분리해 계산했습니다. 불필요한 교환을 줄이고 실사용 복구 기준으로 정리해 최종 수리비 600,000원으로 처리했습니다.'
  },
  {
    type:'사고차매입', cls:'buy', date:'2026.06.02', views:'조회 2,418',
    img:'tesla-model-y.jpg', car:'테슬라 모델 Y', title:'테슬라 모델 Y 음주사고 차량 28,000,000원 매입',
    short:'전면부와 휀더 파손이 있는 모델 Y. 100여 곳 바이어 네트워크와 사고차 수출 루트로 최고가를 안내했습니다.',
    price:'28,000,000원',
    process:'테슬라 모델 Y는 음주사고 이후 전면 범퍼, 휀더, 라이트 주변 손상이 확인된 차량입니다. 전기차 사고차는 국내 일반 매입만 보면 감가가 크게 잡히지만, 오토픽스코리아는 100여 곳의 바이어와 사고차 수출 루트를 동시에 비교했습니다. 국내 부품 활용 업체와 수출 바이어 견적을 경쟁시킨 뒤 가장 높은 조건을 선택했고 최종 28,000,000원에 사고차매입을 완료했습니다.'
  },
  {
    type:'사고차수리', cls:'repair', date:'2026.06.01', views:'조회 974',
    img:'review-25.jpg', car:'기아 레이', title:'기아 레이 사고차수리 800,000원 처리',
    short:'타 업체는 폐차를 권했던 경차 사고. 오토픽스코리아는 필요한 수리만 잡아 80만원으로 처리했습니다.',
    price:'800,000원',
    process:'기아 레이는 앞 모서리와 라이트 주변 파손이 있어 여러 업체에서 폐차를 권유받은 차량입니다. 하지만 차량 전체 상태와 파손 범위를 분리해 보니 폐차보다 수리가 유리했습니다. 오토픽스코리아는 중고 부품 활용 가능 여부와 최소 복구 범위를 확인했고, 불필요한 교환을 제외해 최종 사고차수리 비용 800,000원으로 정리했습니다.'
  },
  {
    type:'사고차매입', cls:'buy', date:'2026.05.31', views:'조회 1,517',
    img:'review-12.jpg', car:'아우디 A6', title:'아우디 A6 주행 가능 사고차 14,800,000원 판매',
    short:'주행은 가능했지만 전면 파손 이력이 있던 차량. 여러 업체 비교 후 최고가로 판매 완료했습니다.',
    price:'14,800,000원',
    process:'아우디 A6는 주행 가능 상태였지만 전면부 사고 이력 때문에 일반 중고차 매장에서는 감가가 크게 잡혔습니다. 고객은 여러 업체를 이미 알아본 상태였고, 오토픽스코리아는 수입차 사고차를 취급하는 매입처와 부품 활용 업체 견적을 추가 비교했습니다. 가장 높은 매입 조건을 제시한 업체로 연결해 최종 14,800,000원에 판매 완료했습니다.'
  }
];
var schema={
  '@context':'https://schema.org',
  '@type':'ItemList',
  name:'오토픽스코리아 사고차매입 실제 처리 후기',
  description:'사고차매입, 사고차수리, 미수선 후 매각 실제 처리 사례와 최종 금액',
  itemListElement:reviews.map(function(r,i){
    return {
      '@type':'ListItem',
      position:i+1,
      item:{
        '@type':'Article',
        headline:r.title,
        datePublished:r.date.replace(/\./g,'-'),
        image:IMG+r.img,
        keywords:r.type+', '+r.car+', 사고차매입, 사고차수리, 미수선 후 매각',
        about:r.type,
        description:r.short+' 최종 금액 '+r.price+'.',
        articleBody:r.process
      }
    };
  })
};
var schemaEl=document.createElement('script');
schemaEl.type='application/ld+json';
schemaEl.textContent=JSON.stringify(schema);
document.head.appendChild(schemaEl);
var grid=document.getElementById('afbrGrid');
var dim=document.getElementById('afbrDim');
var closeBtn=document.getElementById('afbrClose');
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function openModal(r){
  document.getElementById('afbrModalImg').style.backgroundImage="url('"+IMG+r.img+"')";
  document.getElementById('afbrModalType').textContent=r.type;
  document.getElementById('afbrModalViews').textContent=r.views;
  document.getElementById('afbrModalTitle').textContent=r.title;
  document.getElementById('afbrModalSub').textContent=r.short;
  document.getElementById('afbrModalCar').textContent=r.car;
  document.getElementById('afbrModalDate').textContent=r.date;
  document.getElementById('afbrModalPrice').textContent=r.price;
  document.getElementById('afbrModalProcess').textContent=r.process;
  dim.classList.add('on');
  dim.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}
function closeModal(){
  dim.classList.remove('on');
  dim.setAttribute('aria-hidden','true');
  document.body.style.overflow='';
}
reviews.forEach(function(r,i){
  var btn=document.createElement('button');
  btn.type='button';
  btn.className='afbr-card';
  btn.innerHTML=
    '<div class="afbr-img" style="background-image:url(\''+IMG+r.img+'\')">'+
      '<span class="afbr-chip '+r.cls+'">'+esc(r.type)+'</span>'+
      '<span class="afbr-views">'+esc(r.views)+'</span>'+
    '</div>'+
    '<div class="afbr-body">'+
      '<div class="afbr-date">'+esc(r.date)+'</div>'+
      '<h3>'+esc(r.title)+'</h3>'+
      '<p class="afbr-desc">'+esc(r.short)+'</p>'+
      '<div class="afbr-meta">'+
        '<div class="afbr-car">'+esc(r.car)+'</div>'+
        '<div class="afbr-price">'+esc(r.price)+'</div>'+
      '</div>'+
      '<span class="afbr-more">상세 처리 과정 보기 →</span>'+
    '</div>';
  btn.addEventListener('click',function(){openModal(reviews[i]);});
  grid.appendChild(btn);
});
closeBtn.addEventListener('click',closeModal);
dim.addEventListener('click',function(e){if(e.target===dim)closeModal();});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});
}
