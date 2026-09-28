import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {join} from 'node:path';
const origin=process.env.PREVIEW_URL||'http://127.0.0.1:4328';
const publicDir=process.env.PUBLIC_DIR||'dist';
async function files(dir){
 const result=[];
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const path=join(dir,entry.name);
  if(entry.isDirectory()) result.push(...await files(path));else result.push(path);
 }
 return result;
}
const routes=['/','/Home','/news','/review','/download','/car','/19','/pro','/21','/review/case-1','/review/case-6'];
for(const path of routes){
 const response=await fetch(origin+path);
 assert.equal(response.status,200,path);
 const text=await response.text();
 assert.match(text,/AUTOFIX KOREA/,path);
 assert.equal((text.match(/rel="canonical"/g)||[]).length,1,path);
 assert.match(text,/noindex,nofollow/,path);
 assert.doesNotMatch(text,/<script(?![^>]*src=)[^>]*>/i,path);
 assert.doesNotMatch(text,/\son\w+=|\sstyle=/i,path);
}
assert.equal((await fetch(origin+'/missing-page-check')).status,404);
let images=0;
for(const path of (await files(publicDir)).filter(x=>x.endsWith('.html'))){
 const text=await readFile(path,'utf8');
 for(const match of text.matchAll(/<img[^>]+src="([^"]+)"/g)){
  assert.ok(match[1].startsWith('/'),'External image: '+match[1]);
  await access(join(publicDir,match[1]));images++;
 }
}
console.log(`PASS: ${routes.length} HTTP routes, genuine 404, single canonical, no inline executable code, ${images} local image references.`);
