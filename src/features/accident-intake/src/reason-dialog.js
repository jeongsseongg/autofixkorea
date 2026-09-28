export function mountReasonDialog(){
 const dialog=document.querySelector('#reason-dialog'),opener=document.querySelector('[data-reason-open]');
 opener.addEventListener('click',()=>{dialog.showModal();document.documentElement.classList.add('reason-open');dialog.querySelector('.reason-body').scrollTop=0;});
 dialog.querySelector('[data-reason-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{document.documentElement.classList.remove('reason-open');opener.focus({preventScroll:true});});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
}
