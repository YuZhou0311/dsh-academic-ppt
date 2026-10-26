import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { cardDemoAssets } from '../scripts/card-demo-assets.mjs';
import { getCardPreset } from '../src/card-catalog.mjs';
import { measureCardSurface } from '../src/card-surface.mjs';
import { renderImageCard } from '../src/image-card-surface.mjs';
import { buildScenes, wrapText, measureTextWidth } from '../src/scene.mjs';
import { renderProject } from '../src/render.mjs';
import { slideAssetIds, evidenceIssues } from '../src/core.mjs';
import { evidenceDesignReport } from '../src/evidence-design.mjs';
import { assertToolArgs } from '../src/schema.mjs';
import { fixtureDesign, brief, paper, claim } from './fixtures.mjs';

// Synthetic record linkage tests only: these pixels are original teaching
// diagrams, not research sources or a claim of having read a real article.
const assets=cardDemoAssets().map((asset,i)=>({...asset,paperId:'P1',provenance:'source',
  figure:`Synthetic figure ${i+1}`,displayCaption:`[1] 测试图 ${i+1}`,
  sha256:createHash('sha256').update(Buffer.from(asset.data.split(',')[1],'base64')).digest('hex'),
  reading:{purpose:'evidence',contentType:'diagram',task:'explain-process',verifiedBy:'human',note:'Synthetic protocol state, not an actual scientific review.'}}));
const design=structuredClone(fixtureDesign);
const measure=(card,w=1120)=>measureCardSurface(card,w,{design,system:design.system,wrapText,measureTextWidth});
function cardFor(id='figure-caption'){
  const card=structuredClone(getCardPreset(id).example);card.claimIds=['C1'];
  card.box={x:80,y:130,w:1120,h:Math.ceil(measure(card).minimumH)};return card;
}
function projectFor(card=cardFor()){
  return {title:'Synthetic image-card integration',brief:structuredClone(brief),design:structuredClone(design),papers:[structuredClone(paper)],claims:[structuredClone(claim)],assets:structuredClone(assets),
    slides:[{id:'card-slide',layout:'synthesis',title:'嵌入图片仍保留原始对象与来源',paperIds:['P1'],claimIds:['C1'],figureIds:[],cards:[card],notes:'Synthetic software test; not a scientific finding.',seconds:60,
      argument:{role:'evidence',question:'Nested source identity?',contribution:'Verify independently exported images.',boundary:'Synthetic state only.'}}]};
}
const errors=page=>page.issues.filter(issue=>issue.severity==='error');

test('card-only source IDs are visible to evidence collectors without duplicate slide figureIds',()=>{
  const p=projectFor(cardFor('figure-pair')),slide=p.slides[0],scene=buildScenes(p);
  assert.deepEqual(slide.figureIds,[]);
  assert.deepEqual(slideAssetIds(slide),slide.cards[0].figureIds);
  const report=evidenceDesignReport(p,scene).slides[0];
  assert.deepEqual(report.sourceFigureIds,slide.cards[0].figureIds);
  assert.equal(report.sourceFigures.length,2);assert.equal(report.excludedImages.length,0);
  assert.ok(report.visibleCarriers.includes('source-figure'));
  assert.ok(report.sourceFigureAreaFraction>0);
  for(const image of scene.pages[0].nodes.filter(n=>n.kind==='image')){
    assert.equal(image.cardId,slide.cards[0].id);assert.notEqual(image.semantic,false);
  }
  const issueCodes=evidenceIssues(p).map(i=>i.code);
  for(const code of ['dangling-figure','figure-source-not-visible','figure-provenance'])assert.ok(!issueCodes.includes(code),code);
});

test('missing or unrelated card-only sources still block source validation',()=>{
  const missing=projectFor();missing.assets=[];
  assert.ok(evidenceIssues(missing).some(i=>i.severity==='error'&&i.code==='dangling-figure'));
  assert.ok(errors(buildScenes(missing).pages[0]).some(i=>i.code==='missing-figure'));
  const unrelated=projectFor();unrelated.assets[0].paperId='P2';
  unrelated.papers.push({...structuredClone(paper),id:'P2'});
  assert.ok(evidenceIssues(unrelated).some(i=>i.severity==='error'&&i.code==='figure-source-not-visible'));
  assert.equal(evidenceDesignReport(unrelated,buildScenes(unrelated)).slides[0].sourceFigures.length,0);
  const unknown=projectFor();unknown.assets[0].paperId='unknown';
  assert.ok(evidenceIssues(unknown).some(i=>i.severity==='error'&&i.code==='figure-provenance'));
});

test('embedded figures export as separate native pictures traceable to unchanged source bytes',async()=>{
  const p=projectFor(cardFor('figure-zoom')),out=await renderProject(p),page=out.scenes.pages[0],zip=unzipSync(out.pptx);
  assert.deepEqual(errors(page),[]);
  const xml=strFromU8(zip['ppt/slides/slide1.xml']),rels=strFromU8(zip['ppt/slides/_rels/slide1.xml.rels']);
  const pictures=xml.match(/<p:pic>.*?<\/p:pic>/gs)||[],images=page.nodes.filter(n=>n.kind==='image');
  assert.equal(pictures.length,2);assert.equal(images.length,2);
  for(const node of images){
    const picture=pictures.find(pic=>pic.includes(`name="${node.id}"`));assert.ok(picture,node.id);
    const relId=picture.match(/r:embed="([^"]+)"/)[1];
    const rel=(rels.match(/<Relationship\b[^>]*\/>/g)||[]).find(tag=>tag.includes(`Id="${relId}"`));
    const target=rel.match(/Target="([^"]+)"/)[1].replace(/^\.\.\//,'ppt/');
    const asset=p.assets.find(a=>a.id===node.assetId);
    assert.equal(createHash('sha256').update(zip[target]).digest('hex'),asset.sha256);
    assert.equal(node.fit,'contain');assert.deepEqual(node.source,{paperId:'P1',figure:asset.figure,panel:undefined,sourceVersion:asset.sourceVersion});
    if(asset.viewport){assert.deepEqual(node.viewport,asset.viewport);assert.match(picture,/<a:srcRect\b/);}
    else {assert.equal(node.viewport,undefined);assert.ok(!picture.includes('<a:srcRect'));}
    assert.ok(page.nodes.some(n=>n.kind==='text'&&n.cardId===node.cardId&&n.role==='caption'&&n.text===asset.displayCaption));
  }
  assert.ok(page.nodes.some(n=>n.kind==='text'&&n.text===p.slides[0].cards[0].body));
  assert.ok((xml.match(/<p:sp>/g)||[]).length>5,'titles, explanation, captions and frame remain native objects');
  assert.match(page.notes,/原图来源/);
});

test('image-card frame styling never clips scientific pixels or disables readability checks',()=>{
  const card=cardFor();card.appearance={radius:28,padding:20,elevation:true};
  const p=projectFor(card),page=buildScenes(p).pages[0],image=page.nodes.find(n=>n.kind==='image');
  assert.deepEqual(errors(page),[]);
  assert.ok(page.nodes.some(n=>n.cardId===card.id&&n.role==='card-surface'&&n.radius===28&&n.shadow));
  assert.equal(image.radius,undefined);assert.equal(image.viewport,undefined);assert.equal(image.fit,'contain');
  assert.ok(Math.abs(image.w/image.h-p.assets[0].width/p.assets[0].height)<1e-8);
  p.assets[0].reading.minLabelPx=4;
  assert.ok(errors(buildScenes(p).pages[0]).some(i=>i.code==='figure-label-too-small'));
});

test('nested image slots are not peer region overlaps but genuine card/image collisions remain errors',()=>{
  const p=projectFor(cardFor('figure-pair')),page=buildScenes(p).pages[0];
  assert.deepEqual(errors(page),[],'legitimate image + caption children fit inside their parent card');
  const image=page.nodes.find(n=>n.kind==='image');
  const other={id:'overlap',kind:'boundary',title:'阻挡证据',body:'此文字故意压住原图。',claimIds:[],style:'plain',box:{x:image.x+8,y:image.y+8,w:240,h:130}};
  p.slides[0].cards.push(other);
  const conflict=errors(buildScenes(p).pages[0]);
  assert.ok(conflict.some(i=>i.code==='content-region-overlap'));
  assert.ok(conflict.some(i=>i.code==='text-evidence-overlap'),'scientific images remain visible to painted-content collision inspection');
  const small=projectFor();small.slides[0].cards[0].box.h=100;
  const tooSmall=errors(buildScenes(small).pages[0]);
  assert.ok(tooSmall.some(i=>i.code==='card-surface-overflow'));
  assert.ok(tooSmall.some(i=>i.code==='image-card-region-bounds'));
});

test('nested region validation catches internal slot overlap and out-of-card slots independently',()=>{
  const card=cardFor('figure-pair'),m=measure(card),p=projectFor(card),peerRegions=[],nodes=[];
  m.images[1]={...m.images[1],x:m.images[0].x,y:m.images[0].y};
  const b={p:design.palette,page:{id:'probe',issues:[]},region:(...r)=>peerRegions.push(r),rect:()=>{},line:()=>{},text:()=>{},add:(kind,key,props,cardId)=>nodes.push({kind,key,...props,cardId})};
  const figure=(nested,project,assetId,box,key)=>{nested.region(key,box,'figure');nested.add('image',key,{...box,assetId});};
  renderImageCard(b,card,card.box,0,p,{figure},m,{drawSemanticIcon:()=>{}});
  assert.equal(peerRegions.length,1,'only the card is a page-level peer region');
  assert.ok(b.page.issues.some(i=>i.code==='image-card-region-overlap'));
  assert.equal(nodes.length,2);assert.ok(nodes.every(n=>n.cardId===card.id&&n.semantic!==false));
  b.page.issues.length=0;m.images[1].x=-5;
  renderImageCard(b,card,card.box,0,p,{figure},m,{drawSemanticIcon:()=>{}});
  assert.ok(b.page.issues.some(i=>i.code==='image-card-region-bounds'));
});

test('wrong recipe counts and non-image recipes cannot silently discard referenced images',()=>{
  const p=projectFor();p.slides[0].cards[0].figureIds.push('card-demo-b');
  const page=buildScenes(p).pages[0];
  assert.ok(errors(page).some(i=>i.code==='image-card-figure-count'));
  assert.equal(page.nodes.filter(n=>n.kind==='image').length,2,'an invalid pairing retains its authored sources for inspection');
  const textOnly=projectFor();textOnly.slides[0].cards[0].preset='research-tab';
  assert.ok(errors(buildScenes(textOnly).pages[0]).some(i=>i.code==='image-card-preset-required'));
});

test('media-height and source-count input limits are explicit errors, not clamped preferences',()=>{
  const valid={projectPath:'/synthetic/project.json',expectedRevision:0,slides:projectFor().slides};
  assert.doesNotThrow(()=>assertToolArgs('academic_ppt_record',valid));
  for(const value of [119,521]){
    const bad=structuredClone(valid);bad.slides[0].cards[0].mediaHeight=value;
    assert.throws(()=>assertToolArgs('academic_ppt_record',bad),/mediaHeight/);
  }
  const excessive=structuredClone(valid);excessive.slides[0].cards[0].figureIds=['a','b','c','d','e'];
  assert.throws(()=>assertToolArgs('academic_ppt_record',excessive),/figureIds/);
  const short=cardFor();short.mediaHeight=150;const tall={...short,mediaHeight:320};
  assert.equal(measure(tall).minimumH-measure(short).minimumH,170,'requested media height is consumed exactly');
});

test('stacked image explanations reserve their actual height before the following source row',()=>{
  const card=cardFor('figure-stack');card.mediaHeight=160;
  card.items=[{label:'上图条件',detail:'第一幅图的解释使用四行：\n保留实际比较条件。\n保留原图中的范围。\n完整文字不能覆盖下图。'},{label:'下图条件',detail:'第二幅图另有条件。'}];
  const m=measure(card),firstText=m.elements.find(e=>e.key==='item-0/detail'),secondLabel=m.elements.find(e=>e.key==='item-1/label');
  assert.ok(secondLabel.y>=firstText.y+firstText.h+18);
  assert.equal(m.images[0].h+m.images[1].h+18,card.mediaHeight,'source slot heights retain the explicit media contract');
  card.box.h=Math.ceil(m.minimumH);
  assert.deepEqual(errors(buildScenes(projectFor(card)).pages[0]),[]);
});
