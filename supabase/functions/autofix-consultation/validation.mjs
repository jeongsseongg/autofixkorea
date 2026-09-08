const allowed = ['차량명','사고유형','연락처','지역','문의유형','희망금액','특이사항','지점','차량브랜드','모델연식','정비유형','예약희망일','고객명','요청사항'];
export function normalizeSubmission(body) {
  if (!body || typeof body !== 'object') throw new Error('INVALID_BODY');
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.requestId || '')) throw new Error('INVALID_REQUEST_ID');
  if (!['hero','quick','consultation','promotors'].includes(body.formType)) throw new Error('INVALID_FORM');
  const raw=body.fields;
  if (!raw || typeof raw!=='object') throw new Error('INVALID_FIELDS');
  if (!['on','동의',true].includes(raw.개인정보동의 || raw.개인정보수집동의)) throw new Error('CONSENT_REQUIRED');
  const fields={};
  for (const key of allowed) {
    if(raw[key]===undefined)continue;
    if(typeof raw[key]!=='string' || raw[key].length>1200)throw new Error('INVALID_FIELD');
    fields[key]=raw[key].trim().replace(/[\u0000-\u0008\u000b-\u001f]/g,'');
  }
  const phone=(fields.연락처 || '').replace(/[\s()-]/g,'');
  if(!/^0\d{8,10}$/.test(phone))throw new Error('INVALID_PHONE');
  fields.연락처=phone;
  if(body.formType==='promotors') {
    for(const key of ['고객명','차량브랜드','모델연식','정비유형','지점'])if(!fields[key])throw new Error('REQUIRED_FIELD');
  } else if(!fields.지역) throw new Error('REQUIRED_FIELD');
  if(body.formType==='consultation') {
    for(const key of ['차량명','문의유형','사고유형'])if(!fields[key])throw new Error('REQUIRED_FIELD');
  }
  const page=String(body.page || '').split('?')[0];
  if(!/^\/(?:Home|news|review|download|pro|19|21|car)?\/?$/.test(page))throw new Error('INVALID_PAGE');
  return {requestId:body.requestId,formType:body.formType,page,fields,consentVersion:'2026-09-08'};
}

export function telegramText(record) {
  return ['[오토픽스코리아 상담 접수]',`접수번호: ${record.id}`,`폼: ${record.form_type}`,`페이지: ${record.page}`,
    ...Object.entries(record.fields).map(([key,value])=>`${key}: ${value}`),
    `접수시각: ${record.created_at}`, '개인정보 수집·이용: 동의'].join('\n').slice(0,4000);
}
