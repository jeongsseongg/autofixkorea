import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptTarget,enterReceiptWorkspace,watchReceiptNavigation} from '../src/features/operator-hub/receipt-route.js';
const target={source:'accident',id:'11111111-1111-4111-8111-111111111111'};
const url='https://www.autofixkorea.com/hub/#'+new URLSearchParams(target);
test('receipt link survives unauthenticated login without any receipt or list query',async()=>{
 let session=false;const calls=[];
 const ports={location:url,gateway:{hasSession:()=>session,request:async action=>{calls.push(action);return {role:'admin'};}},login:()=>calls.push('login'),authorized:()=>calls.push('authorized'),openDetail:async key=>{assert.deepEqual(key,target);calls.push('detail');},refresh:async()=>calls.push('list')};
 await enterReceiptWorkspace(ports);assert.deepEqual(calls,['login']);session=true;calls.length=0;
 await enterReceiptWorkspace(ports);assert.deepEqual(calls,['me','authorized','detail']);assert.deepEqual(receiptTarget(url),target);
});
test('staff, malformed and duplicate receipt links cannot read a receipt',async()=>{
 const calls=[];await assert.rejects(enterReceiptWorkspace({location:url,gateway:{hasSession:()=>true,request:async()=>({role:'dealer'})},login:()=>calls.push('login'),authorized:()=>calls.push('authorized'),openDetail:()=>calls.push('detail'),refresh:()=>calls.push('list')}),/관리자/);assert.deepEqual(calls,['login']);
 for(const link of ['#source=other&id='+target.id,'#source=accident&id=oops','#source=accident&id='+target.id+'&id='+target.id])assert.throws(()=>receiptTarget('https://www.autofixkorea.com/hub/'+link),/접수 링크/);
});
test('normal authorized hub still opens the existing list',async()=>{
 const calls=[];await enterReceiptWorkspace({location:'https://www.autofixkorea.com/hub/',gateway:{hasSession:()=>true,request:async()=>({role:'admin'})},login:()=>{},authorized:()=>{},openDetail:()=>calls.push('detail'),refresh:()=>calls.push('list')});assert.deepEqual(calls,['list']);
});
test('same-tab receipt hash navigation opens the new target and can be detached',async()=>{
 const host=new EventTarget(),opened=[];const stop=watchReceiptNavigation(host,()=>opened.push('new-target'));
 host.dispatchEvent(new Event('hashchange'));assert.deepEqual(opened,['new-target']);stop();host.dispatchEvent(new Event('hashchange'));assert.equal(opened.length,1);
});
