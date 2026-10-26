#!/usr/bin/env node
import {readFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {readBundledSkill,buildAcademicTools} from '../src/index.mjs';
import {REFERENCE_TEMPLATES,REFERENCE_CATEGORIES} from '../src/reference-catalog.mjs';
import {CARD_PRESETS} from '../src/card-catalog.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const packageJson=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
assert.equal(packageJson.name,'dsh-academic-ppt');
assert.equal(packageJson.dsh.bundle.patch,'./cordis.patch.yml');
const lockText=await readFile(join(root,'package-lock.json'),'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
if(lockText){
 const lock=JSON.parse(lockText);
 assert.equal(lock.name,packageJson.name);
 assert.equal(lock.version,packageJson.version,'root lock version must match package version');
 assert.equal(lock.packages[''].version,packageJson.version,'package lock version must match package version');
 assert.deepEqual(lock.packages[''].engines,packageJson.engines,'package lock host compatibility must match package metadata');
}
const skill=readBundledSkill();assert.equal(skill.name,packageJson.name);
const tools=buildAcademicTools();assert.equal(tools.length,16);
const cardRoot=join(root,'skills/dsh-academic-ppt/references/card-library');
const cardManifest=JSON.parse(await readFile(join(cardRoot,'manifest.json'),'utf8'));
assert.equal(cardManifest.count,CARD_PRESETS.length);
assert.deepEqual(cardManifest.cards.map(c=>c.id),CARD_PRESETS.map(c=>c.id));
assert.deepEqual(JSON.parse(await readFile(join(cardRoot,'catalog.json'),'utf8')),CARD_PRESETS);
for(const card of cardManifest.cards){
 const digest=createHash('sha256').update(await readFile(join(cardRoot,card.svg))).digest('hex');
 assert.equal(digest,card.sha256,'native card preview digest '+card.id);
}
const figureDeck=cardManifest.figureDeck;
assert.equal(figureDeck.slideCount,12);
assert.equal(figureDeck.path,'figure-cards.pptx');
const figureBytes=await readFile(join(cardRoot,figureDeck.path));
assert.equal(createHash('sha256').update(figureBytes).digest('hex'),figureDeck.sha256,'image-card reference PPTX digest');
assert.equal(Object.keys(unzipSync(figureBytes)).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).length,figureDeck.slideCount,'native image-card reference slide count');
const cardGallery=await readFile(join(cardRoot,'index.html'),'utf8');
assert.equal((cardGallery.match(/<article data-family=/g)||[]).length,CARD_PRESETS.length);
const required=['README.md','LICENSE','THIRD_PARTY_NOTICES.md','cordis.patch.yml','docs/INSTALL.md','docs/DESIGN.md','docs/VALIDATION.md','docs/RELEASE_NOTES.md','scripts/build-demo.mjs','scripts/build-release.mjs'];
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
process.stdout.write(JSON.stringify({ok:true,name:packageJson.name,version:packageJson.version,toolCount:tools.length,cardPresets:CARD_PRESETS.length,cardPreviewDigestsChecked:cardManifest.cards.length,imageCardReferenceSlides:figureDeck.slideCount,referenceTemplates:48,referencePptxDigestsChecked:9,skill:skill.name,markdownFiles:markdown.length,localLinksChecked:links,scope:'package structure, reference asset consistency, module loading and documentation links; no scientific or visual approval'},null,2)+'\n');
