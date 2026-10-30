#!/usr/bin/env node
import {readFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join,relative,isAbsolute,sep} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {readBundledSkill,buildAcademicTools} from '../src/index.mjs';
import {REFERENCE_TEMPLATES,REFERENCE_CATEGORIES} from '../src/reference-catalog.mjs';
import {CARD_PRESETS} from '../src/card-catalog.mjs';
import {PAGE_RECIPES,PAGE_RECIPE_IDS} from '../src/page-recipes.mjs';
import {ACADEMIC_STYLE_IDS} from '../src/academic-styles.mjs';

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
// Original visual details supplement the existing card library, not new preset IDs.
const frameRoot=join(root,'skills/dsh-academic-ppt/references/frame-studies');
const frameCatalog=JSON.parse(await readFile(join(frameRoot,'catalog.json'),'utf8'));
const frameReview=JSON.parse(await readFile(join(frameRoot,'render-review.json'),'utf8'));
assert.deepEqual(frameCatalog.pages.map(page=>page.id),['frame-boundaries','frame-depth','frame-titles','frame-nesting']);
assert.deepEqual(frameReview.reviewedPageIds,frameCatalog.pages.map(page=>page.id));
assert.equal(frameReview.view,'pptx-render');assert.equal(frameReview.slideCount,4);assert.equal(frameReview.nativeSceneErrors,0);
for(const page of frameCatalog.pages){
 assert.equal(createHash('sha256').update(await readFile(join(frameRoot,page.svg))).digest('hex'),page.sha256,'frame study SVG digest '+page.id);
}
const frameBytes=await readFile(join(frameRoot,frameCatalog.pptx.path));
const frameHash=createHash('sha256').update(frameBytes).digest('hex');
assert.equal(frameHash,frameCatalog.pptx.sha256,'frame study PPTX digest');assert.equal(frameHash,frameReview.sha256,'frame study rendered version');
const frameZip=unzipSync(frameBytes),frameSlides=Object.keys(frameZip).filter(path=>/^ppt\/slides\/slide\d+\.xml$/.test(path));
assert.equal(frameSlides.length,4);
const frameXml=frameSlides.map(path=>Buffer.from(frameZip[path]).toString('utf8')).join('');
assert.equal((frameXml.match(/<p:pic>/g)||[]).length,0,'frame studies must remain native original objects');
for(const expression of [/<a:noFill\/>/,/<a:prstDash val="dash"\/>/,/<a:outerShdw\b/])assert.match(frameXml,expression,'native frame paint missing');
for(const name of ['index.html','montage.png'])assert.ok((await stat(join(frameRoot,name))).isFile(),'frame study '+name);
// Authored teaching studies are checked for packaging and artifact identity.
// Matching review records never constitute fresh visual or scientific approval.
const styleRoot=join(root,'skills/dsh-academic-ppt/references/academic-styles');
const styleFile=name=>{
 assert.ok(typeof name==='string'&&name.length>0&&!isAbsolute(name),'academic style asset needs a relative path');
 const path=resolve(styleRoot,name),local=relative(styleRoot,path);
 assert.ok(local&&local!=='..'&&!local.startsWith('..'+sep),'academic style asset escapes its reference directory: '+name);
 return path;
};
const studyDigest=bytes=>createHash('sha256').update(bytes).digest('hex');
const studyJson=async name=>JSON.parse(await readFile(styleFile(name),'utf8'));
const styleCatalog=await studyJson('catalog.json');
const styleReview=await studyJson('render-review.json');
const styleNative=await studyJson('native-editability.json');
assert.equal(ACADEMIC_STYLE_IDS.length,6,'six executable academic directions remain available');
assert.deepEqual(styleCatalog.profiles.map(profile=>profile.id),ACADEMIC_STYLE_IDS,'style catalogue order matches the runtime API');
assert.deepEqual(styleNative.profiles.map(profile=>profile.profile),ACADEMIC_STYLE_IDS,'native inspection covers every direction in order');
assert.equal(styleCatalog.identity,'constructed-teaching-data-not-research-results');
assert.equal(styleCatalog.fixtureType,'authored-plugin-renderer-study-not-model-evaluation');
assert.equal((await studyJson('teaching-data.json')).identity,styleCatalog.identity,'sample data retain their teaching-only identity');
const stylePages=styleCatalog.profiles.flatMap(profile=>profile.pages);
assert.equal(new Set(stylePages.map(page=>page.id)).size,stylePages.length,'academic study page IDs are unique');
assert.deepEqual(styleReview.pages.map(page=>page.id),stylePages.map(page=>page.id),'review records cover exactly the shipped study pages');
assert.equal(styleReview.coverage.pages,stylePages.length,'review coverage count matches the current catalogue');
assert.equal(styleReview.status,'reviewed-with-scoped-findings','retain the scoped review status rather than an automatic approval');
assert.ok(styleReview.limitations?.length>0,'study review must preserve its stated limits');
const styleGallery=await readFile(styleFile('index.html'),'utf8');
let stylePptxDigests=0,stylePngDigests=0,styleEditablePages=0;
for(const [profileIndex,profile] of styleCatalog.profiles.entries()){
 assert.equal(profile.pages.length,2,'each academic direction has two substantive study pages: '+profile.id);
 const native=styleNative.profiles[profileIndex];
 const deck=await studyJson(profile.deck),receipt=await studyJson(profile.renderReceipt);
 assert.equal(deck.design.styleProfile,profile.id,'rebuild record uses its declared style');
 assert.deepEqual(deck.slides.map(slide=>slide.id),profile.pages.map(page=>page.id),'rebuild pages follow catalogue order');
 assert.ok(deck.slides.every(slide=>slide.layout!=='cover'),'academic studies include content pages, not cover-only variants');
 const bytes=await readFile(styleFile(profile.pptx)),digest=studyDigest(bytes),zip=unzipSync(bytes);
 const slides=Object.keys(zip).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name))
  .sort((left,right)=>Number(left.match(/slide(\d+)\.xml$/)[1])-Number(right.match(/slide(\d+)\.xml$/)[1]));
 assert.equal(slides.length,profile.pages.length,'actual PPTX page count '+profile.id);
 assert.equal(digest,profile.pptxSha256,'catalogue PPTX digest '+profile.id);
 assert.equal(native.pptx,profile.pptx,'native inspection names the shipped PPTX');
 assert.equal(native.pptxSha256,digest,'native inspection binds the actual PPTX '+profile.id);
 assert.deepEqual(native.pages.map(page=>page.slide),slides.map(path=>path.slice('ppt/slides/'.length)),'native inspection page order '+profile.id);
 assert.equal(receipt.status,'rendered');assert.equal(receipt.visual,'not-verified','rendering alone must not claim visual approval');
 assert.equal(receipt.source.sha256,digest,'actual render source matches the shipped PPTX '+profile.id);
 assert.equal(receipt.source.byteLength,bytes.length);assert.equal(receipt.slideCount,profile.pages.length);
 assert.equal(receipt.pngs.length,profile.pages.length);
 assert.deepEqual({...receipt.renderer,missingFonts:receipt.missingFonts},profile.renderer,'catalogue renderer metadata matches its receipt');
 stylePptxDigests++;
 for(const artifact of [receipt.manifest,receipt.pdf]){
  const path=join(dirname(profile.renderReceipt),artifact.file),artifactBytes=await readFile(styleFile(path));
  assert.equal(studyDigest(artifactBytes),artifact.sha256,'render receipt companion digest '+path);
  assert.equal(artifactBytes.length,artifact.byteLength,'render receipt companion size '+path);
 }
 assert.equal(resolve(styleRoot,profile.pdf),resolve(styleRoot,dirname(profile.renderReceipt),receipt.pdf.file),'catalogue PDF follows the render receipt');
 const manifest=await studyJson(join(dirname(profile.renderReceipt),receipt.manifest.file));
 assert.equal(manifest.sourceSha256,digest);assert.equal(manifest.pageCount,profile.pages.length);
 for(const [pageIndex,page] of profile.pages.entries()){
  const reviewed=styleReview.pages.find(item=>item.id===page.id),rendered=receipt.pngs[pageIndex];
  const png=await readFile(styleFile(page.png)),pngDigest=studyDigest(png);
  assert.equal(rendered.page,pageIndex+1,'actual rendered page order');
  assert.equal(resolve(styleRoot,page.png),resolve(styleRoot,dirname(profile.renderReceipt),rendered.file),'catalogue PNG follows the render receipt');
  assert.equal(pngDigest,page.pngSha256,'catalogue PNG digest '+page.id);
  assert.equal(pngDigest,rendered.sha256,'render receipt PNG digest '+page.id);assert.equal(png.length,rendered.byteLength);
  assert.equal(reviewed.image,page.png);assert.equal(reviewed.imageSha256,pngDigest,'review binds the actual PNG '+page.id);
  assert.equal(reviewed.pptx,profile.pptx);assert.equal(reviewed.pptxSha256,digest,'review binds the actual PPTX '+page.id);
  const xml=Buffer.from(zip[slides[pageIndex]]).toString('utf8');
  const counts={shapes:(xml.match(/<p:sp>/g)||[]).length,tables:(xml.match(/<a:tbl>/g)||[]).length,
   pictures:(xml.match(/<p:pic>/g)||[]).length,charts:(xml.match(/<c:chart\b/g)||[]).length};
  for(const [kind,count] of Object.entries(counts))assert.equal(native.pages[pageIndex][kind],count,'native object inventory '+page.id+' '+kind);
  assert.ok(counts.shapes>0&&/<a:t>/.test(xml),'editable native shapes and text '+page.id);
  assert.equal(counts.pictures,0,'authored teaching studies must not become slide screenshots '+page.id);
  assert.equal(counts.charts,0,'these study plots use editable shapes, not chart-workbook objects '+page.id);
  if(deck.slides[pageIndex].table)assert.ok(counts.tables>0,'authored tables remain native PowerPoint tables '+page.id);
  const visibleText=[...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(match=>match[1]).join('');
  assert.match(visibleText,/教学构造数据/,'teaching identity remains visible '+page.id);
  assert.match(visibleText,/非真实科研结果/,'research-result limitation remains visible '+page.id);
  assert.ok(styleGallery.includes(`src="${page.png}"`),'gallery uses the current actual render '+page.id);
  assert.ok((await stat(styleFile(page.svg))).isFile(),'editable scene preview '+page.id);
  stylePngDigests++;styleEditablePages++;
 }
 assert.ok((await stat(styleFile(profile.html))).isFile(),'per-style HTML preview '+profile.id);
}
for(const name of ['README.md','index.html','montage.png','build-quality.json'])assert.ok((await stat(styleFile(name))).isFile(),'academic style reference '+name);
const required=['README.md','LICENSE','THIRD_PARTY_NOTICES.md','cordis.patch.yml','docs/INSTALL.md','docs/DESIGN.md','docs/VALIDATION.md','docs/VALIDATION_V090.md','docs/DESIGN_RATIONALE_V090.md','docs/MIGRATION_V090.md','docs/RELEASE_NOTES.md','docs/RESEARCH_V010.md','docs/VALIDATION_V010.md','evals/README.md','evals/academic-cases.json','scripts/build-demo.mjs','scripts/build-release.mjs','scripts/build-page-recipes.mjs','scripts/build-frame-studies.mjs','scripts/build-academic-styles.mjs'];
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
for(const ref of ['research','evidence','design','visual-decision','component-grammar','template-learning','composition','revision','deepseek','delivery','workflow-v090','storyboard-v090','page-recipes','academic-visual-language','workflow-v010','academic-styles','academic-writing','scientific-figures','design-critique']){
 const value=await readFile(join(root,'skills/dsh-academic-ppt/references/'+ref+'.md'),'utf8');assert.ok(value.trim().length>200);
}
process.stdout.write(JSON.stringify({ok:true,name:packageJson.name,version:packageJson.version,toolCount:tools.length,academicStyles:styleCatalog.profiles.length,academicStyleStudySlides:stylePages.length,academicStylePptxDigestsChecked:stylePptxDigests,academicStylePngDigestsChecked:stylePngDigests,nativeEditableStylePages:styleEditablePages,pageRecipes:PAGE_RECIPES.length,pageRecipeAtlasSlides:pagePaths.length,frameStudySlides:frameSlides.length,cardPresets:CARD_PRESETS.length,cardPreviewDigestsChecked:cardManifest.cards.length,imageCardReferenceSlides:figureDeck.slideCount,referenceTemplates:48,referencePptxDigestsChecked:10,skill:skill.name,markdownFiles:markdown.length,localLinksChecked:links,scope:'package structure, reference asset hashes and record bindings, native object inventory, module loading and documentation links; no scientific or visual approval, glyph verification, or end-to-end model evaluation'},null,2)+'\n');
