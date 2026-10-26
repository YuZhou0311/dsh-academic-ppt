import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { CARD_FAMILIES, CARD_PRESETS, CARD_PRESET_IDS, getCardPreset, listCardPresets } from '../src/card-catalog.mjs';
import { measureCardSurface } from '../src/card-surface.mjs';
import { DEFAULT_DESIGN, buildScenes, wrapText, measureTextWidth } from '../src/scene.mjs';
import { renderProject } from '../src/render.mjs';
import { cardDemoAssets } from '../scripts/card-demo-assets.mjs';

const design={...structuredClone(DEFAULT_DESIGN),system:{preset:'academic-report',header:'rule',panel:'tint',titleSize:40,coverTitleSize:72,bodySize:24,panelTitleSize:26,captionSize:18,sectionSize:26}};
const measure=(card,width)=>measureCardSurface(card,width,{design,system:design.system,wrapText,measureTextWidth});
const demoAssets=cardDemoAssets();
const projectFor=cards=>({title:'原创学术卡片目录',design:structuredClone(design),papers:[],claims:[],assets:structuredClone(demoAssets),slides:cards.map((card,i)=>({id:`p${i+1}`,layout:'synthesis',title:getCardPreset(card.preset)?.name||'测试',paperIds:[],claimIds:[],figureIds:[],cards:[card],seconds:30,notes:'结构演示，非研究结果。'}))});
const exampleCards=()=>CARD_PRESETS.map(preset=>{
  const card=structuredClone(preset.example),w=preset.dimensions.preferredWidth;
  return {...card,box:{x:80,y:126,w,h:Math.ceil(measure(card,w).minimumH)}};
});
const errors=page=>page.issues.filter(issue=>issue.severity==='error');
const near=(a,b)=>Math.abs(a-b)<.01;

test('48 recipes retain 36 text designs and add 12 distinct figure relationships',()=>{
  assert.equal(CARD_PRESETS.length,48);assert.equal(new Set(CARD_PRESET_IDS).size,48);
  assert.equal(new Set(CARD_PRESETS.map(p=>JSON.stringify(p.recipe))).size,48,'changing only a name or palette does not add a design');
  for(const family of CARD_FAMILIES)assert.equal(CARD_PRESETS.filter(p=>p.family===family.id).length,family.id==='figure'?12:6);
  for(const preset of CARD_PRESETS){
    assert.equal(getCardPreset(preset.id),preset);assert.equal(preset.example.preset,preset.id);
    assert.ok(preset.example.title);assert.equal(typeof preset.example.body,'string');assert.ok(preset.purpose&&preset.avoid);
    assert.ok(preset.dimensions.minimumWidth>=300&&preset.dimensions.preferredWidth>=preset.dimensions.minimumWidth);
  }
  assert.equal(getCardPreset('missing'),null);
  const copies=listCardPresets({family:'metric',limit:2});assert.equal(copies.length,2);copies[0].example.title='changed';
  assert.notEqual(copies[0].example.title,getCardPreset(copies[0].id).example.title);
  assert.ok(listCardPresets({purpose:'风险'}).every(p=>[p.purpose,p.useWhen,p.name].join(' ').includes('风险')));
  assert.ok(listCardPresets({includeExamples:false}).every(p=>!('example'in p)));
});

test('every catalog example fits measured bounds and exports as editable native objects',async()=>{
  const cards=exampleCards(),out=await renderProject(projectFor(cards)),zip=unzipSync(out.pptx);
  assert.equal(out.scenes.pages.length,48);
  for(const [i,page]of out.scenes.pages.entries()){
    assert.deepEqual(errors(page),[],CARD_PRESETS[i].id);
    const card=cards[i],nodes=page.nodes.filter(n=>n.cardId===card.id);
    assert.ok(nodes.length>3);assert.ok(nodes.some(n=>n.kind==='text'&&n.text===card.title));
    for(const node of nodes){
      if(node.kind==='text')assert.ok(node.y+node.estimatedTextHeight<=card.box.y+card.box.h+1,`${card.id}: ${node.id}`);
      for(const field of ['fill','stroke','color'])if(node[field]!==undefined)assert.match(node[field],/^(#[\da-f]{6}|none)$/i,`${card.id}: unresolved ${field}`);
    }
    const xml=strFromU8(zip[`ppt/slides/slide${i+1}.xml`]);
    assert.equal((xml.match(/<p:pic>/g)||[]).length,card.figureIds?.length??0,card.id);
    assert.ok((xml.match(/<p:sp>/g)||[]).length>3,card.id);
  }
});

test('all authored fields, including zero values and rail badges, remain visible without text collisions',()=>{
  for(const preset of CARD_PRESETS.filter(preset=>preset.family!=='figure')){
    const card={id:preset.id,preset:preset.id,kind:'method',title:'完整题名',body:'完整正文',claimIds:[],badge:'D2',note:'完整限定',icon:'method',
      metric:{value:'12',unit:'kg',label:'指标名称',context:'指标条件'},
      items:[{label:'对象甲',value:0,unit:'m',detail:'对象甲解释'}]};
    const width=900,m=measure(card,width);card.box={x:80,y:110,w:width,h:Math.ceil(m.minimumH)};
    const page=buildScenes(projectFor([card])).pages[0],texts=page.nodes.filter(n=>n.kind==='text'&&n.cardId===card.id);
    assert.deepEqual(errors(page),[],preset.id);
    const all=texts.map(n=>n.text).join('\n');
    for(const value of ['完整题名','完整正文','D2','完整限定','12 kg','指标名称','指标条件','对象甲','0','m','对象甲解释'])assert.ok(all.includes(value),`${preset.id} lost ${value}`);
    for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
      const a=texts[i],b=texts[j],dx=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),dy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
      assert.ok(dx<=.5||dy<=.5,`${preset.id}: ${a.id} overlaps ${b.id}`);
    }
    assert.ok(near(m.minimumH,card.box.h)||Math.ceil(m.minimumH)===card.box.h);
  }
});

test('insufficient boxes and conflicting sources fail instead of hiding content or falling back',()=>{
  const card={...structuredClone(CARD_PRESETS[9].example),box:{x:80,y:130,w:440,h:80}},page=buildScenes(projectFor([card])).pages[0];
  assert.ok(errors(page).some(i=>i.code==='card-surface-overflow'));
  assert.ok(page.nodes.some(n=>n.text===card.body),'overflow keeps the authored formula');
  const unknown=structuredClone(card);unknown.preset='unregistered';
  assert.ok(errors(buildScenes(projectFor([unknown])).pages[0]).some(i=>i.code==='card-preset-unknown'));
  const clash=structuredClone(card);clash.templateComponentId='uploaded-component';
  assert.ok(errors(buildScenes(projectFor([clash])).pages[0]).some(i=>i.code==='card-preset-template-conflict'));
  const missing=structuredClone(card);delete missing.preset;
  assert.ok(errors(buildScenes(projectFor([missing])).pages[0]).some(i=>i.code==='card-preset-required'));
});

test('preset geometry overrides legacy defaults while honoring measured padding and authored color',()=>{
  const card={...structuredClone(CARD_PRESETS[0].example),accent:'#2A6558',appearance:{padding:24,radius:2,elevation:true,layout:'side-label',surface:'solid',accent:'left'}};
  card.box={x:80,y:130,w:440,h:Math.ceil(measure(card,440).minimumH)};
  const p=projectFor([card]);p.design.cardDefaults={padding:12,radius:18,layout:'banded',surface:'solid',accent:'top'};
  const page=buildScenes(p).pages[0];assert.deepEqual(errors(page),[]);
  assert.ok(page.issues.some(i=>i.code==='card-preset-appearance-review'));
  const title=page.nodes.find(n=>n.id.endsWith('/title')&&n.cardId===card.id);assert.equal(title.color,'#2A6558');
  assert.ok(page.nodes.some(n=>n.id.endsWith('/heading-tab')));assert.ok(!page.nodes.some(n=>n.id.endsWith('/heading-surface')));
  assert.ok(page.nodes.some(n=>n.shadow));
});

test('default projection policy changes measured geometry without demoting necessary limitations',()=>{
  const strictDesign={...structuredClone(design),projection:{bodyMin:28,labelMin:24,noteMin:18}};
  for(const preset of CARD_PRESETS){
    const card=structuredClone(preset.example),w=preset.family==='figure'?preset.dimensions.preferredWidth:620;
    const m=measureCardSurface(card,w,{design:strictDesign,system:strictDesign.system,wrapText,measureTextWidth});
    card.box={x:80,y:120,w,h:Math.ceil(m.minimumH)};
    const project=projectFor([card]);project.design=strictDesign;
    const page=buildScenes(project).pages[0];assert.deepEqual(errors(page),[],preset.id);
    for(const node of page.nodes.filter(n=>n.cardId===card.id&&n.kind==='text')){
      if(node.id.endsWith('/note')){assert.equal(node.role,'card-note');assert.ok(node.fontSize>=28,'a limitation is necessary body text');}
      if(node.role==='index'||node.role==='label')assert.ok(node.fontSize>=24,'ordinal markers and units honor labelMin');
    }
  }
});

test('scientific units remain intact in ledger and narrow metric columns without reducing type',()=>{
  const unitDesign={...structuredClone(design),projection:{bodyMin:24,labelMin:24,noteMin:18}};
  for(const [presetId,width]of [['metric-ledger',560],['metric-ledger',440],['metric-pair',440]]){
    const card=structuredClone(getCardPreset(presetId).example);
    card.box={x:80,y:120,w:width,h:Math.ceil(measureCardSurface(card,width,{design:unitDesign,system:unitDesign.system,wrapText,measureTextWidth}).minimumH)};
    const p=projectFor([card]);p.design=unitDesign;
    const page=buildScenes(p).pages[0];assert.deepEqual(errors(page),[],presetId);
    const units=page.nodes.filter(n=>n.cardId===card.id&&n.kind==='text'&&n.text.includes('m²/m²'));
    assert.ok(units.length>0,presetId);
    for(const unit of units){assert.ok(unit.lines.some(line=>line.includes('m²/m²')),`${presetId}: compound unit was split`);assert.ok(unit.fontSize>=24);}
    if(presetId==='metric-ledger')assert.ok(units.every(unit=>unit.text==='m²/m²'&&unit.lines.length===1),'ledger units occupy their own complete line');
  }
  const tooWide={...structuredClone(getCardPreset('metric-ledger').example),items:[{label:'指标',value:'0.35',unit:'kg m⁻² s⁻¹ mol⁻¹ K⁻¹ long-unit',detail:'完整单位不得拆断。'}]};
  tooWide.box={x:80,y:120,w:440,h:Math.ceil(measure(tooWide,440).minimumH)};
  assert.ok(errors(buildScenes(projectFor([tooWide])).pages[0]).some(issue=>issue.code==='card-unit-width'),'an impossible unit width blocks delivery instead of silently breaking the unit');
});

test('open decision branches terminate above the visible condition labels',()=>{
  const card=structuredClone(getCardPreset('progress-decision').example);
  card.box={x:80,y:120,w:560,h:Math.ceil(measure(card,560).minimumH)};
  const page=buildScenes(projectFor([card])).pages[0];assert.deepEqual(errors(page),[]);
  for(let i=0;i<2;i++){
    const label=page.nodes.find(n=>n.cardId===card.id&&n.id.endsWith(`/item-${i}/label`));
    const terminal=page.nodes.find(n=>n.cardId===card.id&&n.id.endsWith(`/branch-0/${i}`));
    assert.ok(near(terminal.x,label.x+label.estimatedLineWidths[0]/2),'branch is anchored to actual label ink, not an invisible column');
    assert.ok(terminal.y+terminal.h<label.y);assert.ok(label.y-(terminal.y+terminal.h)<=3);
    assert.ok(!terminal.endArrow,'condition grouping does not add a causal arrow');
  }
});

test('claim support, observation layers and risk responses express different relationships without first-item weighting',()=>{
  const pages=Object.fromEntries(['evidence-claim-proof','evidence-interpretation','boundary-response'].map(presetId=>{
    const card=structuredClone(getCardPreset(presetId).example);
    card.box={x:80,y:120,w:560,h:Math.ceil(measure(card,560).minimumH)};
    const page=buildScenes(projectFor([card])).pages[0];assert.deepEqual(errors(page),[]);return [presetId,page];
  }));
  const proof=pages['evidence-claim-proof'];
  assert.ok(proof.nodes.some(n=>n.id.endsWith('/body-surface')),'the claim itself has the focal surface');
  assert.ok(!proof.nodes.some(n=>n.kind==='rect'&&n.id.includes('/item-')),'support rows have equal unshaded treatment');
  const layered=pages['evidence-interpretation'],layers=layered.nodes.filter(n=>n.id.endsWith('/layer-label'));
  assert.equal(layers.length,2);assert.equal(layers[0].fill,layers[1].fill,'observation and interpretation do not acquire unequal weight from position');
  assert.ok(!layered.nodes.some(n=>n.endArrow),'layers do not imply causation');
  const response=pages['boundary-response'],labels=response.nodes.filter(n=>n.id.endsWith('/label')&&n.cardId==='boundary-response');
  assert.equal(labels.length,2);assert.equal(labels[0].y,labels[1].y);assert.ok(labels[1].x>labels[0].x+150,'risk and response form an explicit left/right pair');
  assert.ok(!response.nodes.some(n=>n.endArrow),'a proposed response is not proof of a causal effect');
});
