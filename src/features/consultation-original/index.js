export function mount() {
  var form=document.querySelector('.afh .afh-pf');
  var submitBtn=document.querySelector('.afh .afh-pbtn');
  var modal=document.getElementById('afh-modal5');
  var closeBtn=document.getElementById('afh-modal-close5');
  if(!form||!submitBtn||!modal||!closeBtn)return;
  function openModal(){modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');}
  function closeModal(){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');}
  closeBtn.addEventListener('click',closeModal);
  modal.addEventListener('click',function(e){if(e.target===modal)closeModal();});
  form.addEventListener('submit',async function(e){
    e.preventDefault();
    if(!form.reportValidity())return;
    submitBtn.disabled=true;submitBtn.textContent='접수 중입니다...';
    try{
      var res=await fetch(form.action,{method:'POST',body:new FormData(form),headers:{'Accept':'application/json'}});
      if(!res.ok)throw new Error('err');
      form.reset();openModal();
    }catch(err){
      window.alert('접수 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }finally{
      submitBtn.disabled=false;submitBtn.textContent='상담 신청하기';
    }
  });
}
