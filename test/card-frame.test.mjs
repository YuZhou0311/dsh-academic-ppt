import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { CARD_PRESETS, getCardPreset } from '../src/card-catalog.mjs';
import { measureCardSurface } from '../src/card-surface.mjs';
import { DEFAULT_DESIGN, buildScenes, wrapText, measureTextWidth } from '../src/scene.mjs';
import { renderProject, sceneToSvg } from '../src/render.mjs';
import { assertToolArgs } from '../src/schema.mjs';
import { cardDemoAssets } from '../scripts/card-demo-assets.mjs';
import { renderDeck } from '../src/vendor/dsh-ppt-render.mjs';
import { fitImageCardToHeight } from '../src/image-card-surface.mjs';

// These authored values verify rendering fidelity, never scientific findings.
const clone=structuredClone;
const design={...clone(DEFAULT_DESIGN),palette:{...DEFAULT_DESIGN.palette,soft:DEFAULT_DESIGN.palette.tint},
  system:{preset:'academic-report',header:'rule',panel:'tint',titleSize:40,coverTitleSize:72,bodySize:24,panelTitleSize:26,captionSize:18,sectionSize:26}};
const shadow={color:'#15283D',opacity:.12,blur:3,offset:2,angle:90};
const dashed={fill:'none',stroke:'#42566C',strokeWidth:1.4,dash:'dash',shadow:false};
const paper={fill:'#FFFFFF',stroke:'#9DAAB8',strokeWidth:1.1,dash:'solid',shadow};
const measure=(c,w)=>{
  const settings={design,system:design.system,wrapText,measureTextWidth},m=measureCardSurface(c,w,settings);
  return m?.imageCard?fitImageCardToHeight(c,{w,h:540},{assets:cardDemoAssets(),papers:[]},settings,m):m;
};
function card(preset,appearance){
  const c=preset?clone(getCardPreset(preset).example):{id:'generic',kind:'method',title:'完整测试条件',body:'固定软件输入，不含研究结论。',claimIds:[]};
  if(appearance)c.appearance=clone(appearance);
  const w=preset?getCardPreset(preset).dimensions.preferredWidth:560;
  c.box={x:80,y:130,w,h:Math.ceil(measure(c,w)?.minimumH??180)};return c;
}
const slide=(c,i=0)=>({id:`frame-${i+1}`,layout:'synthesis',title:'边界与证据表面',paperIds:[],claimIds:[],figureIds:[],cards:c?[c]:[],notes:'Synthetic frame-rendering fixture.',seconds:30});
const project=cards=>({title:'Editable frame test',design:clone(design),papers:[],claims:[],assets:cardDemoAssets(),slides:cards.map(slide)});
const errors=page=>page.issues.filter(i=>i.severity==='error');
const named=(page,id)=>page.nodes.find(n=>n.id.endsWith(id));
const parser=new XMLParser({ignoreAttributes:false});
const xmlShapes=xml=>[parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']].flat();
const xmlShape=(xml,id)=>xmlShapes(xml).find(s=>s['p:nvSpPr']['p:cNvPr']['@_name']===id);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('public frame and drawing shadow contracts accept exact paint and reject ambiguous or unbounded inputs',()=>{
  const c=card('research-tab',paper),s=slide(c);
  s.drawings=[{id:'d',width:300,height:120,box:{x:800,y:130,w:300,h:120},elements:[{id:'panel',kind:'rect',x:0,y:0,w:300,h:120,fill:'#FFFFFF',stroke:'none',dash:'solid',shadow:{...shadow,opacity:0,blur:0,offset:0,angle:0},role:'data'}]}];
  const args={projectPath:'/tmp/frame-test.json',expectedRevision:0,slides:[s]};
  assert.doesNotThrow(()=>assertToolArgs('academic_ppt_record',args));
  assert.doesNotThrow(()=>assertToolArgs('academic_ppt_record',{...args,design:{...design,cardDefaults:dashed}}));
  const invalid=[
    {fill:'white'},{fill:'transparent'},{stroke:'rgb(1,2,3)'},{strokeWidth:0},{strokeWidth:6.1},{dash:'dashed'},
    {shadow:true},{shadow:{...shadow,color:'none'}},{shadow:{...shadow,opacity:.401}},{shadow:{...shadow,opacity:-.01}},
    {shadow:{...shadow,blur:32.1}},{shadow:{...shadow,offset:24.1}},{shadow:{...shadow,angle:360}},
    {shadow:{...shadow,type:'outer'}},{shadow:{color:'#15283D',opacity:.12,blur:3,offset:2}},
  ];
  for(const bad of invalid){const a=clone(args);a.slides[0].cards[0].appearance=bad;assert.throws(()=>assertToolArgs('academic_ppt_record',a),/INVALID_INPUT/,JSON.stringify(bad));}
  for(const bad of [{opacity:.5},{blur:-1},{offset:25},{angle:360}]){
    const a=clone(args);Object.assign(a.slides[0].drawings[0].elements[0].shadow,bad);assert.throws(()=>assertToolArgs('academic_ppt_record',a),/INVALID_INPUT/);
  }
  const wrongKind=clone(args);wrongKind.slides[0].drawings[0].elements=[{id:'line',kind:'line',points:[{x:0,y:0},{x:100,y:0}],role:'relationship',shadow}];
  assert.throws(()=>assertToolArgs('academic_ppt_record',wrongKind),/INVALID_INPUT/,'shadow is bounded to rect/ellipse rather than silently ignored on lines');
});

test('plain remains unframed by default but explicit paint creates a real frame; transparent dashed defaults do not elevate',()=>{
  const plain=card(undefined,{surface:'plain',accent:'none',elevation:true});
  const baseline=buildScenes(project([plain])).pages[0];assert.equal(named(baseline,'/surface'),undefined);
  const framed=clone(plain);framed.appearance={...plain.appearance,...dashed};
  const frame=named(buildScenes(project([framed])).pages[0],'/surface');
  assert.equal(frame.fill,'none');assert.equal(frame.stroke,dashed.stroke);assert.equal(frame.strokeWidth,1.4);assert.equal(frame.dash,'dash');assert.equal(frame.shadow,undefined);
  const inherited=project([card(undefined,{fill:'none',dash:'dot'})]);inherited.design.cardDefaults={surface:'outline',elevation:true};
  const transparent=named(buildScenes(inherited).pages[0],'/surface');assert.equal(transparent.fill,'none');assert.equal(transparent.shadow,undefined);
  const disabled=card(undefined,{...paper,elevation:true,shadow:false});assert.equal(named(buildScenes(project([disabled])).pages[0],'/surface').shadow,undefined);
  const visible=card(undefined,{surface:'plain',...paper});assert.deepEqual(named(buildScenes(project([visible])).pages[0],'/surface').shadow,shadow);
  const impossible=card(undefined,{surface:'plain',shadow});assert.ok(errors(buildScenes(project([impossible])).pages[0]).some(i=>i.code==='card-shadow-needs-surface'));
});

test('all 48 presets retain their exact text and scientific image geometry when frame paint changes',()=>{
  for(const preset of CARD_PRESETS){
    const baseline=buildScenes(project([card(preset.id)])).pages[0];
    for(const appearance of [dashed,paper]){
      const styled=buildScenes(project([card(preset.id,appearance)])).pages[0];
      assert.deepEqual(errors(styled),[],preset.id);
      const content=page=>page.nodes.filter(n=>n.kind==='text'||n.kind==='image').map(n=>({id:n.id,kind:n.kind,x:n.x,y:n.y,w:n.w,h:n.h,text:n.text,lines:n.lines,fontSize:n.fontSize,data:n.data,viewport:n.viewport,source:n.source}));
      assert.deepEqual(content(styled),content(baseline),`${preset.id}: paint cannot rearrange or replace evidence`);
      assert.ok(!styled.issues.some(i=>i.code==='card-preset-appearance-review'),preset.id);
      if(appearance===dashed){
        assert.ok(styled.nodes.some(n=>n.cardId&&n.stroke===dashed.stroke&&n.dash==='dash'),`${preset.id}: authored boundary is visible`);
        assert.ok(!styled.nodes.some(n=>n.cardId&&n.shadow),preset.id);
      }else assert.ok(styled.nodes.some(n=>n.cardId&&n.shadow?.opacity===shadow.opacity),`${preset.id}: authored paper shadow is visible`);
      // A recipe's tab, ribbon, fold, double frame and interior separators keep
      // their original bounding boxes. New background paint does not replace them.
      for(const n of baseline.nodes.filter(n=>n.cardId&&n.kind!=='text'&&n.kind!=='image')){
        const next=styled.nodes.find(s=>s.id===n.id);
        assert.ok(next,`${preset.id}: ${n.id} remains an editable contour or decoration`);
        assert.deepEqual([next.kind,next.x,next.y,next.w,next.h],[n.kind,n.x,n.y,n.w,n.h],`${preset.id}: ${n.id}`);
      }
    }
  }
});

test('preset defaults apply paint without flattening tab, open-rule or double-frame geometry',()=>{
  // The double recipe can be discovered by its declared structure, independent
  // of future display-name changes.
  const presets=['research-tab','research-bracket','metric-ledger',CARD_PRESETS.find(p=>p.recipe.frame==='double').id];
  const p=project(presets.map(id=>card(id)));p.design.cardDefaults={...paper,padding:12,layout:'banded'};
  for(const page of buildScenes(p).pages){
    assert.deepEqual(errors(page),[]);
    assert.ok(page.nodes.some(n=>n.cardId&&n.fill===paper.fill&&n.shadow));
  }
  const pages=buildScenes(p).pages;
  assert.ok(pages[0].nodes.some(n=>n.id.endsWith('/heading-tab')));
  assert.ok(pages[1].nodes.some(n=>n.id.endsWith('/bracket-left-top')));
  assert.equal(named(pages[2],'/surface').stroke,'none','an open ruled recipe retains its open sides');
  assert.equal(named(pages[3],'/double-frame').fill,'none','explicit paper fill cannot close the inset double frame');
  const noStroke=project([card('research-bracket',{fill:'none',stroke:'none',shadow:false})]);
  assert.ok(!buildScenes(noStroke).pages[0].nodes.some(n=>n.id.includes('/bracket-')));
});

test('PPTX and SVG carry true noFill, exact line width and dash, outer shadow, and unchanged scientific image bytes',async()=>{
  const out=await renderProject(project([card(undefined,{surface:'plain',...dashed}),card('research-tab',paper),card('figure-caption',dashed)]));
  const zip=unzipSync(out.pptx);
  for(const [i,page]of out.scenes.pages.entries()){
    assert.deepEqual(errors(page),[]);
    const xml=strFromU8(zip[`ppt/slides/slide${i+1}.xml`]);assert.equal(XMLValidator.validate(xml),true);assert.equal(XMLValidator.validate(out.svgPages[i].svg),true);
    const frame=named(page,'/surface'),shape=xmlShape(xml,frame.id),properties=shape['p:spPr'];
    assert.ok(shape,'surface is an independently editable shape');
    assert.equal(properties['a:ln']['@_w'],String(Math.round(frame.strokeWidth*9525)));
    assert.equal(properties['a:ln']['a:solidFill']['a:srgbClr']['@_val'],frame.stroke.slice(1));
    if(i===1){
      const effect=properties['a:effectLst']['a:outerShdw'];
      assert.equal(effect['@_blurRad'],'28575');assert.equal(effect['@_dist'],'19050');assert.equal(effect['@_dir'],'5400000');
      assert.equal(effect['a:srgbClr']['@_val'],'15283D');assert.equal(effect['a:srgbClr']['a:alpha']['@_val'],'12000');
    }else {
      assert.ok(Object.hasOwn(properties,'a:noFill'),'a transparent frame must not inherit the theme fill');
      assert.equal(properties['a:solidFill'],undefined);assert.equal(properties['a:effectLst'],undefined);
      assert.equal(properties['a:ln']['a:prstDash']['@_val'],'dash');
      const tag=out.svgPages[i].svg.match(new RegExp(`<rect\\b[^>]*data-object-id="${frame.id}"[^>]*/>`))?.[0];
      assert.match(tag,/fill="none"/);assert.match(tag,/stroke-dasharray="7 5"/);
    }
  }
  const image=out.scenes.pages[2].nodes.find(n=>n.kind==='image'),xml=strFromU8(zip['ppt/slides/slide3.xml']);
  const picture=(xml.match(/<p:pic>[\s\S]*?<\/p:pic>/g)||[]).find(pic=>pic.includes(`name="${image.id}"`));
  const relId=picture.match(/r:embed="([^"]+)"/)[1],rels=strFromU8(zip['ppt/slides/_rels/slide3.xml.rels']);
  const relation=(rels.match(/<Relationship\b[^>]*\/>/g)||[]).find(rel=>rel.includes(`Id="${relId}"`));
  const target=relation.match(/Target="([^"]+)"/)[1].replace(/^\.\.\//,'ppt/');
  assert.equal(hash(zip[target]),hash(Buffer.from(image.data.split(',')[1],'base64')));
});

test('native drawing shadows scale uniformly and export authored zero values and fractional angles exactly',async()=>{
  const p=project([]),s=slide(null);p.slides=[s];
  s.drawings=[{id:'shadow-test',width:800,height:320,box:{x:80,y:180,w:1000,h:400},elements:[
    {id:'zero',kind:'rect',x:20,y:20,w:200,h:160,fill:'#FFFFFF',stroke:'none',shadow:{color:'#15283D',opacity:0,blur:0,offset:0,angle:0},role:'data'},
    {id:'paper',kind:'ellipse',x:300,y:20,w:200,h:160,fill:'#FFFFFF',stroke:'#42566C',dash:'solid',shadow:{...shadow,angle:12.5},role:'data'},
    {id:'plain',kind:'rect',x:580,y:20,w:180,h:160,fill:'none',stroke:'#42566C',dash:'dot',shadow:false,role:'data'}
  ]}];
  const before=clone(p),out=await renderProject(p),page=out.scenes.pages[0],xml=strFromU8(unzipSync(out.pptx)['ppt/slides/slide1.xml']);
  assert.deepEqual(p,before);assert.deepEqual(errors(page),[]);assert.equal(XMLValidator.validate(xml),true);
  const zero=named(page,'/zero'),scaled=named(page,'/paper');
  assert.deepEqual(zero.shadow,{color:'#15283D',opacity:0,blur:0,offset:0,angle:0});
  assert.equal(scaled.shadow.blur,3.75);assert.equal(scaled.shadow.offset,2.5);assert.equal(scaled.shadow.angle,12.5);
  const z=xmlShape(xml,zero.id)['p:spPr'];assert.ok(Object.hasOwn(z['a:ln'],'a:noFill'),'no outline is native noFill, not a transparent white line');
  const zs=z['a:effectLst']['a:outerShdw'];
  for(const attribute of ['blurRad','dist','dir'])assert.equal(zs[`@_${attribute}`],'0',attribute);
  assert.equal(zs['a:srgbClr']['a:alpha']['@_val'],'0');
  const ps=xmlShape(xml,scaled.id)['p:spPr']['a:effectLst']['a:outerShdw'];
  assert.equal(ps['@_blurRad'],String(Math.round(3.75*9525)));assert.equal(ps['@_dist'],String(Math.round(2.5*9525)));assert.equal(ps['@_dir'],'750000');
  assert.match(out.svgPages[0].svg,/<feDropShadow dx="0" dy="0" stdDeviation="0" flood-color="#15283D" flood-opacity="0"\/>/);
  assert.equal(named(page,'/plain').shadow,undefined);assert.ok(!xml.includes('<p:pic>'),'all authored frame shapes remain native');
});

test('bounded blur on a thin native band is not clipped by SVG percentage filter bounds',()=>{
  const svg=sceneToSvg({id:'thin-shadow',title:'Synthetic filter bounds',background:'#FFFFFF',nodes:[{id:'band',kind:'rect',x:150,y:150,w:300,h:12,fill:'#FFFFFF',stroke:'#42566C',strokeWidth:2,shadow:{color:'#15283D',opacity:.08,blur:32,offset:24,angle:90}}]});
  const filter=parser.parse(svg).svg.defs.filter;
  assert.equal(filter['@_filterUnits'],'userSpaceOnUse');
  assert.ok(Number(filter['@_y'])<=150-96);assert.ok(Number(filter['@_y'])+Number(filter['@_height'])>=162+24+96);
  assert.equal(filter.feDropShadow['@_stdDeviation'],'32');
});

test('explicit fill uses readable foreground on its actual backing while independent tabs and default colors remain intact',async()=>{
  const white=card(undefined,{surface:'solid',fill:'#FFFFFF',stroke:'#224466',shadow:false});
  const dark=card(undefined,{surface:'outline',fill:'#142840',stroke:'#224466',shadow:false});
  const tab=card('research-tab',{fill:'#142840',shadow:false});
  const figure=card('figure-caption',{fill:'#142840',shadow:false});
  const out=await renderProject(project([white,dark,tab,figure])),zip=unzipSync(out.pptx);
  for(const [i,page]of out.scenes.pages.entries()){
    assert.deepEqual(errors(page),[]);
    const body=named(page,'/body');assert.equal(body.color,i===0?design.palette.ink:'#FFFFFF');
    const native=xmlShape(strFromU8(zip[`ppt/slides/slide${i+1}.xml`]),body.id);
    assert.ok(JSON.stringify(native).includes(`"@_val":"${body.color.slice(1)}"`),'actual native text uses the readable foreground');
  }
  const title=page=>page.nodes.find(n=>n.cardId&&n.id.endsWith('/title'));
  assert.equal(title(out.scenes.pages[2]).color,design.palette.accent,'the dark body does not invert the independent white title tab');
  assert.ok(out.scenes.pages[3].nodes.filter(n=>n.role==='caption').every(n=>n.color==='#FFFFFF'),'a scientific caption on the dark card is also readable');
  const inherited=project([card(undefined,{surface:'outline',fill:'none',shadow:false})]);inherited.design.palette.background='#142840';
  assert.equal(named(buildScenes(inherited).pages[0],'/body').color,'#FFFFFF','none inherits the real page background rather than becoming white');
  const transparentTab=project([card('research-tab',{fill:'none',shadow:false})]);transparentTab.design.palette.background='#142840';
  const page=buildScenes(transparentTab).pages[0];assert.equal(named(page,'/body').color,'#FFFFFF');assert.equal(title(page).color,design.palette.accent);
  const legacy=buildScenes(project([card('research-tab')])).pages[0];assert.equal(named(legacy,'/body').color,design.palette.ink);assert.equal(title(legacy).color,design.palette.accent);
  const tightCut=buildScenes(project([card('boundary-cut',{fill:'#142840',padding:12,shadow:false})])).pages[0];
  assert.equal(title(tightCut).color,'#FFFFFF','unused text-slot corner space must not make a dark cut face look like the white page behind it');
});

test('cut and fold surfaces export one closed editable contour with the complete diagonal triangle and one shadow',async()=>{
  const cards=['boundary-cut','research-fold','metric-target'].map(id=>{
    const c=card(id,{fill:'#DCE8F4',stroke:'#224466',strokeWidth:1.5,shadow:{color:'#000000',opacity:.3,blur:0,offset:8,angle:0}});
    c.box={x:80,y:140,w:560,h:Math.ceil(measure(c,560).minimumH)};return c;
  });
  const out=await renderProject(project(cards)),zip=unzipSync(out.pptx);
  for(const [i,page]of out.scenes.pages.entries()){
    assert.deepEqual(errors(page),[]);
    const surface=named(page,'/surface'),xml=strFromU8(zip[`ppt/slides/slide${i+1}.xml`]),shape=xmlShape(xml,surface.id),props=shape['p:spPr'];
    assert.equal(page.nodes.filter(n=>n.cardId&&n.shadow).length,1);assert.equal((xml.match(/<a:outerShdw\b/g)||[]).length,1);
    assert.ok(props['a:custGeom'],'surface is native editable geometry, not a picture');assert.equal(props['a:prstGeom'],undefined);
    const path=props['a:custGeom']['a:pathLst']['a:path'];assert.ok(Object.hasOwn(path,'a:close'));
    const points=[path['a:moveTo'],...[path['a:lnTo']].flat()].map(p=>({x:Number(p['a:pt']['@_x'])/9525,y:Number(p['a:pt']['@_y'])/9525}));
    const area=Math.abs(points.reduce((sum,p,j)=>{const q=points[(j+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
    assert.equal(area,surface.w*surface.h-26*26/2,'only the outer cut triangle is removed; the inner diagonal triangle remains filled');
    const point={x:627-surface.x,y:160-surface.y};
    assert.ok(points.every((p,j)=>{const q=points[(j+1)%points.length];return (q.x-p.x)*(point.y-p.y)-(q.y-p.y)*(point.x-p.x)>=0;}),'the reported missing point is inside the exported native contour');
    assert.equal(props['a:solidFill']['a:srgbClr']['@_val'],'DCE8F4');
    assert.match(out.svgPages[i].svg,/<polygon\b[^>]*points="80,140 614,140 640,166 640,[\d.]+ 80,[\d.]+"/);
    assert.equal((xml.match(/<p:pic>/g)||[]).length,0);
    if(cards[i].preset==='research-fold')assert.ok(named(page,'/fold-left')&&named(page,'/fold-bottom'),'fold annotations retain their own editable lines');
  }
});

test('actual native PPTX pixels preserve cut/fold fill, continuous single shadow and readable explicit surfaces',{timeout:180000},async t=>{
  const testRoot=resolve('.test-output');await mkdir(testRoot,{recursive:true});
  const cwd=await mkdtemp(join(testRoot,'card-frame-render-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
  const p=project([]);p.assets=[];p.design.fontFamily='DejaVu Sans';
  Object.assign(p.design.palette,{ink:'#17263E',paper:'#FFFFFF',background:'#FFFFFF',accent:'#224466'});
  p.design.chrome={header:'plain',showBrand:false,showSection:false,showPageNumber:false,showFooter:false,showSources:false,showTopRule:false};
  const basic=(id,appearance,box)=>({id,kind:'method',title:id==='white'?'Authored white fill':'Authored dark fill',body:'Complete text stays readable.\nSynthetic software fixture.',claimIds:[],appearance,box});
  const contours=['boundary-cut','research-fold'].map((preset,i)=>({id:`contour-${i}`,preset,kind:'method',title:'Editable contour',body:'Synthetic geometry, not research.',claimIds:[],
    appearance:{fill:'#DCE8F4',stroke:'#224466',strokeWidth:1.5,shadow:{color:'#000000',opacity:.3,blur:0,offset:8,angle:0}},box:{x:80,y:140,w:560,h:280}}));
  p.slides=[{...slide(null),title:'Explicit fill readability',cards:[basic('white',{surface:'solid',fill:'#FFFFFF',stroke:'#224466',shadow:false},{x:80,y:140,w:520,h:240}),basic('dark',{surface:'outline',fill:'#142840',stroke:'#224466',shadow:false},{x:680,y:140,w:520,h:240})]},...contours.map((c,i)=>({...slide(c,i+1),title:'Closed contour and one shadow'}))];
  const out=await renderProject(p);assert.deepEqual(out.issues.filter(i=>i.severity==='error'),[]);
  const pptxPath=join(cwd,'frames.pptx');await writeFile(pptxPath,out.pptx);
  const rendered=await renderDeck({pptxPath,outputDir:join(cwd,'render'),format:'png',width:1920,timeoutMs:120000});
  if(process.env.DSH_REQUIRE_REAL_RENDER==='1')assert.notEqual(rendered.status,'unavailable','Required frame-pixel verification cannot skip an unavailable engine: '+rendered.message);
  if(rendered.status==='unavailable'){t.skip('Optional real renderer unavailable: '+rendered.message);return;}
  assert.equal(rendered.status,'rendered',JSON.stringify(rendered));assert.deepEqual(rendered.missingFonts,[],'English-only fixtures use the CI-provided DejaVu font');
  const images=await Promise.all(rendered.pngPaths.map(async path=>PNG.sync.read(await readFile(path))));
  const sample=(image,x,y)=>{const scale=(image.width-1)/1280,at=(Math.round(y*scale)*image.width+Math.round(x*scale))*4;return [...image.data.slice(at,at+3)];};
  for(const [i,image]of images.slice(1).entries()){
    const fill=sample(image,627,160),diagonalShadow=sample(image,628,150),straightShadow=sample(image,645,200),outside=sample(image,637,143);
    assert.ok(fill.every((v,j)=>Math.abs(v-[220,232,244][j])<=3),`${contours[i].preset}: the inner diagonal triangle is actually filled, got ${fill}`);
    assert.ok(diagonalShadow.every((v,j)=>v<outside[j]-12),`${contours[i].preset}: shadow follows the diagonal rather than a two-rectangle staircase, got ${diagonalShadow}`);
    assert.ok(straightShadow.every((v,j)=>Math.abs(v-diagonalShadow[j])<=5),`${contours[i].preset}: one shadow has uniform opacity along diagonal and straight edges`);
    assert.ok(outside.every(v=>v>=250),`${contours[i].preset}: the removed outer corner remains unfilled`);
  }
  for(const id of ['white','dark']){
    const n=out.scenes.pages[0].nodes.find(n=>n.cardId===id&&n.id.endsWith('/body')),image=images[0],scale=(image.width-1)/1280;let inkPixels=0;
    for(let y=Math.ceil(n.y*scale);y<Math.floor((n.y+n.h)*scale);y++)for(let x=Math.ceil(n.x*scale);x<Math.floor((n.x+n.w)*scale);x++){
      const at=(y*image.width+x)*4,rgb=[...image.data.slice(at,at+3)];if(id==='white'?rgb.every(v=>v<110):rgb.every(v=>v>230))inkPixels++;
    }
    assert.ok(inkPixels>100,`${id}: the native renderer must produce readable foreground ink, not same-color text and fill`);
  }
});
