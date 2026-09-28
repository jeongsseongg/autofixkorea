import {loadBlog} from '../../services/blog/index.js';
export function mount() {

  var grid=document.getElementById('blgGrid');
  var moreWrap=document.getElementById('blgMoreWrap');
  var moreBtn=document.getElementById('blgMoreBtn');
  var allItems=[], shown=6;

  /* ── 유틸 ── */
  function fmtDate(s){
    try{var d=new Date(s);if(isNaN(d))return s||'';
      return d.getFullYear()+'.'
        +String(d.getMonth()+1).padStart(2,'0')+'.'
        +String(d.getDate()).padStart(2,'0');
    }catch(e){return s||'';}
  }
  function stripHtml(h){return h?(h.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()):''}
  function findImg(html){
    if(!html)return'';
    /* og:image 또는 src 추출 */
    var patterns=[
      /src=["']([^"']+(?:jpg|jpeg|png|webp|gif)[^"']*)/i,
      /src=["']([^"']{20,})/i
    ];
    for(var i=0;i<patterns.length;i++){
      var m=html.match(patterns[i]);
      if(m&&m[1]&&!m[1].includes('data:'))return m[1];
    }
    return'';
  }
  function proxyUrl(url){
    if(!url)return'';
    return url.startsWith('/') ? url : '';
  }
  function bestImg(item){
    /* 우선순위: item.image > banner_image > content에서 추출 */
    var raw=item.image||item.banner_image
      ||findImg(item.content_html||'')
      ||findImg(item.summary||'')
      ||'';
    return raw?proxyUrl(raw):'';
  }

  /* ── 카드 생성 ── */
  function makeCard(item){
    var url=item.url||item.link||'#';
    var title=item.title||'제목 없음';
    var date=fmtDate(item.date_published||item.pubDate||'');
    var excerpt=stripHtml(item.content_html||item.summary||'').slice(0,110);
    if(excerpt.length===110)excerpt+='…';
    var imgSrc=bestImg(item);

    var a=document.createElement('a');
    a.className='blg-card';a.href=url;a.target='_blank';a.rel='noopener';

    /* 썸네일 HTML */
    var thumbInner='<div class="blg-badge">매입완료</div>';
    if(imgSrc){
      thumbInner='<img src="'+imgSrc+'" alt="'+title.replace(/"/g,'')+'" loading="lazy"'
        +' onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">'
        +'<div class="blg-ph" style="display:none">'
          +'<span class="blg-ph-icon">🚗</span>'
          +'<span class="blg-ph-txt">오토픽스코리아</span>'
        +'</div>'
        +'<div class="blg-badge">매입완료</div>';
    } else {
      thumbInner='<div class="blg-ph">'
        +'<span class="blg-ph-icon">🚗</span>'
        +'<span class="blg-ph-txt">오토픽스코리아</span>'
        +'</div>'
        +'<div class="blg-badge">매입완료</div>';
    }

    a.innerHTML=
      '<div class="blg-thumb">'+thumbInner+'</div>'+
      '<div class="blg-body">'+
        '<div class="blg-meta">'+
          '<span>오토픽스코리아</span>'+
          '<span class="dot"></span>'+
          '<span>'+date+'</span>'+
        '</div>'+
        '<div class="blg-post-title">'+title+'</div>'+
        (excerpt?'<div class="blg-excerpt">'+excerpt+'</div>':'')+
      '</div>'+
      '<div class="blg-foot">'+
        '<span class="blg-link">자세히 보기 <span class="arr">→</span></span>'+
        '<span class="blg-src">네이버 블로그</span>'+
      '</div>';
    return a;
  }

  /* ── 렌더링 ── */
  function render(from,to){
    var frag=document.createDocumentFragment();
    allItems.slice(from,to).forEach(function(it){frag.appendChild(makeCard(it));});
    if(from===0)grid.innerHTML='';
    grid.appendChild(frag);
    moreWrap.style.display=to<allItems.length?'block':'none';
  }
  moreBtn.addEventListener('click',function(){render(shown,shown+6);shown+=6;});

  /* ── Fetch ── */
  function parseItems(data){
    if(data.items&&data.items.length)return data.items;
    if(Array.isArray(data)&&data.length)return data;
    /* rss2json 형식 */
    if(data.items&&!data.items.length&&data.feed)return[];
    return[];
  }
  function showFallback(){
    grid.textContent='블로그 후기를 불러오지 못했습니다.';
  }

  loadBlog()
    .then(function(data){
      var items=parseItems(data);
      if(!items.length)throw new Error('empty');
      allItems=items;
      render(0,shown);
    })
    .catch(showFallback);
}
