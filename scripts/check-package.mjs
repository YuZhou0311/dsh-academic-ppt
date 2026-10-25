#!/usr/bin/env node
import {readFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readBundledSkill,buildAcademicTools} from '../src/index.mjs';
import {REFERENCE_TEMPLATES,REFERENCE_CATEGORIES} from '../src/reference-catalog.mjs';
import {readResearchDemoInputs} from './research-demo-inputs.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const packageJson=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
assert.equal(packageJson.name,'dsh-academic-ppt');
assert.equal(packageJson.dsh.bundle.patch,'./cordis.patch.yml');
const skill=readBundledSkill();assert.equal(skill.name,packageJson.name);
const tools=buildAcademicTools();assert.equal(tools.length,14);
const required=['README.md','LICENSE','THIRD_PARTY_NOTICES.md','cordis.patch.yml','docs/INSTALL.md','docs/DESIGN.md','docs/VALIDATION.md','scripts/build-demo.mjs','scripts/build-research-demo.mjs','scripts/research-demo-inputs.mjs'];
for(const name of required)assert.ok((await stat(join(root,name))).isFile(),name);
assert.equal(REFERENCE_TEMPLATES.length,48);
const templateRoot=join(root,'skills/dsh-academic-ppt/references/templates');
for(const name of ['academic-templates-48.pptx','gallery.html','manifest.json','slide-records.json',...REFERENCE_CATEGORIES.map(c=>c.id+'.pptx')])assert.ok((await stat(join(templateRoot,name))).isFile(),'reference template '+name);
const manifest=JSON.parse(await readFile(join(templateRoot,'manifest.json'),'utf8'));
const records=JSON.parse(await readFile(join(templateRoot,'slide-records.json'),'utf8'));
assert.equal(manifest.templateCount,48);
assert.deepEqual(manifest.templates.map(t=>t.id),REFERENCE_TEMPLATES.map(t=>t.id));
assert.deepEqual(records.slides.map(s=>s.referenceTemplateId),REFERENCE_TEMPLATES.map(t=>t.id));
for(const [i,template] of REFERENCE_TEMPLATES.entries())assert.deepEqual(manifest.templates[i].slots,template.slots,'published geometry '+template.id);
for(const file of [manifest.collection,...manifest.categoryFiles]){
 const actual=createHash('sha256').update(await readFile(join(templateRoot,file.file))).digest('hex');
 assert.equal(actual,file.sha256,'reference PPTX digest '+file.file);
}

// A passing source/package check must include everything its replay CLI reads.
// The transfer archive on main is not a substitute for materialized inputs.
let researchSourceDigestsChecked=0;
for(const author of ['a','b']){
 const {content,manifest,supportFiles}=await readResearchDemoInputs(join(root,'examples/research-native-v07'),author);
 assert.equal(manifest.author,author,'research demo author');
 assert.equal(content.slides.length,manifest.slideCount,'research demo slide count');
 assert.ok(content.papers.length&&content.slides.length,'nonempty research demo '+author);
 researchSourceDigestsChecked+=supportFiles.length;
}

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
for(const ref of ['research','evidence','design','visual-decision','component-grammar','template-learning','composition','revision','deepseek','delivery']){
 const value=await readFile(join(root,'skills/dsh-academic-ppt/references/'+ref+'.md'),'utf8');assert.ok(value.trim().length>200);
}
process.stdout.write(JSON.stringify({ok:true,name:packageJson.name,version:packageJson.version,toolCount:tools.length,referenceTemplates:48,referencePptxDigestsChecked:9,researchDemoBundlesChecked:2,researchSourceDigestsChecked,skill:skill.name,markdownFiles:markdown.length,localLinksChecked:links,scope:'package structure, replay input integrity, reference asset consistency, module loading and documentation links; no scientific or visual approval'},null,2)+'\n');
