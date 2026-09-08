export function mount({service}) {
  const selectors='.afh-pf,#afxReserveForm,.afh-fbar,#promotorsForm';
  const pending=new WeakSet();
  const ids=new WeakMap();
  document.addEventListener('submit',async (event)=>{
    const form=event.target;
    if (!form.matches(selectors)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(pending.has(form))return;
    if (!form.reportValidity()) return;
    pending.add(form);
    const button=form.querySelector('[type=submit],button');
    const label=button?.textContent;
    if (button) {button.disabled=true;button.textContent='접수 중입니다...';}
    try {
      const fields=Object.fromEntries(new FormData(form));
      const fingerprint=JSON.stringify(fields);
      const previous=ids.get(form);
      const requestId=previous?.fingerprint===fingerprint?previous.id:crypto.randomUUID();
      ids.set(form,{fingerprint,id:requestId});
      const formType=form.id==='promotorsForm'?'promotors':form.id==='afxReserveForm'?'consultation':form.matches('.afh-pf')?'hero':'quick';
      const result=await service.submit({requestId,formType,page:location.pathname,fields});
      form.reset();
      ids.delete(form);
      window.alert(`상담 신청이 접수되었습니다. 확인 후 연락드리겠습니다.\n접수번호: ${result.receiptId || requestId}`);
    } catch (error) {
      window.alert(error.message);
    } finally {
      pending.delete(form);
      if (button) {button.disabled=false;button.textContent=label;}
    }
  },true);
}
