#!/usr/bin/env node
import {readFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join,relative} from 'node:path';
import assert from 'node:assert/strict';
import {readBundledSkill,buildAcademicTools} from '../src/index.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const packageJson=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
assert.equal(packageJson.name,'dsh-academic-ppt');
assert.equal(packageJson.dsh.bundle.patch,'./cordis.patch.yml');
const skill=readBundledSkill();assert.equal(skill.name,packageJson.name);
const tools=buildAcademicTools();assert.equal(tools.length,10);
const required=['README.md','LICENSE','THIRD_PARTY_NOTICES.md','cordis.patch.yml','docs/INSTALL.md','docs/DESIGN.md','docs/VALIDATION.md','scripts/build-demo.mjs'];
for(const name of required)assert.ok((await stat(join(root,name))).isFile(),name);

async function files(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(['node_modules','.git','.test-output','dist'].includes(entry.name))continue;const path=join(dir,entry.name);if(entry.isDirectory())out.push(...await files(path));else out.push(path);}return out;}
const markdown=(await files(root)).filter(p=>p.endsWith('.md'));
let links=0;
for(const path of markdown){
 const value=await readFile(path,'utf8');
 assert.ok(!value.includes('\uFFFD'),'invalid UTF-8 replacement character in '+relative(root,path));
 for(const m of value.matchAll(/!?\[[^\]\n]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)){
  const target=m[1];if(/^(?:[a-z]+:|#)/i.test(target))continue;
  const local=decodeURIComponent(target.split('#')[0]);if(!local)continue;
  const resolved=resolve(dirname(path),local);
  assert.ok(!relative(root,resolved).startsWith('..'),'documentation link escapes package: '+target);
  await stat(resolved).catch(()=>{throw new Error(`Broken link in ${relative(root,path)}: ${target}`)});links++;
 }
}
for(const ref of ['research','evidence','design','revision','deepseek','delivery']){
 const value=await readFile(join(root,'skills/dsh-academic-ppt/references/'+ref+'.md'),'utf8');assert.ok(value.trim().length>200);
}
process.stdout.write(JSON.stringify({ok:true,name:packageJson.name,version:packageJson.version,toolCount:tools.length,skill:skill.name,markdownFiles:markdown.length,localLinksChecked:links,scope:'package structure, module loading and documentation links; no scientific or visual approval'},null,2)+'\n');
