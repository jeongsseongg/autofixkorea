export function createConsultationService({endpoint,enabled,publicKey}, transport=fetch) {
  return {
    async submit(fields) {
      if (!enabled) throw new Error('미리보기에서는 상담 정보가 전송되지 않습니다.');
      const response=await transport(endpoint,{
        method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json',
          ...(publicKey?{apikey:publicKey,Authorization:`Bearer ${publicKey}`}:{})},
        body:JSON.stringify(fields),signal:AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(response.status===429?'신청이 잠시 많습니다. 잠시 후 다시 시도해 주세요.':'접수 결과를 확인하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.');
      const result=await response.json();
      if (result.success!==true && result.success!=='true') throw new Error('접수 결과를 확인하지 못했습니다.');
      return result;
    },
  };
}
