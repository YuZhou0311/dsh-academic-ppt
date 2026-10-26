import test from 'node:test';
import assert from 'node:assert/strict';
import { researchEvidenceReport } from '../src/research-evidence.mjs';
import { evidenceDesignReport } from '../src/evidence-design.mjs';
import { buildScenes } from '../src/scene.mjs';
import { brief, paper, claim, asset, slides, fixtureDesign } from './fixtures.mjs';

// Every article, image and result in this file is a synthetic software fixture.
const clone=structuredClone;
const reviewed={purpose:'evidence',contentType:'plot',task:'read-values',verifiedBy:'human'};
const sourceCheck={status:'verified',checkedAt:'2026-10-26',metadataSource:'https://example.org/fixture/metadata',fullTextSource:'https://example.org/fixture/full-text',note:'Synthetic metadata and full-text record for a deterministic software test.'};
const selectedReview={status:'selected',checkedSources:['https://example.org/fixture/full-text'],note:'Reviewed the synthetic figure and its fixture caption.',candidates:[{figure:'Test image 1',locator:'fixture image 1',caption:'Synthetic software image',decision:'selected',assetId:'A1'}]};
const noSuitableReview={status:'no-suitable-figure',checkedSources:['https://example.org/fixture/full-text'],note:'The synthetic source contains an analytic proof without applicable research figures; its stated relationships are shown as an editable mechanism diagram.',candidates:[]};
function fixture(){return {schemaVersion:1,id:'research-evidence-fixture',revision:0,title:'Synthetic figure acquisition fixture',brief:{...clone(brief),visualEvidence:{mode:'source-led'}},design:clone(fixtureDesign),
  papers:[{...clone(paper),sourceCheck:clone(sourceCheck),figureReview:clone(selectedReview)}],claims:[clone(claim)],
  assets:[{...clone(asset),width:1,height:1,sha256:'0'.repeat(64),provenance:'source',reading:clone(reviewed)}],
  slides:[{...clone(slides[1]),id:'s'}]};}
const image=(assetId='A1')=>({kind:'image',assetId,x:60,y:140,w:700,h:440});
const scene=(nodes=[image()])=>({pages:[{id:'s',width:1280,height:720,nodes}]});
const errors=report=>report.issues.filter(i=>i.severity==='error');
const codes=report=>report.issues.map(i=>i.code);
const mechanism=[{kind:'text',text:'Observed input',role:'body',x:60,y:140,w:250,h:40},
  {kind:'text',text:'Validated response',role:'body',x:600,y:140,w:300,h:40},
  {kind:'line',role:'relationship',claimIds:['C1'],x:350,y:160,w:200,h:0}];

test('source-led checks bind a reviewed real scene image to the selected paper and record',()=>{
  const p=fixture(),visual=evidenceDesignReport(p,scene()),report=researchEvidenceReport(p,scene(),visual);
  assert.deepEqual(errors(report),[]);
  assert.equal(report.summary.sourceFigureCount,1);assert.equal(report.summary.selectedSourceFigureCount,1);
  assert.equal(report.summary.usedSelectedSourceFigureCount,1);assert.deepEqual(report.summary.selectedButUnusedAssetIds,[]);
  assert.equal(report.summary.coreSourceCount,1);assert.equal(report.summary.verifiedSourceCount,1);
  assert.match(report.basis,/not-independent-web-verification/);
  delete p.assets[0].provenance;
  assert.deepEqual(errors(researchEvidenceReport(p,scene())),[],'old source assets may omit provenance when the actual review is recorded');
});

test('actual renderer figure and drawing-image paths both satisfy source use',()=>{
  const p=fixture();
  const regular=researchEvidenceReport(p,buildScenes(p));
  assert.equal(regular.summary.sourceFigureCount,1);assert.deepEqual(errors(regular),[]);
  p.slides[0]={...p.slides[0],layout:'academic',figureIds:[],cards:[],drawings:[{id:'source-image',width:900,height:480,box:{x:48,y:140,w:1000,h:480},elements:[{id:'image',kind:'image',x:0,y:0,w:900,h:480,assetId:'A1'}]}]};
  const drawn=researchEvidenceReport(p,buildScenes(p));
  assert.equal(drawn.summary.sourceFigureCount,1);assert.deepEqual(errors(drawn),[]);
});

test('source-bearing closing compositions and native drawings count as actual research pages',async t=>{
  for(const variant of ['composition','drawing','drawing-with-closing-context'])await t.test(variant,()=>{
    const p=fixture();p.slides[0]={...p.slides[0],layout:'closing',cards:[]};
    if(variant==='composition')p.slides[0].composition={rows:[{panels:[{id:'final-evidence',title:'Final evidence',figureIds:['A1']}]}]};
    else {
      p.slides[0].figureIds=[];
      p.slides[0].drawings=[{id:'final-evidence',width:900,height:480,box:{x:48,y:140,w:1000,h:480},
        elements:[{id:'image',kind:'image',x:0,y:0,w:900,h:480,assetId:'A1'}]}];
      if(variant==='drawing-with-closing-context')p.slides[0].closing={variant:'statement',statement:'A source-backed closing'};
    }
    const rendered=buildScenes(p);
    assert.ok(rendered.pages[0].nodes.some(n=>n.kind==='image'&&n.assetId==='A1'));
    const visual=evidenceDesignReport(p,rendered),report=researchEvidenceReport(p,rendered,visual);
    assert.equal(visual.summary.bodySlideCount,1);assert.equal(visual.summary.sourceFigureCount,1);
    assert.equal(report.summary.usedSelectedSourceFigureCount,1);
    assert.deepEqual(report.summary.selectedButUnusedAssetIds,[]);assert.deepEqual(errors(report),[]);
  });
});

test('pure closing contexts remain administrative rather than create research-image requirements',()=>{
  const p=fixture();
  p.slides[0]={...p.slides[0],layout:'closing',title:'Thank you',figureIds:[],cards:[],claimIds:[],
    closing:{variant:'statement',statement:'Thank you for the discussion'}};
  for(const variant of ['built-in','legacy','custom-thanks']){
    if(variant!=='built-in')delete p.slides[0].closing;
    if(variant==='custom-thanks')p.slides[0].drawings=[{id:'thanks',width:900,height:360,box:{x:48,y:160,w:1000,h:360},
      elements:[{id:'text',kind:'text',x:0,y:0,w:900,h:80,text:'Thank you',fontSize:40,role:'body'}]}];
    const report=researchEvidenceReport(p,buildScenes(p));
    assert.equal(report.summary.bodySlideCount,0,variant);assert.deepEqual(errors(report),[],variant);
  }
});

test('registered or declared figures that never enter the rendered body cannot satisfy a selected source',()=>{
  const p=fixture(),report=researchEvidenceReport(p,scene([{kind:'text',text:'Only a verbal account',role:'body'}]));
  assert.ok(codes(report).includes('selected-source-figure-not-used'));
  assert.ok(codes(report).includes('source-figure-not-visible'));
  assert.deepEqual(report.summary.selectedButUnusedAssetIds,['A1']);
});

test('decorative, locator, unverified, authored and unrelated-paper images never count as source figures',async t=>{
  for(const [label,patch] of [
    ['decorative',{usage:'decorative'}],['locator',{reading:{...reviewed,purpose:'locator'}}],
    ['unverified',{reading:{...reviewed,verifiedBy:'unverified'}}],['author-created',{provenance:'author-created'}],
    ['unrelated',{paperId:'P2'}],['template-demo',{provenance:'template-demo'}],
  ])await t.test(label,()=>{
    const p=fixture();Object.assign(p.assets[0],patch);p.papers.push({...clone(paper),id:'P2'});
    const report=researchEvidenceReport(p,scene());
    assert.equal(report.summary.sourceFigureCount,0);assert.ok(codes(report).includes('source-figure-not-visible'));
    assert.ok(errors(report).length>0);
  });
});

test('off-page, hidden or pixel-less images do not satisfy actual use',async t=>{
  for(const [label,node,removePixels] of [
    ['off-page',{...image(),x:1500},false],['hidden',{...image(),semantic:false},false],
    ['zero-size',{...image(),w:0},false],['missing-pixels',image(),true],
  ])await t.test(label,()=>{
    const p=fixture();if(removePixels)delete p.assets[0].data;
    const report=researchEvidenceReport(p,scene([node]));
    assert.equal(report.summary.sourceFigureCount,0);assert.ok(codes(report).includes('selected-source-figure-not-used'));
  });
});

test('source-led requires actual source-check references and complete full-text status',async t=>{
  for(const [label,check,expected] of [
    ['absent',undefined,'source-check-required'],['partial',{...sourceCheck,status:'partial'},'source-check-incomplete'],
    ['no-full-text',{...sourceCheck,fullTextSource:''},'source-check-record-incomplete'],
    ['invalid-date',{...sourceCheck,checkedAt:'done'},'source-check-record-incomplete'],
  ])await t.test(label,()=>{
    const p=fixture();p.papers[0].sourceCheck=check;
    assert.ok(codes(researchEvidenceReport(p,scene())).includes(expected));
  });
});

test('selected candidates require the correct asset and figure identity even if another source image is visible',()=>{
  const p=fixture();p.papers[0].figureReview.candidates.push({figure:'Test image 2',locator:'fixture image 2',caption:'A second selected figure',decision:'selected',assetId:'missing'});
  let report=researchEvidenceReport(p,scene());
  assert.equal(report.summary.sourceFigureCount,1);assert.ok(codes(report).includes('selected-source-figure-asset-missing'));
  p.papers[0].figureReview.candidates[1].assetId='A1';
  report=researchEvidenceReport(p,scene());assert.ok(codes(report).includes('selected-source-figure-identity-mismatch'));
  p.papers[0].figureReview.candidates=[];
  assert.ok(codes(researchEvidenceReport(p,scene())).includes('selected-source-figure-missing'));
});

test('documented no-suitable-figure sources may use actual source-linked mechanism or table alternatives',()=>{
  const p=fixture();p.papers[0].figureReview=clone(noSuitableReview);p.assets=[];p.slides[0].figureIds=[];
  p.slides[0].layout='academic';p.slides[0].argument.role='mechanism';p.claims[0].metrics=[];
  for(const nodes of [mechanism,[{kind:'table',table:{rows:[['premise','consequence']],sourceClaimIds:['C1']},x:60,y:150,w:900,h:350}]]){
    const report=researchEvidenceReport(p,scene(nodes));
    assert.deepEqual(errors(report),[]);assert.equal(report.summary.documentedSourceFigureException,true);
    assert.ok(codes(report).includes('source-figure-documented-exception'));
  }
});

test('every no-suitable-figure core source needs its own binding to an actual scientific alternative',()=>{
  const p=fixture();p.assets=[];p.slides[0].figureIds=[];p.slides[0].cards=[];p.slides[0].layout='academic';
  p.slides[0].argument.role='mechanism';p.claims[0].metrics=[];p.papers[0].figureReview=clone(noSuitableReview);
  p.papers.push({...clone(p.papers[0]),id:'P2'});p.claims.push({...clone(p.claims[0]),id:'C2',paperId:'P2'});
  p.slides.push({...clone(p.slides[0]),id:'s2',paperIds:['P2'],claimIds:['C2']});
  const rendered={pages:[...scene(mechanism).pages,{id:'s2',nodes:[{kind:'text',role:'body',text:'A text-only account of the second source'}]}]};
  const report=researchEvidenceReport(p,rendered);
  assert.equal(report.summary.documentedSourceFigureException,false);
  assert.deepEqual(report.summary.alternativeCoveredPaperIds,['P1']);assert.deepEqual(report.summary.missingAlternativePaperIds,['P2']);
  assert.deepEqual(report.sources.find(s=>s.paperId==='P2').alternativeSlideIds,[]);
  assert.ok(codes(report).includes('source-figure-not-visible'));
});

test('one scientific synthesis may cover multiple sources only through actual carrier bindings',()=>{
  const p=fixture();p.assets=[];p.claims[0].metrics=[];p.papers[0].figureReview=clone(noSuitableReview);
  p.papers.push({...clone(p.papers[0]),id:'P2'});p.claims.push({...clone(p.claims[0]),id:'C2',paperId:'P2'});
  p.slides[0]={...p.slides[0],layout:'academic',figureIds:[],cards:[],paperIds:['P1','P2'],claimIds:['C1','C2'],
    argument:{...p.slides[0].argument,role:'mechanism'},drawings:[{id:'shared-mechanism',width:1000,height:400,
      box:{x:48,y:150,w:1000,h:400},claimIds:['C1'],elements:[
        {id:'input',kind:'text',role:'body',text:'Synthetic input',fontSize:28,x:0,y:60,w:300,h:60},
        {id:'output',kind:'text',role:'body',text:'Synthetic response',fontSize:28,x:600,y:60,w:350,h:60},
        {id:'relation',kind:'line',role:'relationship',points:[{x:320,y:90},{x:570,y:90}],endArrow:true},
      ]}]};
  let report=researchEvidenceReport(p,buildScenes(p));
  assert.equal(report.summary.documentedSourceFigureException,false,'page citations do not automatically bind every carrier to both papers');
  assert.deepEqual(report.summary.missingAlternativePaperIds,['P2']);
  p.slides[0].drawings[0].claimIds.push('C2');
  report=researchEvidenceReport(p,buildScenes(p));
  assert.equal(report.summary.documentedSourceFigureException,true);assert.deepEqual(errors(report),[]);
  assert.deepEqual(new Set(report.summary.alternativeCoveredPaperIds),new Set(['P1','P2']));
  assert.deepEqual(report.summary.missingAlternativePaperIds,[]);
  assert.ok(report.sources.every(source=>source.alternativeSlideIds.length===1&&source.alternativeSlideIds[0]==='s'));
  p.assets=[{...clone(asset),provenance:'author-created',reading:{...reviewed,contentType:'diagram'},width:1,height:1}];
  p.slides[0].drawings[0].elements=[{id:'synthesis-image',kind:'image',x:0,y:0,w:1000,h:400,assetId:'A1'}];
  report=researchEvidenceReport(p,buildScenes(p));
  assert.equal(report.summary.sourceFigureCount,0,'an authored scientific synthesis remains distinct from a paper original');
  assert.equal(report.summary.documentedSourceFigureException,true,'an explicitly source-bound authored synthesis can also carry both sources');
  assert.deepEqual(report.summary.missingAlternativePaperIds,[]);assert.deepEqual(errors(report),[]);
});

test('a generic no-figure claim or a text-only replacement does not unlock the exception',()=>{
  const p=fixture();p.assets=[];p.slides[0].figureIds=[];p.papers[0].figureReview=clone(noSuitableReview);
  let report=researchEvidenceReport(p,scene([{kind:'text',text:'All results are summarized in words',role:'body'}]));
  assert.equal(report.summary.documentedSourceFigureException,false);assert.ok(codes(report).includes('source-figure-not-visible'));
  p.papers[0].figureReview.note='无图';p.papers[0].figureReview.checkedSources=[];
  report=researchEvidenceReport(p,scene(mechanism));
  assert.equal(report.summary.documentedSourceFigureException,false);
  assert.ok(codes(report).includes('source-figure-exception-too-thin'));assert.ok(codes(report).includes('source-figure-review-incomplete'));
});

test('unavailable figures remain an explicit gap rather than a no-suitable-figure exception',()=>{
  const p=fixture();p.assets=[];p.slides[0].figureIds=[];p.papers[0].figureReview={...clone(noSuitableReview),status:'unavailable',note:'The publisher page and the legal author manuscript did not expose the original figure asset in this test scenario.'};
  const report=researchEvidenceReport(p,scene(mechanism));
  assert.equal(report.summary.documentedSourceFigureException,false);assert.ok(codes(report).includes('source-figure-not-visible'));
  assert.ok(codes(report).includes('source-figure-acquisition-unavailable'));
});

test('non-selected candidate reasons are substantive and review status cannot conceal a selected figure',()=>{
  const p=fixture();p.papers[0].figureReview.candidates.push({figure:'Test image 2',locator:'fixture image 2',caption:'Another fixture image',decision:'not-used',reason:'无关'});
  assert.ok(codes(researchEvidenceReport(p,scene())).includes('source-figure-candidate-reason-missing'));
  p.papers[0].figureReview.status='no-suitable-figure';
  assert.ok(codes(researchEvidenceReport(p,scene())).includes('source-figure-review-conflict'));
});

test('flexible and legacy projects remain readable without pretending the source checks were completed',()=>{
  const p=fixture();delete p.papers[0].sourceCheck;delete p.papers[0].figureReview;p.assets=[];p.slides[0].figureIds=[];
  p.brief.visualEvidence={mode:'flexible',reason:'This synthetic fixture tests legacy protocol behavior only.'};
  let report=researchEvidenceReport(p,scene(mechanism));
  assert.equal(errors(report).length,0);assert.equal(report.summary.verifiedSourceCount,0);
  delete p.brief.visualEvidence;
  report=researchEvidenceReport(p,scene(mechanism));
  assert.equal(errors(report).length,0);assert.ok(codes(report).includes('visual-evidence-policy-missing'));
});

test('administrative and bibliography-only pages do not trigger research-image quotas',()=>{
  const p=fixture();p.slides=[{...p.slides[0],layout:'references',figureIds:[],cards:[]}];
  const report=researchEvidenceReport(p,scene());
  assert.equal(report.summary.bodySlideCount,0);assert.equal(report.summary.coreSourceCount,0);assert.deepEqual(errors(report),[]);
});

test('source-led has no fixed per-page image quota while exposing a low-coverage text sequence',()=>{
  const p=fixture();p.slides.push(...[2,3,4,5].map(i=>({...clone(p.slides[0]),id:'s'+i,figureIds:[],layout:'synthesis'})));
  const allScenes={pages:[...scene().pages,...p.slides.slice(1).map(s=>({id:s.id,nodes:[{kind:'text',role:'body',text:'A source-backed synthesis paragraph'}]}))]};
  const visual=evidenceDesignReport(p,allScenes),report=researchEvidenceReport(p,allScenes,visual);
  assert.deepEqual(errors(report),[]);assert.equal(report.summary.sourceFigureSlideCoverage,.2);
  assert.ok(visual.issues.some(i=>i.code==='consecutive-text-only-pages'));
});

test('research progress based on non-article sources uses real scientific carriers without inventing a paper figure requirement',async t=>{
  for(const sourceType of ['dataset','report','protocol','thesis'])await t.test(sourceType,()=>{
    const p=fixture();p.papers[0].sourceType=sourceType;delete p.papers[0].sourceCheck;delete p.papers[0].figureReview;
    p.assets=[];p.slides[0].figureIds=[];p.slides[0].chart={kind:'bar',categories:['fixture A','fixture B'],series:[{name:'fixed values',values:[3,4]}],unit:'items',sourceClaimId:'C1'};
    const report=researchEvidenceReport(p,scene([{kind:'chart',x:60,y:160,w:900,h:440,chart:p.slides[0].chart}]));
    assert.equal(report.summary.coreSourceCount,0);assert.equal(report.summary.sourceFigureRequirement,'scientific-carriers');
    assert.deepEqual(errors(report),[]);assert.ok(!codes(report).includes('source-figure-not-visible'));
    assert.ok(codes(researchEvidenceReport(p,scene([{kind:'text',role:'body',text:'A paragraph about this data'}]))).includes('scientific-visual-not-visible'));
  });
});

test('the no-suitable-paper-figure exception cannot borrow an unrelated report chart',()=>{
  const p=fixture();p.assets=[];p.slides[0].figureIds=[];p.papers[0].figureReview=clone(noSuitableReview);
  p.papers.push({...clone(paper),id:'R',sourceType:'report'});p.claims.push({...clone(claim),id:'RC',paperId:'R'});
  p.slides.push({...clone(p.slides[0]),id:'report-page',paperIds:['R'],claimIds:['RC'],cards:[]});
  const allScenes={pages:[{id:'s',nodes:[{kind:'text',role:'body',text:'An analytic account of the article'}]},
    {id:'report-page',nodes:[{kind:'chart',x:60,y:160,w:900,h:400,chart:{series:[{values:[3,4]}]}}]}]};
  const report=researchEvidenceReport(p,allScenes);
  assert.equal(report.summary.documentedSourceFigureException,false);assert.ok(codes(report).includes('source-figure-not-visible'));
  p.assets=[{...clone(asset),id:'report-image',paperId:'R',reading:clone(reviewed),provenance:'source'}];
  p.slides[1].figureIds=['report-image'];allScenes.pages[1].nodes=[image('report-image')];
  const reportImage=researchEvidenceReport(p,allScenes);
  assert.equal(reportImage.summary.sourceFigureCount,1);assert.equal(reportImage.summary.coreSourceFigureCount,0);
  assert.ok(codes(reportImage).includes('source-figure-not-visible'),'a report image does not fulfil the unrelated core paper figure requirement');
});
