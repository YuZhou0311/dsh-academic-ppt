import test from 'node:test';
import assert from 'node:assert/strict';
import {assessFigurePlacement,figureGeometry,recommendFigureLayouts} from '../src/figure-planning.mjs';
import {referenceLayouts} from '../src/reference.mjs';
import {formatToolResult} from '../src/tools.mjs';
import {assertProject,assertToolArgs} from '../src/schema.mjs';
import {evidenceIssues,DEFAULT_DESIGN} from '../src/core.mjs';
import {brief,paper,claim,asset,slides} from './fixtures.mjs';

const dense={width:685,height:1181,reading:{purpose:'evidence',contentType:'dense-multipanel',task:'read-values',panelCount:5,minLabelPx:6,requiredElements:['x axis','legend','units'],verifiedBy:'human'}};
const specimen={id:'A',usage:'figure',...dense};

test('dense source with unreadable labels remains rejected without inventing or mutating a crop',async()=>{
 const original=structuredClone(dense),advice=await referenceLayouts({category:'figure',figure:dense});
 assert.equal(advice.count,3);assert.equal(advice.figureAdvice.status,'select-panel-or-change-layout');
 assert.ok(advice.figureAdvice.candidates.every(c=>c.issues.some(i=>i.code==='figure-label-too-small'&&i.severity==='error')));
 assert.ok(advice.figureAdvice.candidates.every(c=>c.issues.some(i=>i.code==='figure-multipanel-review'&&i.severity==='warning')));
 assert.deepEqual(dense,original);assert.equal(dense.viewport,undefined);
 const text=formatToolResult('academic_ppt_reference',advice);assert.match(text,/图片适配/);assert.match(text,/关键标签/);
});

test('a complete readable four-panel comparison is reviewed rather than blocked by its panel count',()=>{
 const figure={id:'four-panels',usage:'figure',width:1200,height:600,reading:{purpose:'evidence',contentType:'dense-multipanel',task:'compare-panels',panelCount:4,minLabelPx:24,requiredElements:['common scale','panel labels','legend'],verifiedBy:'human'}};
 const original=structuredClone(figure),result=assessFigurePlacement(figure,{x:40,y:140,w:960,h:480});
 assert.equal(result.geometry.cropped,false);
 assert.ok(result.projectedLabelPx>=18);
 assert.equal(result.status,'estimated');
 assert.ok(!result.issues.some(i=>i.severity==='error'));
 assert.ok(result.issues.some(i=>i.code==='figure-multipanel-review'&&i.severity==='warning'));
 assert.deepEqual(figure,original);

 const unchecked={...figure,reading:{...figure.reading,verifiedBy:'unverified'}};
 delete unchecked.reading.minLabelPx;
 const pending=assessFigurePlacement(unchecked,{x:40,y:140,w:960,h:480});
 assert.equal(pending.status,'unverified');
 assert.ok(pending.issues.some(i=>i.code==='figure-reading-unverified'));
 assert.ok(pending.issues.some(i=>i.code==='figure-label-measurement-missing'));
});

test('projection checks measure content after contain-fit, not container width or pixel count alone',()=>{
 const box={x:0,y:0,w:680,h:440};
 const a=assessFigurePlacement(specimen,box);
 assert.ok(a.geometry.occupiedFraction<.48);
 assert.ok(a.issues.some(i=>i.code==='figure-label-too-small'));
 const upscaled={...specimen,width:6850,height:11810,reading:{...specimen.reading,minLabelPx:60}};
 const b=assessFigurePlacement(upscaled,box);
 assert.equal(a.projectedLabelPx,b.projectedLabelPx,'resampling creates no extra projected readability');
});

test('a verified independent plot panel can fit while full source bytes remain outside this geometry function',()=>{
 const panel={...specimen,viewport:{x:.02,y:.56,w:.46,h:.174},reading:{purpose:'evidence',contentType:'plot',task:'read-values',panelCount:1,minLabelPx:10,verifiedBy:'human'}};
 const a=assessFigurePlacement(panel,{x:40,y:140,w:910,h:500});
 assert.equal(a.status,'estimated');assert.ok(a.projectedLabelPx>=18);
 assert.ok(!a.issues.some(i=>i.severity==='error'));
 assert.ok(a.geometry.cropped);assert.equal(specimen.viewport,undefined);
});

test('locator role cannot be used to evade a declared quantitative reading task',()=>{
 const locator={...specimen,reading:{...specimen.reading,purpose:'locator',task:'overview'}};
 assert.ok(!assessFigurePlacement(locator,{w:120,h:220}).issues.some(i=>i.severity==='error'));
 locator.reading.task='read-values';
 assert.ok(assessFigurePlacement(locator,{w:120,h:220}).issues.some(i=>i.code==='locator-task-mismatch'));
});

test('unknown semantics remain unverified and invalid source windows are rejected',async()=>{
 const unknown={width:1200,height:800,reading:{purpose:'evidence',contentType:'unknown',task:'overview',verifiedBy:'unverified'}};
 const advice=await referenceLayouts({category:'figure',figure:unknown});
 assert.equal(advice.figureAdvice.status,'unverified');
 assert.ok(advice.figureAdvice.candidates.every(c=>c.status==='unverified'));
 assert.throws(()=>figureGeometry({...unknown,viewport:{x:.8,y:0,w:.3,h:1}},{w:300,h:200}),/INVALID_VIEWPORT/);
 assert.throws(()=>assertToolArgs('academic_ppt_reference',{figure:{...unknown,width:0}}),/INVALID_INPUT/);
});

test('content-matched advice has no more than three real catalogue candidates',()=>{
 const templates=Array.from({length:8},(_,i)=>({id:'T'+i,name:'Synthetic slot '+i,layout:'figure-focus',slots:{figures:[{x:40,y:132,w:100+i*70,h:400}]},requirements:{figures:{min:1,max:1}},figureGuidance:{contentTypes:['plot'],readingTasks:['read-values']}}));
 const f={width:900,height:500,reading:{purpose:'evidence',contentType:'plot',task:'read-values',minLabelPx:28,verifiedBy:'human'}};
 const advice=recommendFigureLayouts(f,templates);assert.equal(advice.candidates.length,3);
 assert.ok(advice.candidates.every(c=>templates.some(t=>t.id===c.templateId)));
 assert.equal(advice.candidates[0].templateId,'T7');
});

function project(){return {schemaVersion:1,id:'custom-test',revision:0,title:'Synthetic visual fixture',brief,design:structuredClone(DEFAULT_DESIGN),capabilities:{imageInput:'unknown',source:'test'},papers:[paper],claims:[claim],assets:[{...asset,width:1,height:1,sha256:'0'.repeat(64)}],slides:structuredClone(slides)};}

test('custom composition requires matching explicit boxes and rejects overlap with evidence',()=>{
 const p=project(),s=p.slides[1];s.figureBoxes=[{x:48,y:140,w:760,h:480}];s.cards[0].box={x:844,y:140,w:380,h:220};
 assert.doesNotThrow(()=>assertProject(p));
 assert.ok(!evidenceIssues(p).some(i=>i.code.startsWith('custom-')));
 s.cards[0].box.x=600;assert.ok(evidenceIssues(p).some(i=>i.code==='custom-evidence-overlap'));
 delete s.cards[0].box;assert.ok(evidenceIssues(p).some(i=>i.code==='custom-card-box-required'));
 s.referenceTemplateId='figure-wide-annotated';assert.ok(evidenceIssues(p).some(i=>i.code==='custom-reference-conflict'));
});

test('emphasis cannot introduce a word that is absent from the scientific body',()=>{
 const p=project();p.slides[0].cards[0].emphasis=['保留分母'];assert.doesNotThrow(()=>assertProject(p));
 p.slides[0].cards[0].emphasis=['significantly improved'];assert.throws(()=>assertProject(p),/INVALID_EMPHASIS/);
});


test('three custom figure pages are compared by coarse composition instead of their shared layout name',()=>{
 const p=project(),seed={...p.slides[0],layout:'figure-focus',figureBoxes:[{x:48,y:132,w:780,h:480}],figureIds:['A1'],cards:[{id:'c',kind:'result',title:'Result',body:'Synthetic fixture',claimIds:[],box:{x:870,y:132,w:350,h:200}}]};
 delete seed.referenceTemplateId;
 p.slides=[0,1,2].map(i=>({...structuredClone(seed),id:'custom'+i}));
 assert.ok(evidenceIssues(p).some(i=>i.code==='layout-repetition'));
 p.slides[2].figureBoxes=[{x:48,y:132,w:1184,h:280}];p.slides[2].cards[0].box={x:48,y:440,w:1184,h:140};
 assert.equal(evidenceIssues(p).filter(i=>i.code==='layout-repetition').length,0);
});
