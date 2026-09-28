export function mount() {

  /* ===== pro 페이지 숨김 ===== */
  var hiddenSlugs = ['pro'];
  var currentSlug = window.location.pathname.split('/').filter(Boolean).pop() || '';
  if(hiddenSlugs.indexOf(currentSlug) !== -1){
    var root = document.getElementById('afh-footer-root');
    if(root) root.style.display = 'none';
    return;
  }

  var ce = document.getElementById('afh-cnt');
  var ve = document.getElementById('afh-vc');

  /* ===== 오늘 문의 카운터 ===== */
  if(ce){
    function getDailyTarget(){
      var d = new Date();
      var seed = d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
      return Math.round(((seed * 2654435761) >>> 0) % 39);
    }
    function getSecondsNow(){
      var n = new Date();
      return n.getHours()*3600 + n.getMinutes()*60 + n.getSeconds();
    }
    var target = getDailyTarget();
    var secNow = getSecondsNow();
    var current = Math.round(target * secNow / 86400);
    var shown = 0;
    var ms = Math.max(1500 / Math.max(current, 1), 15);
    var ti = setInterval(function(){
      shown = Math.min(shown + 1, current);
      ce.textContent = shown;
      if(shown >= current){ clearInterval(ti); startSlow(); }
    }, ms);
    function startSlow(){
      var secsLeft = 86400 - secNow;
      var rem = target - current;
      if(rem <= 0 || secsLeft <= 0) return;
      var mps = (secsLeft * 1000) / rem;
      (function tick(){
        setTimeout(function(){
          shown = Math.min(shown + 1, target);
          ce.textContent = shown;
          if(shown < target) tick();
        }, mps * (0.5 + Math.random() * 1.0));
      })();
    }
  }

  /* ===== 실시간 시청자 수 ===== */
  if(ve){

    function clamp(v, mn, mx){ return Math.max(mn, Math.min(mx, v)); }

    function addViewerPop(el){
      el.classList.remove('afh-vpop');
      void el.offsetWidth;
      el.classList.add('afh-vpop');
    }

    function animateInteger(el, from, to, duration, done){
      if(from === to){ el.textContent = String(to); if(done) done(); return; }
      var start = null;
      function step(ts){
        if(!start) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        el.textContent = String(Math.round(from + (to - from) * p));
        if(p < 1){ requestAnimationFrame(step); } else if(done){ done(); }
      }
      requestAnimationFrame(step);
    }

    /*
     * zone 설명
     *  'vlow'  : 범위 하위 30% 에서만 움직임 (새벽 저조)
     *  'low'   : 범위 하위 45% 중심 (야간 저조)
     *  'mid'   : 범위 20~70% 사이에서 주로 머무름, 최대치 거의 미도달
     *  'full'  : 범위 전체 랜덤, 최대치 가끔 도달
     */
    function getSlot(now){
      var h = now.getHours();
      if(h >= 0  && h < 2)  return { min:27,  max:76,  zone:'vlow' }; // 0~2시  저조
      if(h >= 2  && h < 5)  return { min:9,   max:37,  zone:'vlow' }; // 2~5시  저조
      if(h >= 5  && h < 8)  return { min:9,   max:37,  zone:'mid'  }; // 5~8시  활발
      if(h >= 8  && h < 12) return { min:28,  max:68,  zone:'mid'  }; // 8~12시 중간
      if(h >= 12 && h < 16) return { min:77,  max:145, zone:'full' }; // 12~16시 랜덤
      if(h >= 16 && h < 22) return { min:88,  max:187, zone:'mid'  }; // 16~22시 중간(최대치 적게)
      return                        { min:27,  max:76,  zone:'low'  }; // 22~24시 랜덤
    }

    function pickInSlot(slot){
      var span = slot.max - slot.min;
      var ratio;
      var r = Math.random();

      if(slot.zone === 'vlow'){
        // 하위 30% 안에서만, 매우 강한 저조 바이어스
        ratio = Math.pow(Math.random(), 2.2) * 0.30;

      } else if(slot.zone === 'low'){
        // 하위 45% 중심, 가끔 중간까지
        if(r < 0.10){
          ratio = 0.35 + Math.random() * 0.20; // 10% 확률로 중간까지
        } else {
          ratio = Math.pow(Math.random(), 1.8) * 0.38;
        }

      } else if(slot.zone === 'mid'){
        // 20~68% 구간에서 주로 머무름
        // 최대치(상위 15%) 도달 확률 5% 미만
        if(r < 0.04){
          ratio = 0.78 + Math.random() * 0.12; // 드물게 상단
        } else if(r < 0.15){
          ratio = 0.10 + Math.random() * 0.12; // 가끔 하단
        } else {
          ratio = 0.20 + Math.random() * 0.48; // 대부분 중간
        }

      } else {
        // full: 전체 랜덤, 최대치 상위 10% 도달 확률 8%
        if(r < 0.08){
          ratio = 0.82 + Math.random() * 0.14;
        } else {
          ratio = Math.pow(Math.random(), 1.2) * 0.82;
        }
      }

      return clamp(Math.round(slot.min + span * ratio), slot.min, slot.max);
    }

    function getViewerTarget(now){
      return pickInSlot(getSlot(now));
    }

    function getViewerTargetFromCurrent(now, current){
      var slot = getSlot(now);
      // 이전 값에서 ±18 이내로 이동폭 제한 → 자연스러운 흐름
      var lower = Math.max(slot.min, current - 18);
      var upper = Math.min(slot.max, current + 18);
      var tries = 0;
      var t;
      do {
        t = clamp(pickInSlot(slot), lower, upper);
        tries++;
      } while(t === current && tries < 8);
      if(t === current){
        if(current < upper) return current + 1;
        if(current > lower) return current - 1;
      }
      return t;
    }

    function updateViewerCount(){
      var now = new Date();
      var current = parseInt(ve.textContent, 10);
      if(isNaN(current)){ ve.textContent = String(getViewerTarget(now)); return; }
      var t = getViewerTargetFromCurrent(now, current);
      if(!updateViewerCount.hasAnimatedOnce){
        animateInteger(ve, current, t, 560, function(){
          addViewerPop(ve);
          updateViewerCount.hasAnimatedOnce = true;
        });
        return;
      }
      ve.textContent = String(t);
    }

    ve.textContent = String(getViewerTarget(new Date()));
    setInterval(updateViewerCount, 5000);
  }

}
