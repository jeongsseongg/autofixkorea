export function mount() {
    var targets = document.querySelectorAll('.af-reveal');

    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) {
        el.classList.add('af-visible');
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('af-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.18
    });

    targets.forEach(function (el) {
      observer.observe(el);
    });
  }
