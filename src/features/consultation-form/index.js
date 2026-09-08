export function mount({service}) {
  const selectors='.afh-pf,#afxReserveForm,.afh-fbar';
  document.addEventListener('submit',async (event)=>{
    const form=event.target;
    if (!form.matches(selectors)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!form.reportValidity()) return;
    const button=form.querySelector('[type=submit],button');
    const label=button?.textContent;
    if (button) {button.disabled=true;button.textContent='접수 중입니다...';}
    try {
      await service.submit(Object.fromEntries(new FormData(form)));
      form.reset();
      window.alert('상담 신청이 접수되었습니다.');
    } catch (error) {
      window.alert(error.message);
    } finally {
      if (button) {button.disabled=false;button.textContent=label;}
    }
  },true);
}
