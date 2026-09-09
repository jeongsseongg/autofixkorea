export function mount() {
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',mount,{once:true});
    return;
  }
  const dialog=document.querySelector('#autofixContact');
  if(!dialog)return;
  let trigger;
  const open=element=>{
    trigger=element;
    if(!dialog.open)dialog.showModal();
    document.body.classList.add('af-contact-open');
  };
  document.addEventListener('click',event=>{
    const target=event.target.closest('a,button');
    if(!target || target.hasAttribute('data-contact-direct'))return;
    const href=target.getAttribute('href') || '';
    const contact=target.hasAttribute('data-contact-open') || target.matches('[data-afx-modal="contactModal"],.cta-secondary,.bb-tel,.phone-btn') || href==='/download' || href==='/download/';
    if(!contact)return;
    event.preventDefault();event.stopImmediatePropagation();open(target);
  },true);
  dialog.querySelector('[data-contact-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{document.body.classList.remove('af-contact-open');trigger?.focus();});
}
