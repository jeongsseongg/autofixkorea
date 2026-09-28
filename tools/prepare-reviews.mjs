import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('imweb-buy-review-large.html','utf8');
const match=source.match(/var reviews=(\[[\s\S]*?\n\]);/);
if(!match) throw new Error('Original review array missing');
const reviews=runInNewContext('('+match[1]+')',Object.create(null),{timeout:100});
mkdirSync('src/content',{recursive:true});
writeFileSync('src/content/reviews.json',JSON.stringify(reviews,null,2));
console.log(`Original cases: ${reviews.length}`);
