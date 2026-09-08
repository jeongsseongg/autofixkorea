export function mountConsultation(root) {
  root.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const status=form.querySelector('[role="status"]');
      status.textContent='미리보기에서는 상담이 전송되지 않습니다. 실제 상담은 전화 또는 카카오톡을 이용해 주세요.';
      status.focus();
    });
  });
}
