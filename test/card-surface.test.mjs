import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync,strFromU8 } from 'fflate';
import { buildScenes,DEFAULT_DESIGN,wrapText,measureTextWidth } from '../src/scene.mjs';
import { measureCardSurface } from '../src/card-surface.mjs';
import { renderProject } from '../src/render.mjs';
import { assertToolArgs } from '../src/schema.mjs';
import { PNG } from './fixtures.mjs';

const card=(id='c',extra={})=>({id,kind:'method',title:'过程与条件',body:'保留测试条件及解释。',claimIds:[],...extra});
const slide=(extra={})=>({id:'s',layout:'academic',title:'证据与更新过程',paperIds:['p'],claimIds:[],figureIds:[],cards:[card()],notes:'合成回归数据。',seconds:60,composition:{rows:[{panels:[{id:'p',title:'方法解释',surface:'plain',cardIds:['c']}]}]},...extra});
const project=(slides=[slide()])=>({title:'设计回归',design:{...structuredClone(DEFAULT_DESIGN),palette:{...DEFAULT_DESIGN.palette,soft:DEFAULT_DESIGN.palette.tint},system:{preset:'academic-report',header:'rule',panel:'tint',titleSize:40,coverTitleSize:72,bodySize:24,panelTitleSize:26,captionSize:18,sectionSize:26},cardDefaults:{surface:'outline',radius:12,padding:16,accent:'left',elevation:false}},papers:[{id:'p',title:'完整来源题名',authors:['研究者'],year:2026,doi:'10.example/source',journal:'测试来源'}],claims:[],assets:[],slides});
const errors=out=>out.issues.filter(i=>i.severity==='error');
const get=(p,suffix)=>p.nodes.find(n=>n.id.endsWith(suffix));

test('card appearance shares measurement with rendering and retains long titles, metrics and native icons',async()=>{
  const c=card('c',{title:'完整变量与重复测量的条件',body:'当前结果依赖明确的验证口径。',icon:'evidence',metric:{value:'12.5',unit:'t/ha',label:'带单位的指标',context:'同一测试条件。'},appearance:{surface:'tint',padding:20,accent:'top',radius:14}});
  const p=project([slide({cards:[c]})]);
  const out=await renderProject(p);
  assert.deepEqual(errors(out),[]);
  const page=out.scenes.pages[0],frame=get(page,'card/c/surface');
  const m=measureCardSurface(c,frame.w,{design:p.design,system:p.design.system,wrapText,measureTextWidth});
  assert.ok(m.minimumH<=frame.h);
  assert.equal(frame.radius,14); assert.equal(frame.fill,p.design.palette.tint);
  for(const suffix of ['title','metric','metric-label','metric-context','body']){
    const n=get(page,`card/c/${suffix}`);assert.ok(n);assert.ok(n.x>=frame.x+20);assert.ok(n.y+n.estimatedTextHeight<=frame.y+frame.h-19);
  }
  assert.ok(page.nodes.filter(n=>n.role==='icon').length>3);
  const xml=strFromU8(unzipSync(out.pptx)['ppt/slides/slide1.xml']);
  assert.match(xml,/<a:prstGeom prst="roundRect"/);
  assert.equal((xml.match(/<p:pic>/g)||[]).length,0,'card surfaces and icons stay editable');
});

test('per-card plain override removes the frame without deleting its content or inheriting a left accent',()=>{
  const p=project([slide({cards:[card('c',{appearance:{surface:'plain',accent:'none'}})]})]);
  const page=buildScenes(p).pages[0];
  assert.deepEqual(errors(page),[]);
  assert.equal(get(page,'card/c/surface'),undefined);assert.equal(get(page,'card/c/accent'),undefined);
  assert.equal(get(page,'card/c/body').text,'保留测试条件及解释。');
  const legacy=project();delete legacy.design.cardDefaults;
  assert.equal(get(buildScenes(legacy).pages[0],'card/c/surface'),undefined,'old projects retain their old card appearance');
});

test('native surfaces have observable boundaries and correct solid-card body ink',()=>{
  for(const surface of ['outline','tint','solid']){
    const p=project([slide({cards:[card('c',{appearance:{surface,elevation:true,radius:0}})]})]);
    const page=buildScenes(p).pages[0],frame=get(page,'card/c/surface');
    assert.deepEqual(errors(page),[]);assert.ok(frame);assert.equal(frame.radius,0);assert.ok(frame.shadow);
    assert.equal(get(page,'card/c/body').color,surface==='solid'?'#FFFFFF':p.design.palette.ink);
  }
});

test('chrome can remove repeated furniture and recovers body height while preserving source notes',()=>{
  const p=project();p.design.branding={label:'重复角标'};
  const before=buildScenes(p).pages[0];
  p.slides[0].chrome={header:'plain',showBrand:false,showSection:false,showPageNumber:false,showSources:false,showFooter:false,showTopRule:false};
  const after=buildScenes(p).pages[0];
  assert.deepEqual(errors(after),[]);
  for(const key of ['brand-label','header-rule','header-accent','page-number','top-rule','sources'])assert.equal(get(after,key),undefined,key);
  assert.ok(after.contentBox.y<before.contentBox.y);assert.ok(after.contentBox.h>before.contentBox.h+50);
  assert.match(after.notes,/完整来源题名/);
  p.slides[0].chrome={header:'plain',brandLabel:'当前章节',showBrand:true};
  assert.equal(get(buildScenes(p).pages[0],'brand-label').text,'当前章节');
  const legacy=project([slide({layout:'synthesis',composition:undefined})]);
  const old=buildScenes(legacy).pages[0];
  legacy.slides[0].chrome={header:'plain',showBrand:false,showSection:false,showPageNumber:false,showSources:false,showFooter:false};
  const recovered=buildScenes(legacy).pages[0];
  assert.deepEqual(errors(recovered),[]);
  assert.ok(recovered.contentBox.h>old.contentBox.h+50,'reclaimed height remains available for actual content');
  assert.equal(get(recovered,'card/c/surface').h,get(old,'card/c/surface').h,'short automatic text cards must not inflate to absorb the reclaimed height');
  assert.equal(get(recovered,'card/c/surface').y,recovered.contentBox.y);
});

test('split and editorial covers retain authored metadata and only accept registered context assets',()=>{
  const media={id:'context',data:PNG,width:1,height:1,caption:'语境图',sourceUrl:'https://example.org/context',sourceVersion:'v1',license:'test fixture',usage:'decorative',cropNote:'完整'};
  for(const variant of ['split','editorial']){
    const s=slide({layout:'cover',composition:undefined,cards:[],title:'遥感同化研究',cover:{variant,titleLines:['遥感同化','研究'],presenter:'报告人',affiliation:'研究机构',date:'2026年10月21日',assetId:'context',visualCaption:'经核对的语境图'},subtitle:'过程约束与验证'});
    const p=project([s]);p.assets=[media];const page=buildScenes(p).pages[0];
    assert.deepEqual(errors(page),[]);
    assert.equal(get(page,'title').text,'遥感同化\n研究');
    for(const v of ['报告人','研究机构','2026年10月21日'])assert.ok(page.nodes.some(n=>n.text===v));
    assert.equal(get(page,'cover-context').role,'context-visual');assert.match(page.notes,/https:\/\/example.org\/context/);
    p.assets[0]={...media,usage:'figure'};assert.ok(buildScenes(p).pages[0].issues.some(i=>i.code==='context-visual-source'));
  }
  const unsupported=project([slide({layout:'cover',composition:undefined,cards:[],cover:{variant:'framed',icon:'satellite'}})]);
  assert.ok(buildScenes(unsupported).pages[0].issues.some(i=>i.code==='cover-visual-layout'),'media cannot silently disappear in an incompatible cover variant');
  const optedIn=project([slide({layout:'cover',composition:undefined,cards:[],cover:{variant:'split',icon:'satellite'}})]);delete optedIn.design.system;
  assert.ok(buildScenes(optedIn).pages[0].nodes.some(n=>n.role==='icon'),'explicit new covers work on old projects without system tokens');
});

test('closing statement and evidence variants retain conclusion, question and editable supporting cards',()=>{
  for(const variant of ['statement','evidence']){
    const s=slide({layout:'closing',composition:undefined,title:'结论与下一步',cards:[card()],closing:{variant,statement:'过程改善仍需终端验证',question:'下一步怎样检验外推能力？'},chrome:{header:'plain',showBrand:false}});
    const page=buildScenes(project([s])).pages[0];assert.deepEqual(errors(page),[]);
    assert.equal(get(page,'closing-statement').text,s.closing.statement);assert.equal(get(page,'closing-question').text,s.closing.question);assert.ok(get(page,'card/c/surface'));
  }
  const s=slide({layout:'closing',closing:{variant:'statement',statement:'结论'}});
  assert.ok(buildScenes(project([s])).pages[0].issues.some(i=>i.code==='closing-composition-conflict'));
});

test('cover and closing context images preserve the authored viewport in scene geometry and PPTX crop',async()=>{
  const media={id:'context',data:PNG,width:800,height:400,caption:'合成裁切测试',sourceUrl:'https://example.org/context',sourceVersion:'v1',license:'test fixture',usage:'decorative',cropNote:'保留中间正方形',viewport:{x:.25,y:0,w:.5,h:1}};
  const covers=slide({id:'cover',layout:'cover',composition:undefined,cards:[],title:'裁切测试',cover:{variant:'split',assetId:'context'}});
  const closing=slide({id:'end',layout:'closing',composition:undefined,cards:[],title:'结论',closing:{variant:'evidence',statement:'裁切保留原始宽高比',assetId:'context'}});
  const p=project([covers,closing]);p.assets=[media];
  const out=await renderProject(p),zip=unzipSync(out.pptx);
  assert.deepEqual(errors(out),[]);
  for(let i=0;i<out.scenes.pages.length;i++){
    const node=out.scenes.pages[i].nodes.find(n=>n.role==='context-visual');
    assert.deepEqual(node.viewport,media.viewport);assert.notEqual(node.viewport,media.viewport);
    assert.equal(node.w,node.h,'the visible crop, rather than the original image, defines the aspect ratio');
    const xml=strFromU8(zip[`ppt/slides/slide${i+1}.xml`]);
    assert.match(xml,/<a:srcRect[^>]*l="25000"[^>]*r="25000"/);
  }
});

test('custom cover roles support independent geometry and reject omitted, overlapping or out-of-bounds content',()=>{
  const s=slide({layout:'cover',composition:undefined,cards:[],title:'问题与证据',subtitle:'自由分配主次关系',kicker:'研究汇报',cover:{variant:'custom',titleLines:['问题与','证据'],presenter:'报告人',affiliation:'研究机构',date:'2026年10月21日',icon:'satellite',align:'right',boxes:{title:{x:500,y:130,w:700,h:190},subtitle:{x:500,y:350,w:700,h:70},occasion:{x:500,y:50,w:700,h:40},metadata:{x:500,y:510,w:700,h:130},visual:{x:60,y:180,w:350,h:340}}}});
  const p=project([s]),page=buildScenes(p).pages[0];
  assert.deepEqual(errors(page),[]);assert.equal(get(page,'title').x,500);assert.equal(get(page,'title').align,'right');assert.equal(get(page,'title').text,'问题与\n证据');
  assert.ok(page.nodes.some(n=>n.role==='icon'));assert.ok(!page.nodes.some(n=>n.role==='decoration'));
  for(const value of [s.subtitle,s.kicker,s.cover.presenter,s.cover.affiliation,s.cover.date])assert.ok(page.nodes.some(n=>n.text===value));
  const missing=structuredClone(p);delete missing.slides[0].cover.boxes.metadata;
  assert.ok(buildScenes(missing).pages[0].issues.some(i=>i.code==='cover-role-box-missing'));
  const overlap=structuredClone(p);overlap.slides[0].cover.boxes.visual.x=550;
  assert.ok(buildScenes(overlap).pages[0].issues.some(i=>i.code==='content-region-overlap'));
  const outside=structuredClone(p);outside.slides[0].cover.boxes.visual.x=1200;
  assert.ok(buildScenes(outside).pages[0].issues.some(i=>i.code==='cover-role-box-bounds'));
  const small=structuredClone(p);small.slides[0].cover.boxes.title.h=30;
  assert.ok(buildScenes(small).pages[0].issues.some(i=>i.code==='text-overflow-estimate'));
  assert.doesNotThrow(()=>assertToolArgs('academic_ppt_record',{projectPath:'/tmp/project.json',expectedRevision:0,slides:[s]}));
});

test('public record schema exposes bounded card, chrome, cover and closing controls',()=>{
  const p=project([slide({cards:[card('c',{icon:'water',appearance:{surface:'solid',padding:24,radius:18,accent:'none'}})],chrome:{header:'plain',showBrand:false},closing:undefined})]);
  const args={projectPath:'/tmp/project.json',expectedRevision:0,design:p.design,slides:p.slides};
  assert.doesNotThrow(()=>assertToolArgs('academic_ppt_record',args));
  const bad=structuredClone(args);bad.slides[0].cards[0].icon='unregistered';
  assert.throws(()=>assertToolArgs('academic_ppt_record',bad));
  bad.slides[0].cards[0].icon='water';bad.slides[0].cards[0].appearance.padding=1;
  assert.throws(()=>assertToolArgs('academic_ppt_record',bad));
});
