export function createConsultationService({endpoint,enabled}, transport=fetch) {
  return {
    async submit(fields) {
      if (!enabled) throw new Error('미리보기에서는 상담 정보가 전송되지 않습니다.');
      const response=await transport(endpoint,{
        method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({...fields,_subject:'오토픽스코리아 상담 신청',_captcha:'false'}),
      });
      if (!response.ok) throw new Error('접수하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      const result=await response.json();
      if (result.success!==true && result.success!=='true') throw new Error('접수 결과를 확인하지 못했습니다.');
      return result;
    },
  };
}
