import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../skills/dsh-academic-ppt/references/reference-composition/',import.meta.url);
const m=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
assert.equal(m.identity,'original-synthetic-teaching-not-research');assert.equal(m.modelRun,false);assert.equal(m.approval,'not-user-reviewed');
for(const f of m.files){assert.ok(!f.path.includes('/')&&!f.path.includes('..'));const b=await readFile(new URL(f.path,root));assert.equal(b.length,f.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256);}
const receipt=JSON.parse(await readFile(new URL('render-receipt.json',root),'utf8'));assert.ok(JSON.stringify(receipt).includes(m.sourcePptxSha256));
console.log(JSON.stringify({compositionLessonFiles:m.files.length,hashes:true,approval:m.approval,scope:'File identity only; not autonomous design quality.'}));
