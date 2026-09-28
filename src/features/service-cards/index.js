export function mount() {
  var cards = document.querySelectorAll('.af-card');

  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){
          var el = e.target;
          var delay = parseInt(el.getAttribute('data-delay')) || 0;
          setTimeout(function(){ el.classList.add('visible'); }, delay);
          io.unobserve(el);
        }
      });
    },{threshold:0.15});
    cards.forEach(function(c){ io.observe(c); });
  } else {
    cards.forEach(function(c,i){
      setTimeout(function(){ c.classList.add('visible'); }, i*120);
    });
  }
}
