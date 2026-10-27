import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScenes,DEFAULT_DESIGN,wrapText,measureTextWidth } from '../src/scene.mjs';
import { measureCardSurface } from '../src/card-surface.mjs';
import { fitImageCardToHeight } from '../src/image-card-surface.mjs';
import { cardDemoAssets } from '../scripts/card-demo-assets.mjs';

const design={...structuredClone(DEFAULT_DESIGN),system:{preset:'academic-report',header:'rule',panel:'line',titleSize:40,coverTitleSize:72,bodySize:24,panelTitleSize:26,captionSize:18,sectionSize:26}};
const settings={design,system:design.system,wrapText,measureTextWidth};
const textCard=(id,body='完整文字与条件随目标宽度重新换行。')=>({id,kind:'method',title:'实验条件',body,claimIds:[],appearance:{surface:'outline',padding:20}});
const imageCard=()=>({id:'source',kind:'result',preset:'figure-caption',title:'源图与观察',body:'保留完整原图。',claimIds:[],figureIds:['card-demo-a']});
const project=(cards,{free=false,assets=[]}={})=>({title:'Card fitting regression',design:structuredClone(design),papers:[],claims:[],assets,
  slides:[{id:'fit',layout:'academic',title:'卡片跟随内容重排',cards,paperIds:[],claimIds:[],figureIds:[],notes:'Synthetic geometry fixture, not scientific evidence.',
    composition:free?{regions:[{id:'body',heading:'hidden',title:'',surface:'plain',padding:0,box:{x:80,y:145,w:1120,h:480},cardIds:cards.map(c=>c.id)}]}:
      {rows:[{panels:[{id:'body',title:'条件与来源',surface:'plain',cardIds:cards.map(c=>c.id)}]}]}}]});
const frame=(page,id)=>page.nodes.find(n=>n.cardId===id&&n.role==='card-surface');
const errors=page=>page.issues.filter(i=>i.severity==='error');

test('automatic text cards wrap at the target width and keep natural heights instead of equal empty cells',()=>{
  const cards=[textCard('short'),textCard('long','第一行说明测量对象。\n第二行说明测试条件。\n第三行保留推断边界。')];
  const p=project(cards),before=structuredClone(p),page=buildScenes(p).pages[0];
  assert.deepEqual(p,before,'layout must not mutate the authored card or type sizes');
  assert.deepEqual(errors(page),[]);
  for(const c of cards){const f=frame(page,c.id),m=measureCardSurface(c,f.w,settings);assert.ok(Math.abs(f.h-m.minimumH)<.01);}
  const a=frame(page,'short'),b=frame(page,'long');
  assert.ok(b.h>a.h+40,'real content, not equal cell height, determines the card extent');
  assert.ok(Math.abs(b.y-a.y-a.h-14)<.01,'natural cards have one deliberate inter-card gap');
  assert.ok(!page.issues.some(i=>i.code==='card-excess-whitespace'));
  const c=textCard('wrap','研究对象、处理条件、验证口径与不确定性需要完整保留，不能为了适配卡片任意缩小文字。');
  assert.ok(measureCardSurface(c,400,settings).minimumH>measureCardSurface(c,900,settings).minimumH);
});

test('a deliberately oversized explicit box remains editable and produces a positioned review target',()=>{
  const c={...textCard('fixed'),box:{x:80,y:145,w:1120,h:480}},page=buildScenes(project([c],{free:true})).pages[0];
  assert.deepEqual(errors(page),[]);assert.equal(frame(page,c.id).h,480);
  const issue=page.issues.find(i=>i.code==='card-excess-whitespace');
  assert.ok(issue);assert.equal(issue.slideId,'fit');assert.equal(issue.cardId,'fixed');
  assert.equal(issue.box.y,c.box.y+issue.measuredHeight);assert.equal(issue.box.h,issue.unusedHeight);
  assert.ok(issue.unusedFraction>.5);assert.ok(issue.box.y+issue.box.h<=c.box.y+c.box.h+.01);
  c.box.h=measureCardSurface(c,c.box.w,settings).minimumH+24;
  assert.ok(!buildScenes(project([c],{free:true})).pages[0].issues.some(i=>i.code==='card-excess-whitespace'),'normal breathing room is not an error');
});

test('default image slots respond to destination height without shrinking fonts or changing source aspect ratio',()=>{
  const c=imageCard(),assets=cardDemoAssets(),p={assets,papers:[]},base=measureCardSurface(c,720,settings);
  const small=fitImageCardToHeight(c,{w:720,h:285},p,settings,base),large=fitImageCardToHeight(c,{w:720,h:480},p,settings,base);
  assert.ok(small.minimumH<=285+.01);assert.ok(large.images[0].h>small.images[0].h+30);
  assert.equal(small.elements.find(e=>e.key==='body').size,large.elements.find(e=>e.key==='body').size);
  assert.ok(large.minimumH<480-60,'a wide image stops growing when extra height would only letterbox it');
  const authored={...c,mediaHeight:185},fixed=measureCardSurface(authored,720,settings);
  assert.equal(fitImageCardToHeight(authored,{w:720,h:480},p,settings,fixed),fixed,'an explicit image-height choice is preserved');
  const out=project([c],{free:true,assets});out.slides[0].composition.regions[0].box.w=720;
  const page=buildScenes(out).pages[0],image=page.nodes.find(n=>n.kind==='image');
  assert.deepEqual(errors(page),[]);assert.equal(image.fit,'contain');assert.equal(image.viewport,undefined);
  assert.ok(Math.abs(image.w/image.h-assets[0].width/assets[0].height)<1e-8);
  assert.ok(frame(page,c.id).h<480-20,'the automatic outer frame follows fitted media instead of keeping an empty tail');
});

test('default media fitting does not bypass source readability or insufficient destination checks',()=>{
  const c={...imageCard(),box:{x:80,y:145,w:1120,h:130}},assets=cardDemoAssets();
  assets[0].reading={purpose:'evidence',contentType:'diagram',task:'explain-process',minLabelPx:3,verifiedBy:'human',note:'Synthetic source measurement.'};
  const page=buildScenes(project([c],{free:true,assets})).pages[0];
  assert.ok(errors(page).some(i=>i.code==='card-surface-overflow'));
  assert.ok(errors(page).some(i=>i.code==='figure-label-too-small'));
  assert.ok(page.nodes.some(n=>n.kind==='text'&&n.text===c.body),'overflow must preserve full copy for repair');
});

test('a full-width overview receives source-proportional height instead of a fixed half-row',()=>{
  const c={...imageCard(),preset:'figure-overview-details',figureIds:['card-demo-a','card-demo-b','card-demo-c']};
  const p=project([c],{free:true,assets:cardDemoAssets()}),before=structuredClone(p),page=buildScenes(p).pages[0];
  assert.deepEqual(errors(page),[]);assert.deepEqual(p,before);
  const images=page.nodes.filter(n=>n.kind==='image');
  assert.equal(images.length,3);
  assert.ok(images[0].w>images[1].w*1.5,'the full-width overview must not be smaller than a half-width detail for equal-aspect sources');
  for(const image of images)assert.ok(Math.abs(image.w/image.h-p.assets.find(a=>a.id===image.assetId).width/p.assets.find(a=>a.id===image.assetId).height)<1e-8);
  assert.equal(page.nodes.filter(n=>n.role==='caption'&&n.cardId===c.id).length,3,'every independent source caption survives reallocation');
});

test('free flow starts the next card one gap after the final fitted image frame at different widths',()=>{
  for(const width of [500,600]){
    const source={...imageCard(),title:'Original evidence',body:''},after={...textCard('after','One condition.'),title:'Interpretation'};
    const p=project([source,after],{free:true,assets:cardDemoAssets()});p.slides[0].composition.regions[0].box.w=width;
    const before=structuredClone(p),page=buildScenes(p).pages[0];
    assert.deepEqual(errors(page),[]);assert.deepEqual(p,before);
    const imageFrame=frame(page,source.id),nextFrame=frame(page,after.id);
    assert.ok(Math.abs(nextFrame.y-imageFrame.y-imageFrame.h-12)<.01,`width ${width}: spacing must follow the visible fitted frame, not its unused allocation`);
    assert.ok(nextFrame.y+nextFrame.h<=145+480+.01);
  }
});

test('academic panel flow advances from fitted image geometry while preserving the following text',()=>{
  const source={...imageCard(),title:'Original evidence',body:''},after={...textCard('after','One condition.'),title:'Interpretation'},peer=textCard('peer');
  const p=project([source,after,peer],{assets:cardDemoAssets()});
  p.slides[0].composition.rows[0].panels=[{id:'evidence',title:'Evidence',surface:'plain',cardIds:[source.id,after.id]},{id:'context',title:'Context',surface:'plain',cardIds:[peer.id]}];
  const before=structuredClone(p),page=buildScenes(p).pages[0];
  assert.deepEqual(errors(page),[]);assert.deepEqual(p,before);
  const imageFrame=frame(page,source.id),nextFrame=frame(page,after.id);
  assert.ok(Math.abs(nextFrame.y-imageFrame.y-imageFrame.h-14)<.01,'the next academic card follows actual fitted height plus one deliberate gap');
  assert.equal(page.nodes.find(n=>n.id.endsWith('/card/after/body')).text,after.body);
});
