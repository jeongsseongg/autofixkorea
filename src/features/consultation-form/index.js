export function mount() {
 const selectors='.afh-pf,#afxReserveForm,.afh-fbar,#promotorsForm';
 document.addEventListener('submit',event=>{
  const form=event.target;if(!form.matches(selectors))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!form.reportValidity())return;
  const fields=Object.fromEntries(new FormData(form));
  try{sessionStorage.setItem('autofix-consultation-prefill',JSON.stringify({group:fields['차량명']||'',contact:fields['연락처']||'',region:fields['지역']||''}));}catch{}
  location.assign('/consultation/');
 },true);
}
