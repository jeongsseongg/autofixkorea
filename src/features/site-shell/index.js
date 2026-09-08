export function mount() {
  document.body.classList.add('new_fixed_header_disable','fixed-menu-on');
  for (const image of document.querySelectorAll('img[data-original]')) {
    image.src=image.dataset.original;
  }
}
