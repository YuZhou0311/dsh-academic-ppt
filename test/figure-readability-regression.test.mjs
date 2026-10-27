import test from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { unzipSync, strFromU8 } from 'fflate';
import { buildScenes, DEFAULT_DESIGN } from '../src/scene.mjs';
import { renderProject } from '../src/render.mjs';
import { evidenceDesignReport } from '../src/evidence-design.mjs';

// Original, deterministic calibration pixels. The two labelled sample marks
// do not reproduce a paper or make a research claim. The glyphs are 7 bitmap
// rows high, allowing an exact declared label measurement in this regression.
function calibrationPlot(labelScale=4) {
  const png=new PNG({width:512,height:512});png.data.fill(255);
  const rect=(x,y,w,h,color)=>{
    for(let py=y;py<Math.min(512,y+h);py++)for(let px=x;px<Math.min(512,x+w);px++){
      const at=(py*512+px)*4;png.data[at]=color[0];png.data[at+1]=color[1];png.data[at+2]=color[2];png.data[at+3]=255;
    }
  };
  rect(80,40,3,372,[30,45,60]);rect(80,409,360,3,[30,45,60]);
  rect(160,260,30,149,[35,85,140]);rect(310,150,30,259,[35,85,140]);
  const digits=['01110 10001 10011 10101 11001 10001 01110','00100 01100 00100 00100 00100 00100 01110'];
  digits.forEach((pattern,i)=>pattern.split(' ').forEach((row,y)=>[...row].forEach((bit,x)=>{
    if(bit==='1')rect(145+i*150+x*labelScale,420+y*labelScale,labelScale,labelScale,[25,40,55]);
  })));
  return 'data:image/png;base64,'+PNG.sync.write(png).toString('base64');
}

function fixture({task='read-values',labelPx,mediaHeight=180,labelScale=4}={}) {
  return {
    title:'Original synthetic figure sizing regression',
    brief:{visualEvidence:{mode:'source-led'}},
    design:{...structuredClone(DEFAULT_DESIGN),density:'balanced',
      system:{preset:'academic-report',header:'plain',bodySize:24,panelTitleSize:26,captionSize:18},
      chrome:{header:'plain',showBrand:false,showSection:false}},
    papers:[{id:'calibration',title:'Original software calibration, not a research article',authors:['Software fixture'],year:2026}],
    claims:[],
    assets:[{id:'plot',paperId:'calibration',figure:'Synthetic calibration',usage:'figure',provenance:'source',
      width:512,height:512,data:calibrationPlot(labelScale),displayCaption:'Original calibration image; synthetic marks.',
      reading:{purpose:'evidence',contentType:'plot',task,verifiedBy:'human',
        note:'Synthetic protocol fixture only; no real-paper review is claimed.',...(labelPx===undefined?{}:{minLabelPx:labelPx})}}],
    slides:[{id:'evidence',layout:'synthesis',title:'A large frame can hide a tiny plot',
      paperIds:['calibration'],claimIds:[],figureIds:[],
      cards:[{id:'figure',kind:'result',preset:'figure-caption',title:'Two synthetic samples',body:'',
        figureIds:['plot'],claimIds:[],mediaHeight,box:{x:80,y:145,w:520,h:500}}],
      notes:'Geometry regression only.',seconds:45}],
  };
}

test('a large editable image card cannot certify an unmeasured thumbnail for a reading task',async()=>{
  const project=fixture(),before=structuredClone(project),output=await renderProject(project);
  const page=output.scenes.pages[0],placement=page.figurePlacements[0];
  const report=evidenceDesignReport(project,output.scenes),record=report.slides[0].sourceFigures[0];
  assert.deepEqual(project,before,'reading diagnostics cannot rewrite research or design input');
  assert.ok(placement.slotBox.w>450,'the outer slot is large');
  assert.ok(placement.imageBox.h<150,'title/caption costs leave a thumbnail inside it');
  assert.equal(placement.labelStatus,'unmeasured');
  assert.ok(placement.captionHeight>0);
  assert.ok(placement.slotUtilization<.35,'slot area must not be reported as image area');
  assert.equal(record.reading.status,'unmeasured');
  assert.equal(report.summary.unverifiedReadingThumbnailCount,1);
  const blocker=report.issues.find(i=>i.code==='figure-readability-unverified');
  assert.equal(blocker?.severity,'error');
  assert.deepEqual(blocker.figures[0].imageBox,record.box);
  // Cross-check the report against real PPTX picture geometry, not just the
  // scene helper. Native text and the original source picture remain editable.
  const xml=strFromU8(unzipSync(output.pptx)['ppt/slides/slide1.xml']);
  const pic=(xml.match(/<p:pic>.*?<\/p:pic>/gs)||[])[0];
  const ext=pic.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
  assert.ok(ext);assert.ok(Math.abs(Number(ext[2])/9525-placement.imageBox.h)<.01);
  assert.ok(xml.includes('name="evidence/card/figure/title"'));
});

test('measuring a tiny plot exposes its actual label failure instead of clearing the gate by adding a field',()=>{
  const project=fixture({labelPx:28}),scenes=buildScenes(project),placement=scenes.pages[0].figurePlacements[0];
  assert.equal(placement.labelStatus,'below-floor');
  assert.ok(scenes.issues.some(i=>i.code==='figure-label-too-small'&&i.severity==='error'));
  assert.ok(placement.requiredImageAtTarget.h>placement.imageBox.h);
  const report=evidenceDesignReport(project,scenes);
  assert.ok(!report.issues.some(i=>i.code==='figure-readability-unverified'),'measurement resolves uncertainty, not the measured size failure');
  assert.equal(report.slides[0].sourceFigures[0].reading.status,'below-floor');
});

test('enlarging the actual source image recovers readable labels without changing its scientific pixels',async()=>{
  const small=fixture({labelPx:28}),large=fixture({labelPx:28,mediaHeight:400});
  assert.equal(small.assets[0].data,large.assets[0].data);
  const output=await renderProject(large),placement=output.scenes.pages[0].figurePlacements[0];
  assert.ok(placement.projectedLabelPx>=18);
  assert.equal(placement.labelStatus,'estimated-readable');
  assert.ok(!output.issues.some(i=>i.code==='figure-label-too-small'));
  const report=evidenceDesignReport(large,output.scenes);
  assert.equal(report.summary.unverifiedReadingThumbnailCount,0);
  const media=Object.entries(unzipSync(output.pptx)).filter(([path])=>/^ppt\/media\/.*\.png$/.test(path));
  assert.ok(media.some(([,bytes])=>Buffer.from(bytes).equals(Buffer.from(large.assets[0].data.split(',')[1],'base64'))));
});

test('an overview or a small source with genuinely large labels is not subject to a universal image-area quota',()=>{
  const overview=fixture({task:'overview'}),report=evidenceDesignReport(overview,buildScenes(overview));
  assert.equal(report.summary.unverifiedReadingThumbnailCount,0);
  assert.ok(!report.issues.some(i=>i.code==='figure-readability-unverified'));
  const largeLabels=fixture({labelScale:10,labelPx:70});
  const scenes=buildScenes(largeLabels),readable=evidenceDesignReport(largeLabels,scenes);
  assert.ok(readable.slides[0].sourceFigures[0].thumbnail,'the same small picture area remains');
  assert.ok(readable.slides[0].sourceFigures[0].reading.projectedLabelPx>=18);
  assert.ok(!scenes.issues.some(i=>i.code==='figure-label-too-small'));
  assert.ok(!readable.issues.some(i=>i.code==='figure-readability-unverified'));
});

test('a drawing image cannot bypass the reading gate by avoiding figure-card metadata',()=>{
  const project=fixture({task:'compare-panels'});
  const scenes={pages:[{id:'evidence',width:1280,height:720,nodes:[{
    id:'evidence/drawings/calibration/picture',kind:'image',assetId:'plot',
    x:100,y:200,w:120,h:120,data:project.assets[0].data,
  }]}]};
  project.slides[0].cards=[];
  project.slides[0].drawings=[{id:'calibration',elements:[{id:'picture',kind:'image',assetId:'plot'}]}];
  const report=evidenceDesignReport(project,scenes);
  assert.equal(report.summary.unverifiedReadingThumbnailCount,1);
  assert.ok(report.issues.some(i=>i.code==='figure-readability-unverified'));
});
