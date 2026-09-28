import assert from 'node:assert/strict';
import {normalizeSubmission,telegramText} from '../supabase/functions/autofix-consultation/validation.mjs';
import {createConsultationService} from '../src/services/consultation/index.js';
const input={requestId:crypto.randomUUID(),formType:'hero',page:'/',fields:{차량명:'검증 차량',연락처:'010-0000-0000',지역:'검증 지역',개인정보동의:'on'}};
assert.equal(normalizeSubmission(input).fields.연락처,'01000000000');
for(const formType of ['hero','quick','consultation','promotors']) {
 const fields={...input.fields,문의유형:'사고차판매',사고유형:'단순 사고',지점:'안산점',차량브랜드:'BMW',모델연식:'검증',정비유형:'검증',고객명:'[TEST]'};
 assert.equal(normalizeSubmission({...input,formType,fields}).formType,formType);
}
for(const fields of [{...input.fields,개인정보동의:''},{...input.fields,연락처:'hello'},{...input.fields,지역:''},{...input.fields,특이사항:'x'.repeat(1201)}]) {
 assert.throws(()=>normalizeSubmission({...input,fields}));
}
assert.throws(()=>normalizeSubmission({...input,page:'https://unexpected.invalid'}));
assert.throws(()=>normalizeSubmission({...input,requestId:'not-a-uuid'}));
const text=telegramText({id:input.requestId,form_type:'hero',page:'/',fields:input.fields,created_at:'test'});
assert.ok(text.includes('오토픽스코리아') && text.includes('검증 차량'));
let sent;
await createConsultationService({enabled:true,endpoint:'https://example.invalid',publicKey:'public-test-key'},async(url,options)=>{
 sent=options;
 return {ok:true,json:async()=>({success:true,receiptId:input.requestId})};
}).submit(input);
assert.deepEqual(JSON.parse(sent.body),input);
assert.equal(sent.headers.Authorization,'Bearer public-test-key');
await assert.rejects(createConsultationService({enabled:true,endpoint:'https://example.invalid'},async()=>({ok:false,status:429})).submit(input),/잠시/);
console.log('PASS: 4 form contracts; invalid contact, consent, size, path and ID rejection; Telegram payload; authorized transport; rate-limit failure. No messages sent.');
