export function mount(){
 document.addEventListener('click',event=>{
  const target=event.target.closest('a,button');
  if(!target||target.hasAttribute('data-contact-direct'))return;
  const href=target.getAttribute('href')||'';
  if(!target.hasAttribute('data-contact-open')&&!target.matches('[data-afx-modal="contactModal"],.cta-secondary,.bb-tel,.phone-btn')&&!['/download','/download/'].includes(href))return;
  event.preventDefault();event.stopImmediatePropagation();location.assign('/consultation/');
 },true);
}
