import assert from 'node:assert/strict';
import {readdir,readFile,access} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {createConsultationService} from '../src/services/consultation/index.js';

function platformFree(text) {
  assert.doesNotMatch(text,/https?:[^\s"'<>)]*(?:imweb\.me|imweb\.co\.kr)/i);
}
assert.throws(()=>platformFree('https://cdn.imweb.me/old.js'));
const hosting=JSON.parse(await readFile('.openai/hosting.json','utf8'));
const root=resolve(hosting.static.directory);
async function walk(dir) {
  const files=[];
  for (const item of await readdir(dir,{withFileTypes:true})) {
    const path=join(dir,item.name);
    files.push(...(item.isDirectory()?await walk(path):[path]));
  }
  return files;
}
let checked=0;
for (const path of await walk(root)) {
  if (!/\.(html|css|js|json)$/.test(path)) continue;
  const text=await readFile(path,'utf8');
  platformFree(text);
  if(path.endsWith('.js')) {
    for(const match of text.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      if(!match[1].startsWith('.'))continue;
      const target=resolve(dirname(path),match[1]);
      await access(target);
      if(path.includes('services'))assert.ok(!target.includes('features'));
    }
  }
  checked++;
}
await assert.rejects(access(join(root,'src/features/consultation-original/index.js')));
const settings={enabled:true,endpoint:'https://example.invalid/consultation'};
let calls=0;
const good=createConsultationService(settings,async(url,request)=>{
  calls++;
  assert.equal(url,settings.endpoint);
  assert.equal(JSON.parse(request.body).name,'test');
  return {ok:true,json:async()=>({success:'true'})};
});
await good.submit({name:'test'});
assert.equal(calls,1);
for(const response of [{ok:false},{ok:true,json:async()=>({success:false})}]) {
  await assert.rejects(createConsultationService(settings,async()=>response).submit({}));
}
await assert.rejects(createConsultationService({...settings,enabled:false},()=>{
  throw new Error('Transport must not run');
}).submit({}),/미리보기/);
console.log(`Independent check passed: ${checked} text files; forbidden-host negative control; consultation success/fail/disabled cases. No external submissions.`);
