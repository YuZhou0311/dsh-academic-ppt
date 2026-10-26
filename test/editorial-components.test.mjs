import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
const directory=fileURLToPath(new URL('../skills/dsh-academic-ppt/references/editorial-v083/',import.meta.url));

test('editorial references are 20 verified components with a native four-per-slide atlas', async()=>{
  const catalog=JSON.parse(await readFile(join(directory,'catalog.json'),'utf8'));
  assert.equal(catalog.cards.length,20);
  assert.ok(catalog.cards.every(card=>card.componentOnly===true));
  const index=await readFile(join(directory,'index.html'),'utf8');
  assert.equal((index.match(/<article data-label=/g)||[]).length,20);
  for(const card of catalog.cards){
    const svg=await readFile(join(directory,'cards',card.id+'.svg'),'utf8');
    assert.ok(svg.includes('局部信息卡参考'));
  }
  const archive=unzipSync(await readFile(join(directory,'editorial-card-components-20.pptx')));
  const slides=Object.entries(archive).filter(([name])=>/^ppt\/slides\/slide\d+\.xml$/.test(name));
  assert.equal(slides.length,5);
  assert.ok(slides.every(([,bytes])=>Buffer.from(bytes).toString('utf8').includes('<p:sp>')));
  assert.ok(slides.reduce((count,[,bytes])=>count+(Buffer.from(bytes).toString('utf8').match(/<p:pic>/g)||[]).length,0)>=20);
});
