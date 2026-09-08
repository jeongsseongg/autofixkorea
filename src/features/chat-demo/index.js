export function mount() {
  var HERO  = document.getElementById('cbs-hero');
  var RT    = document.getElementById('cbs-rt');
  var TW    = document.getElementById('cbs-tw');
  var DESC  = document.getElementById('cbs-desc');
  var PHONE = document.getElementById('cbs-phone');
  var RC    = document.getElementById('cbs-rc');
  var BTNS  = document.getElementById('cbs-btns');
  var MSGS  = document.getElementById('cbs-msgs');
  var ROWS  = document.querySelectorAll('.cbs-row');
  var STEPS = document.querySelectorAll('.cbs-step');
  var started = false;

  function twType(el,lines,speed,done){
    var li=0,ci=0;el.innerHTML='';
    var cur=document.createElement('span');cur.className='cbs-twcur';el.appendChild(cur);
    var iv=setInterval(function(){
      if(li>=lines.length){clearInterval(iv);cur.remove();if(done)done();return;}
      el.insertBefore(document.createTextNode(lines[li][ci]),cur);ci++;
      if(ci>=lines[li].length){li++;ci=0;if(li<lines.length)el.insertBefore(document.createElement('br'),cur);}
    },speed||65);
  }

  function bbType(el,text,done){
    var i=0,cur=document.createElement('span');cur.className='cbs-tc';el.innerHTML='';el.appendChild(cur);
    var iv=setInterval(function(){
      if(i>=text.length){clearInterval(iv);cur.className='cbs-tc cbs-done';if(done)done();return;}
      el.insertBefore(document.createTextNode(text[i]),cur);i++;
    },22);
  }

  function play(){
    if(started)return;started=true;
    twType(TW,['사고차 판매,','이렇게 쉬운 거였나요?'],65,function(){
      DESC.classList.add('cbs-show');
      setTimeout(function(){
        HERO.classList.add('cbs-hide');
        PHONE.classList.add('cbs-exp');
        setTimeout(function(){
          var lastD=0;
          ROWS.forEach(function(row){
            var d=parseInt(row.getAttribute('data-d'))||0;
            if(d>lastD)lastD=d;
            var bb=row.querySelector('.cbs-bb');
            var t=bb?bb.getAttribute('data-t'):'';
            setTimeout(function(){
              row.classList.add('cbs-vis');
              if(bb&&t)bbType(bb,t);
              MSGS.scrollTop=MSGS.scrollHeight;
            },d);
          });
          setTimeout(function(){
            PHONE.classList.remove('cbs-exp');
            PHONE.classList.add('cbs-moved');
            setTimeout(function(){RT.classList.add('cbs-show');},400);
            RC.style.display='block';
            requestAnimationFrame(function(){requestAnimationFrame(function(){RC.classList.add('cbs-show');});});
            STEPS.forEach(function(s,i){setTimeout(function(){s.classList.add('cbs-show');},600+i*700);});
            setTimeout(function(){BTNS.classList.add('cbs-show');},600+(STEPS.length-1)*700+700);
          },lastD+900);
        },600);
      },1100);
    });
  }

  if('IntersectionObserver' in window){
    new IntersectionObserver(function(e,o){if(e[0].isIntersecting){play();o.disconnect();}},{threshold:0.2}).observe(document.getElementById('cbs'));
  } else {setTimeout(play,300);}
}
