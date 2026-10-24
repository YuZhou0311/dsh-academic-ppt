import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { assertProject, assertToolArgs } from '../src/schema.mjs';
import { buildScenes } from '../src/scene.mjs';
import { renderProject } from '../src/render.mjs';
import { DEFAULT_DESIGN as NEW_PROJECT_DESIGN } from '../src/core.mjs';
import { drawingAssetIds, drawingClaimIds } from '../src/native-drawing.mjs';
import { PNG, paper as sourcePaper } from './fixtures.mjs';

// All values below are synthetic compatibility fixtures, not research findings.
const clone=structuredClone;
const design=()=>({fontFamily:'Noto Sans CJK SC',palette:{ink:'#17262E',paper:'#FFFFFF',background:'#FFFFFF',accent:'#216C65',secondary:'#A34D3E',muted:'#56636B',line:'#CAD5D8',soft:'#F2F6F5',tint:'#EDF3F1'},system:{preset:'plain',header:'plain',bodySize:28,panelTitleSize:28,titleSize:44,captionSize:18},projection:{bodyMin:28,labelMin:24,noteMin:18},chrome:{header:'plain',showBrand:false,showSection:false,showPageNumber:false,showFooter:false,showSources:false,showTopRule:false}});
const slide=changes=>({id:'native',layout:'academic',title:'完整条件与原生研究关系',paperIds:[],claimIds:[],figureIds:[],cards:[],notes:'Synthetic software fixture.',seconds:60,heading:{box:{x:48,y:24,w:1184,h:60},fontSize:44},...changes});
const text=(id,value,x,y,w=400,h=38,size=28,role='body')=>({id,kind:'text',x,y,w,h,text:value,fontSize:size,role});
const drawing=(changes={})=>({id:'research',width:1184,height:500,box:{x:48,y:120,w:1184,h:500},elements:[text('condition','3/4 tests; unit retained',0,0)],...changes});
function project(s=slide({drawings:[drawing()]})){
 return {schemaVersion:1,id:'native-design-fixture',revision:0,title:'Native scientific design test',brief:{centralQuestion:'Does the export preserve supplied objects?',audience:'Software tests',talkMinutes:2,targetPaperCount:0,requireFullText:false},capabilities:{imageInput:'supported',source:'Synthetic test harness'},design:design(),papers:[],claims:[],assets:[],slides:[s]};
}
const errorCodes=p=>buildScenes(p).issues.filter(i=>i.severity==='error').map(i=>i.code);
const figure=()=>({id:'A1',data:PNG,width:100,height:100,caption:'Synthetic source image caption.',sourceUrl:'https://example.org/synthetic-figure',sourceVersion:'fixture v1',license:'Synthetic test license',usage:'figure',cropNote:'No crop',reading:{purpose:'evidence',contentType:'photo',task:'overview',verifiedBy:'human'}});

test('free native drawings retain geometry, scientific roles, exact strings and native PPTX objects',async()=>{
 const d=drawing({claimIds:['C-drawing'],elements:[
  {id:'local-group',kind:'rect',x:0,y:0,w:440,h:150,fill:'#EDF3F1',stroke:'#CAD5D8',radius:12,role:'group'},
  text('condition','3/4 tests; unit retained',16,18,400,38),
  {...text('label','Independent comparison',16,70,400,30,24,'label'),claimIds:['C-label']},
  {id:'observation',kind:'ellipse',x:500,y:12,w:24,h:24,fill:'#A34D3E',role:'data'},
  {id:'relation',kind:'line',points:[{x:440,y:126},{x:560,y:126},{x:560,y:80},{x:660,y:80}],stroke:'#216C65',strokeWidth:2.5,endArrow:true,dash:'dot',role:'relationship'},
  {id:'source',kind:'image',x:800,y:0,w:180,h:180,assetId:'A1'},
  text('note','Synthetic input only',0,200,400,24,18,'note')
 ]});
 const p=project(slide({drawings:[d]}));p.assets=[figure()];
 const before=clone(p),out=await renderProject(p),page=out.scenes.pages[0];
 assert.deepEqual(p,before,'export does not rewrite content or geometry');
 assert.deepEqual(out.issues.filter(i=>i.severity==='error'),[]);
 const n=id=>page.nodes.find(n=>n.id===`native/drawing/research/${id}`);
 assert.equal(n('condition').text,'3/4 tests; unit retained');
 assert.equal(n('condition').fontSize,28);assert.equal(n('label').fontSize,24);assert.equal(n('note').fontSize,18);
 assert.deepEqual(n('label').claimIds,['C-drawing','C-label']);
 assert.equal(n('local-group').semantic,false);assert.equal(n('observation').semantic,true);
 const lines=page.nodes.filter(n=>n.drawingElementId==='relation');
 assert.equal(lines.length,3);assert.deepEqual(lines.map(n=>n.endArrow),[false,false,true]);
 assert.deepEqual(lines.map(n=>[n.x,n.y,n.x+n.w,n.y+n.h]),[[488,246,608,246],[608,246,608,200],[608,200,708,200]]);
 assert.ok(lines.every(n=>n.role==='relationship'));
 assert.match(page.notes,/Synthetic source image caption/);assert.match(page.notes,/Synthetic test license/);
 assert.deepEqual(drawingAssetIds(p.slides[0]),['A1']);assert.deepEqual(drawingClaimIds(p.slides[0]),['C-drawing','C-label']);
 const files=unzipSync(out.pptx),xml=strFromU8(files['ppt/slides/slide1.xml']);
 assert.equal(XMLValidator.validate(xml),true);assert.equal(XMLValidator.validate(out.svgPages[0].svg),true);
 assert.equal((xml.match(/<p:pic>/g)||[]).length,1,'only the referenced source image is raster');
 for(const element of d.elements)assert.ok(xml.includes(`native/drawing/research/${element.id}`),'each input is retained as an independently named native object');
 assert.match(xml,/<a:prstGeom prst="ellipse"/);assert.match(xml,/<a:prstGeom prst="roundRect"/);
 assert.match(xml,/<a:gd name="adj" fmla="val 8000"\//,'authored corner radius retains 12 px in a 150 px high native shape');
 assert.match(xml,/<a:prstDash val="sysDot"/);assert.match(xml,/<a:tailEnd type="triangle"/);
 assert.match(xml,/flipV="1"/,'upward segment preserves direction');
 assert.match(out.svgPages[0].svg,/stroke-dasharray="2 4"/);
 const tree=new XMLParser({ignoreAttributes:false}).parse(xml),shapes=[tree['p:sld']['p:cSld']['p:spTree']['p:sp']].flat();
 const body=shapes.find(s=>s['p:nvSpPr']['p:cNvPr']['@_name']==='native/drawing/research/condition');
 assert.match(JSON.stringify(body),/2100/,'28 px remains 21 pt native body text');
});

test('projection checks final scale without replacing, truncating or shrinking source strings',()=>{
 const p=project();p.slides[0].drawings[0].box={x:48,y:120,w:592,h:250};
 const page=buildScenes(p).pages[0],n=page.nodes.find(n=>n.drawingElementId==='condition');
 assert.equal(n.fontSize,14);assert.equal(n.text,'3/4 tests; unit retained');
 assert.ok(page.issues.some(i=>i.code==='projection-font-too-small'&&i.fontSize===14&&i.minimum===28));
 delete p.design.projection;
 assert.ok(!errorCodes(p).includes('projection-font-too-small'),'missing policy remains compatible with v0.6 records');
});

test('local bounds, line endpoints, hidden labels and empty carrier are explicit errors',()=>{
 const cases=[
  [drawing({elements:[text('outside','Complete test label',1160,0,100,40)]}),'drawing-element-bounds'],
  [drawing({elements:[{id:'bad-line',kind:'line',points:[{x:10,y:10},{x:10,y:10}],role:'relationship'}]}),'drawing-line-empty-segment'],
  [drawing({elements:[{id:'bad-line',kind:'line',points:[{x:10,y:10},{x:1400,y:40}],role:'relationship'}]}),'drawing-line-bounds'],
  [drawing({elements:[text('label','Condition must remain readable',0,40,600,40),{id:'cross',kind:'line',points:[{x:10,y:60},{x:620,y:60}],role:'relationship'}]}),'drawing-line-label-overlap'],
  [drawing({elements:[{id:'empty',kind:'rect',x:0,y:0,w:400,h:300,fill:'#EDF3F1',role:'group'}]}),'drawing-empty-content'],
  [drawing({elements:[{id:'empty',kind:'rect',x:0,y:0,w:400,h:300,role:'data'}]}),'drawing-invisible-shape'],
  [drawing({elements:[{id:'missing',kind:'image',x:0,y:0,w:100,h:100,assetId:'missing'}]}),'drawing-missing-asset'],
 ];
 for(const [d,code] of cases)assert.ok(errorCodes(project(slide({drawings:[d]}))).includes(code),code);
 const overset=project(slide({drawings:[drawing({elements:[text('full','Every condition must survive export even when a box is too small.',0,0,100,35)]})]}));
 const page=buildScenes(overset).pages[0];
 assert.ok(page.issues.some(i=>i.code==='text-overflow-estimate'));
 assert.equal(page.nodes.find(n=>n.drawingElementId==='full').text,overset.slides[0].drawings[0].elements[0].text);
});

test('free regions have no compulsory card frame, title band or inner margin',()=>{
 const d=drawing();delete d.box;
 const p=project(slide({drawings:[d],composition:{regions:[{id:'research-region',title:'',heading:'hidden',padding:0,surface:'plain',box:{x:48,y:120,w:1184,h:500},drawingIds:['research']}]}}));
 const page=buildScenes(p).pages[0];assert.deepEqual(page.issues.filter(i=>i.severity==='error'),[]);
 assert.ok(!page.nodes.some(n=>n.id.includes('composition/region/research-region')),'a plain hidden-heading region does not add a decorative frame');
 const body=page.nodes.find(n=>n.drawingElementId==='condition');assert.equal(body.x,48);assert.equal(body.y,120);assert.equal(body.fontSize,28);
 const omitted=clone(p);omitted.slides[0].composition.regions[0].drawingIds=[];
 assert.ok(errorCodes(omitted).includes('unrendered-drawing'));
 const duplicate=clone(p);duplicate.slides[0].composition.regions.push({...duplicate.slides[0].composition.regions[0],id:'second',box:{x:48,y:120,w:1184,h:500}});
 assert.ok(errorCodes(duplicate).includes('composition-duplicate-reference'));
 const conflicting=clone(p);conflicting.slides[0].drawings[0].box={x:48,y:120,w:1184,h:500};
 assert.ok(errorCodes(conflicting).includes('composition-drawing-box-conflict'));
});

test('all declared payloads must have an actual consuming scene object',()=>{
 const p=project();p.assets=[figure()];
 Object.assign(p.slides[0],{figureIds:['A1'],cards:[{id:'unused',kind:'boundary',title:'Required condition',body:'Must remain visible',claimIds:[]}],chart:{kind:'bar',categories:['A'],series:[{name:'N',values:[1]}],unit:'test',sourceClaimId:'C1'},table:{columns:['A'],rows:[['B']]},nodes:[{id:'n',label:'Node'}],edges:[{from:'n',to:'n'}],referenceIds:['P1']});
 const codes=errorCodes(p);
 for(const code of ['unrendered-figure','unrendered-card','unrendered-chart','unrendered-table','unrendered-diagram-node','unrendered-diagram-edge','unrendered-reference'])assert.ok(codes.includes(code),code);
 const noBox=project();delete noBox.slides[0].drawings[0].box;
 assert.ok(errorCodes(noBox).includes('drawing-box-required'));assert.ok(errorCodes(noBox).includes('unrendered-drawing'));
});

test('full bibliographic titles and metadata reflow in free evidence regions',()=>{
 const p=project(slide({referenceIds:['P1'],composition:{regions:[{id:'bibliography',title:'',heading:'hidden',padding:0,surface:'plain',box:{x:48,y:120,w:1184,h:500},referenceIds:['P1']}]}}));
 p.papers=[{...clone(sourcePaper),title:'A complete and deliberately long scientific title: exact source identity and experimental conditions are retained across several native lines'}];
 let page=buildScenes(p).pages[0];assert.deepEqual(page.issues.filter(i=>i.severity==='error'),[]);
 const title=page.nodes.find(n=>n.role==='reference-title');assert.equal(title.text,'[1] '+p.papers[0].title);assert.equal(title.fontSize,24);assert.ok(title.lines.length>=2);
 assert.ok(page.nodes.find(n=>n.role==='citation').text.includes(p.papers[0].doi));
 const duplicate=clone(p);duplicate.slides[0].composition.regions[0].referenceIds.push('P1');assert.ok(errorCodes(duplicate).includes('composition-duplicate-reference'));
 p.slides[0].composition.regions[0].box.h=30;assert.ok(errorCodes(p).includes('references-overflow-estimate'));
 const missing=clone(p);missing.slides[0].referenceIds.push('P2');assert.ok(errorCodes(missing).includes('unrendered-reference'));
});

test('a paper heading reserves full wrapped title height before scientific content',()=>{
 const p=project(slide({layout:'paper',paperIds:['P1'],cards:[{id:'detail',kind:'setting',title:'实验单位',body:'完整保留实验条件。',claimIds:[],style:'plain'}]}));
 p.papers=[{...clone(sourcePaper),title:'A fully specified long scientific paper title about keeping independent experimental units, observation settings, sample denominators, and the original validation scope visible in an academic report'}];
 const page=buildScenes(p).pages[0],title=page.nodes.find(n=>n.id==='native/paper-title'),metadata=page.nodes.find(n=>n.id==='native/paper-bibliography'),body=page.nodes.find(n=>n.cardId==='detail'&&n.kind==='text');
 assert.equal(title.text,p.papers[0].title);assert.ok(title.lines.length>=3);assert.equal(title.fontSize,24);
 assert.ok(body.y>=metadata.y+metadata.h,'complete title and bibliography precede the following content');
 assert.ok(!page.issues.some(i=>i.code==='region-overlap'||i.code==='text-overlap-estimate'||i.code==='text-overflow-estimate'));
 p.slides[0].paperIds=[];assert.doesNotThrow(()=>buildScenes(p),'missing source diagnostics must not crash scene construction');
});

test('native image cropping preserves source bytes, viewport and explicit provenance',async()=>{
 const p=project(slide({drawings:[drawing({elements:[{id:'source',kind:'image',x:0,y:0,w:400,h:300,assetId:'A1'}]})]}));
 const source={...figure(),width:1000,height:500,viewport:{x:.25,y:0,w:.5,h:1},cropNote:'Authored test viewport'};p.assets=[source];
 const out=await renderProject(p),image=out.scenes.pages[0].nodes.find(n=>n.kind==='image');
 assert.equal(image.data,PNG);assert.deepEqual(image.viewport,source.viewport);assert.equal(image.w,image.h);
 const files=unzipSync(out.pptx),xml=strFromU8(files['ppt/slides/slide1.xml']);assert.match(xml,/<a:srcRect /);
 assert.match(out.scenes.pages[0].notes,/Authored test viewport/);
 assert.ok(Object.entries(files).filter(([name])=>name.startsWith('ppt/media/')).some(([,bytes])=>Buffer.from(bytes).equals(Buffer.from(PNG.split(',')[1],'base64'))));
 delete p.assets[0].data;assert.ok(errorCodes(p).includes('drawing-image-data'));
});

test('authored headings retain every title word and reserve a nonoverlapping body area',()=>{
 const p=project();p.slides[0].title='完整实验条件保留：\n比较单位与适用边界';p.slides[0].heading={box:{x:48,y:20,w:1184,h:108},lines:['完整实验条件保留：','比较单位与适用边界'],fontSize:44,emphasis:['适用边界']};
 p.slides[0].drawings[0].box.y=160;
 const page=buildScenes(p).pages[0],heading=page.nodes.find(n=>n.role==='title');
 assert.deepEqual(page.issues.filter(i=>i.severity==='error'),[]);assert.equal(heading.text,p.slides[0].title);assert.ok(page.contentBox.y>=heading.y+heading.h+16);
 const wrong=clone(p);wrong.slides[0].heading.lines=['Reduced title'];assert.ok(errorCodes(wrong).includes('heading-title-mismatch'));
 p.slides[0].drawings[0].box.y=90;assert.ok(errorCodes(p).includes('drawing-outside-content'));
});

test('schemas reject ambiguous composition, duplicate identities and filesystem images',()=>{
 const p=project();assertProject(p);
 const region={id:'region',title:'',heading:'hidden',padding:0,surface:'plain',box:{x:48,y:120,w:1184,h:500},drawingIds:['research']};
 const invalid=clone(p);invalid.slides[0].composition={rows:[{panels:[{id:'row',title:'Row'}]}],regions:[region]};assert.throws(()=>assertProject(invalid),/INVALID_INPUT/);
 const noMode=clone(p);noMode.slides[0].composition={lead:'A lead'};assert.throws(()=>assertProject(noMode),/INVALID_INPUT/);
 const duplicate=clone(p);duplicate.slides[0].drawings.push(clone(duplicate.slides[0].drawings[0]));assert.throws(()=>assertProject(duplicate),/DUPLICATE_ID: drawings/);
 const duplicateElement=clone(p);duplicateElement.slides[0].drawings[0].elements.push(clone(duplicateElement.slides[0].drawings[0].elements[0]));assert.throws(()=>assertProject(duplicateElement),/DUPLICATE_ID: elements/);
 const path=clone(p);path.slides[0].drawings[0].elements=[{id:'file',kind:'image',x:0,y:0,w:100,h:100,assetId:'A1',path:'../../unregistered.png'}];assert.throws(()=>assertProject(path),/INVALID_INPUT/);
 assertToolArgs('academic_ppt_study',{projectPath:'/tmp/project.json',expectedRevision:0,outputDir:'/tmp/study',candidatesPath:'/tmp/candidates.json'});
 assertToolArgs('academic_ppt_study',{projectPath:'/tmp/project.json',expectedRevision:0,outputDir:'/tmp/study',candidates:[{id:'one',label:'Comparison',slide:p.slides[0]},{id:'two',label:'Relationship',slide:p.slides[0]}]});
 assertToolArgs('academic_ppt_portfolio',{projectPaths:['/tmp/one/project.json','/tmp/two/project.json']});
});

test('projection-aware scientific plots measure labels before layout and retain smaller caption typography',()=>{
 const plot={kind:'distribution',unit:'mM',groups:[{label:'条件甲',values:[1,2,3]},{label:'条件乙',values:[2,3,4]}],sourceClaimIds:['fixture-values'],caption:'Synthetic independent observations.'};
 const p=project(slide({layout:'results',plot}));
 const page=buildScenes(p).pages[0];assert.deepEqual(page.issues.filter(i=>i.severity==='error'),[]);
 const labels=page.nodes.filter(n=>n.kind==='text'&&/^plot-/.test(n.role));
 assert.ok(labels.length>4);assert.ok(labels.every(n=>n.fontSize>=24));
 assert.equal(page.nodes.find(n=>n.role==='caption').fontSize,18);
 assert.equal(page.nodes.filter(n=>n.role==='plot-observation').length,6,'font planning preserves every individual observation');
 const composed=clone(p);composed.slides[0].layout='academic';composed.slides[0].composition={rows:[{panels:[{id:'observations',title:'保留原始观测',plot:true,surface:'plain'}]}]};
 assert.deepEqual(buildScenes(composed).issues.filter(i=>i.severity==='error'),[],'composition and scientific-plot rendering use the same policy-aware minimum measurement');
 const legacy=clone(p);delete legacy.design.projection;
 assert.equal(buildScenes(legacy).pages[0].nodes.find(n=>n.role==='plot-axis-label').fontSize,18,'old declared caption/axis tokens retain their prior behavior');
});

test('projection-aware mechanism planning keeps all authored relations and allocates full edge-label height',()=>{
 const s=slide({layout:'method',nodes:[{id:'input',label:'输入观测',detail:'保留独立单位'},{id:'test',label:'检验条件',detail:'保留适用边界'}],edges:[{from:'input',to:'test',label:'独立核验'}],diagram:{rows:[['input'],['test']],rowLabels:['输入','验证']}});
 const p=project(s),page=buildScenes(p).pages[0];assert.deepEqual(page.issues.filter(i=>i.severity==='error'),[]);
 assert.ok(page.nodes.filter(n=>n.kind==='text'&&/^diagram-/.test(n.role)).every(n=>n.fontSize>=24));
 assert.equal(page.nodes.find(n=>n.id==='native/edge:0:label').fontSize,24);
 assert.equal(page.nodes.filter(n=>n.kind==='line'&&n.endArrow).length,1);
 const auto=clone(p);delete auto.slides[0].diagram;
 assert.deepEqual(buildScenes(auto).issues.filter(i=>i.severity==='error'),[],'new automatic nodes reserve the same complete label corridors');
 const composed=clone(p);composed.slides[0].layout='academic';composed.slides[0].composition={rows:[{panels:[{id:'mechanism',title:'提供的机制关系',diagram:true,surface:'plain'}]}]};
 assert.deepEqual(buildScenes(composed).issues.filter(i=>i.severity==='error'),[]);
 const legacy=clone(p);delete legacy.design.projection;
 const old=buildScenes(legacy).pages[0];assert.equal(old.nodes.find(n=>n.id==='native/edge:0:label').fontSize,18);assert.equal(old.nodes.find(n=>n.role==='diagram-group').fontSize,22);
});

test('table cells and transcribed figure legends honor role floors during measurement',()=>{
 const p=project(slide({layout:'results',table:{columns:['变量','条件'],rows:[['A','保留完整实验单位']],'caption':'Synthetic table.'}}));p.design.projection.labelMin=30;
 let page=buildScenes(p).pages[0];assert.deepEqual(page.issues.filter(i=>i.severity==='error'),[]);assert.equal(page.nodes.find(n=>n.kind==='table').fontSize,30);
 p.slides[0]=slide({layout:'figure-focus',figureIds:['A1']});p.assets=[{...figure(),displayCaption:'Source image',displayLegend:[{label:'A',color:'#216C65'},{label:'B',color:'#A34D3E'}]}];
 page=buildScenes(p).pages[0];assert.deepEqual(page.issues.filter(i=>i.severity==='error'),[]);
 assert.ok(page.nodes.filter(n=>n.role==='figure-legend').every(n=>n.fontSize===30));assert.equal(page.nodes.find(n=>n.role==='caption').fontSize,18);
});

test('new-project headers and closing questions allocate readable default typography without changing legacy tokens',()=>{
 const s=slide({layout:'method',kicker:'保留条件、实验单位与适用范围。',nodes:[{id:'input',label:'独立观测'},{id:'test',label:'实验核验'}],edges:[{from:'input',to:'test',label:'条件一致'}]});delete s.heading;
 const p=project(s);p.design=clone(NEW_PROJECT_DESIGN);p.design.branding={label:'Research forum'};
 let page=buildScenes(p).pages[0];assert.deepEqual(page.issues.filter(i=>i.severity==='error'),[]);
 assert.equal(page.nodes.find(n=>n.id==='native/brand-label').fontSize,24);
 const kicker=page.nodes.find(n=>n.id==='native/kicker');assert.equal(kicker.fontSize,28);assert.equal(kicker.role,'subtitle');assert.ok(page.contentBox.y>=kicker.y+kicker.h);
 const legacy=clone(p);delete legacy.design.projection;
 let old=buildScenes(legacy).pages[0];assert.equal(old.nodes.find(n=>n.id==='native/brand-label').fontSize,22);assert.equal(old.nodes.find(n=>n.id==='native/kicker').fontSize,20);
 p.slides[0]=slide({layout:'closing',closing:{variant:'statement',statement:'保留完整的检验条件',question:'下一步应如何检验边界条件？'}});delete p.slides[0].heading;
 page=buildScenes(p).pages[0];assert.deepEqual(page.issues.filter(i=>i.severity==='error'),[]);assert.equal(page.nodes.find(n=>n.role==='closing-question').fontSize,28);
 const oldClosing=clone(p);delete oldClosing.design.projection;old=buildScenes(oldClosing).pages[0];assert.equal(old.nodes.find(n=>n.role==='closing-question').fontSize,26);
 p.slides[0]=slide({layout:'synthesis',subtitle:'保留问题的完整定义。',takeaway:'结论须同时保留适用条件。'});
 page=buildScenes(p).pages[0];assert.deepEqual(page.issues.filter(i=>i.severity==='error'),[]);assert.ok(page.nodes.filter(n=>['subtitle','takeaway'].includes(n.role)).every(n=>n.fontSize===28));
});

test('explicit native text and title sizes remain authored values when a projection policy rejects them',()=>{
 const p=project();p.slides[0].drawings[0].elements[0].fontSize=20;
 p.slides[0].heading.fontSize=32;p.design.projection.labelMin=36;
 const page=buildScenes(p).pages[0];assert.equal(page.nodes.find(n=>n.drawingElementId==='condition').fontSize,20);assert.equal(page.nodes.find(n=>n.role==='title').fontSize,32);
 const conflicts=page.issues.filter(i=>i.code==='projection-font-too-small');
 assert.ok(conflicts.some(i=>i.fontSize===20&&i.minimum===28));assert.ok(conflicts.some(i=>i.fontSize===32&&i.minimum===36));
});
