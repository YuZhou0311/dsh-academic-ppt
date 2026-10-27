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
import {PAGE_RECIPES,PAGE_RECIPE_IDS} from '../src/page-recipes.mjs';

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
const tools=buildAcademicTools();assert.equal(tools.length,19);
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
// v0.8.3 separate visual reference components, not additional preset API IDs.
const editorialRoot=join(root,'skills/dsh-academic-ppt/references/editorial-v083');
const editorialCatalog=JSON.parse(await readFile(join(editorialRoot,'catalog.json'),'utf8'));
assert.equal(editorialCatalog.version,'0.8.3');
assert.equal(editorialCatalog.cards.length,20);
assert.deepEqual(editorialCatalog.cards.map(x=>x.id),Array.from({length:20},(_,i)=>'C'+String(i+1).padStart(2,'0')));
for(const card of editorialCatalog.cards){
  assert.equal(card.componentOnly,true,'editorial visual reference must be component-only: '+card.id);
  const svg=await readFile(join(editorialRoot,'cards',card.id+'.svg'),'utf8');
  assert.match(svg,/<svg\b/,'SVG preview missing '+card.id);
  assert.match(svg,/局部信息卡参考/,'component-only disclosure missing '+card.id);
}
const editorialIndex=await readFile(join(editorialRoot,'index.html'),'utf8');
assert.equal((editorialIndex.match(/<article data-label=/g)||[]).length,20);
const editorialDeck=unzipSync(await readFile(join(editorialRoot,'editorial-card-components-20.pptx')));
const editorialSlidePaths=Object.keys(editorialDeck).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name));
assert.equal(editorialSlidePaths.length,5,'editorial atlas must contain four cards per slide');
const editorialXml=editorialSlidePaths.map(name=>Buffer.from(editorialDeck[name]).toString('utf8')).join('');
assert.ok((editorialXml.match(/<p:sp>/g)||[]).length>=200,'editable native card furniture missing');
assert.ok((editorialXml.match(/<p:pic>/g)||[]).length>=20,'figure placeholder slots missing');
const pageRoot=join(root,'skills/dsh-academic-ppt/references/page-recipes');
assert.equal(PAGE_RECIPES.length,32);
assert.deepEqual(JSON.parse(await readFile(join(pageRoot,'catalog.json'),'utf8')),PAGE_RECIPES,'whole-page catalogue matches the runtime API');
const pageReview=JSON.parse(await readFile(join(pageRoot,'render-review.json'),'utf8'));
assert.equal(pageReview.slideCount,32);assert.deepEqual(pageReview.reviewedPageIds,PAGE_RECIPE_IDS);
assert.equal(pageReview.nativeSceneErrors,0);assert.equal(pageReview.reviewer,'vision-model');
const pageBytes=await readFile(join(pageRoot,pageReview.pptx));
assert.equal(createHash('sha256').update(pageBytes).digest('hex'),pageReview.sha256,'whole-page atlas digest');
const pageZip=unzipSync(pageBytes),pagePaths=Object.keys(pageZip).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name));
assert.equal(pagePaths.length,32);
for(const path of pagePaths){
 const xml=Buffer.from(pageZip[path]).toString('utf8');
 assert.match(xml,/原创结构示意/,'explicit teaching-only identity '+path);
 assert.ok((xml.match(/<p:sp>/g)||[]).length>=8,'editable original shapes and text '+path);
 assert.equal((xml.match(/<p:pic>/g)||[]).length,0,'whole-page studies use original native objects '+path);
}
for(const name of ['index.html','montage.png'])assert.ok((await stat(join(pageRoot,name))).isFile(),'whole-page reference '+name);
const required=['README.md','LICENSE','THIRD_PARTY_NOTICES.md','cordis.patch.yml','docs/INSTALL.md','docs/DESIGN.md','docs/VALIDATION.md','docs/VALIDATION_V090.md','docs/DESIGN_RATIONALE_V090.md','docs/MIGRATION_V090.md','docs/RELEASE_NOTES.md','scripts/build-demo.mjs','scripts/build-release.mjs','scripts/build-page-recipes.mjs'];
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
for(const ref of ['research','evidence','design','visual-decision','component-grammar','template-learning','composition','revision','deepseek','delivery','workflow-v090','storyboard-v090','page-recipes']){
 const value=await readFile(join(root,'skills/dsh-academic-ppt/references/'+ref+'.md'),'utf8');assert.ok(value.trim().length>200);
}
process.stdout.write(JSON.stringify({ok:true,name:packageJson.name,version:packageJson.version,toolCount:tools.length,pageRecipes:PAGE_RECIPES.length,pageRecipeAtlasSlides:pagePaths.length,cardPresets:CARD_PRESETS.length,cardPreviewDigestsChecked:cardManifest.cards.length,imageCardReferenceSlides:figureDeck.slideCount,referenceTemplates:48,referencePptxDigestsChecked:10,skill:skill.name,markdownFiles:markdown.length,localLinksChecked:links,scope:'package structure, reference asset consistency, module loading and documentation links; no scientific or visual approval'},null,2)+'\n');
