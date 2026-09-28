export function mountDialogs(root) {
  let trigger;
  const close=dialog=>{dialog.close(); trigger?.focus();};
  root.querySelectorAll('[data-dialog]').forEach(button=>button.addEventListener('click',()=>{
    const dialog=root.getElementById(button.dataset.dialog);
    if(!dialog) return;
    trigger=button;
    dialog.showModal();
  }));
  root.querySelectorAll('dialog').forEach(dialog=>{
    dialog.querySelector('[data-close]')?.addEventListener('click',()=>close(dialog));
    dialog.addEventListener('click',event=>{if(event.target===dialog)close(dialog);});
  });
  const mode=new URL(location.href).searchParams.get('mode');
  if(mode==='privacy') root.getElementById('privacyModal')?.showModal();
  if(mode==='policy') root.getElementById('termsModal')?.showModal();
}
