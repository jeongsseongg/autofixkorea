// Original appearance is retained; submissions remain disabled in this private preview.
document.addEventListener('submit', (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!event.target.checkValidity()) return;
  window.alert('미리보기입니다. 상담 정보는 전송되지 않습니다.');
}, true);

document.body.classList.add('new_fixed_header_disable', 'fixed-menu-on');
document.querySelectorAll('img[data-original]').forEach((image) => {
  image.src = image.dataset.original;
});

document.querySelectorAll('a[href]').forEach((link) => {
  if (link.getAttribute('href')?.startsWith('javascript:')) {
    link.addEventListener('click', (event) => event.preventDefault());
  }
});
