export function mount() {
  const options=[...document.querySelectorAll('.branch-opt')];
  const tabs=[...document.querySelectorAll('.branch-tab')];
  const branches=['안산점','새솔점','부천점'];
  function select(name) {
    const selected=document.querySelector('#promotorsForm [name=지점]');
    if(selected)selected.value=name;
    options.forEach((item,index)=>item.classList.toggle('selected',branches[index]===name));
    tabs.forEach(item=>item.classList.toggle('active',item.textContent.trim()===name));
  }
  options.forEach((item,index)=>item.addEventListener('click',()=>select(branches[index])));
  tabs.forEach(item=>item.addEventListener('click',()=>select(item.textContent.trim())));
  document.querySelectorAll('.faq-item button').forEach(button=>button.addEventListener('click',()=>{
    const item=button.closest('.faq-item');
    const opened=item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(element=>element.classList.remove('open'));
    item.classList.toggle('open',!opened);
  }));
  const panel=document.querySelector('#panel');
  const bar=document.querySelector('#bottomBar');
  if (panel && bar) panel.addEventListener('scroll',()=>bar.classList.toggle('visible',panel.scrollTop>250));
  document.querySelectorAll('.bb-btn').forEach(button=>button.addEventListener('click',()=>{
    document.querySelector('#promotorsForm')?.requestSubmit();
  }));
  document.querySelectorAll('.cta-secondary,.bb-tel,.phone-btn').forEach(button=>button.addEventListener('click',()=>{
    window.location.assign('tel:0318319738');
  }));
}
