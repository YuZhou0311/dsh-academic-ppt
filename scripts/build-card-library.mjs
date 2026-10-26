#!/usr/bin/env node
/** Build the original native card catalog from the same renderer used by reports. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { CARD_PRESETS, CARD_FAMILIES } from '../src/card-catalog.mjs';
import { DEFAULT_DESIGN } from '../src/core.mjs';
import { renderProject, sceneToSvg } from '../src/render.mjs';
import { measureCardSurface } from '../src/card-surface.mjs';
import { wrapText, measureTextWidth } from '../src/scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
let output=join(root,'skills/dsh-academic-ppt/references/card-library'), deckOutput, render=false;
const fontDirectories=[];
const args=process.argv.slice(2);
for(let i=0;i<args.length;i++) {
  if(args[i]==='--output'&&args[i+1])output=resolve(args[++i]);
  else if(args[i]==='--deck-output'&&args[i+1])deckOutput=resolve(args[++i]);
  else if(args[i]==='--font-dir'&&args[i+1])fontDirectories.push(resolve(args[++i]));
  else if(args[i]==='--render')render=true;
  else if(args[i]==='--help'){
    console.log('node scripts/build-card-library.mjs [--output DIRECTORY] [--deck-output DIRECTORY] [--render] [--font-dir DIRECTORY]\nBuilds 36 original SVG card previews and a searchable offline gallery. Optional native PPTX atlas: 18 pages, two cards per page. All example content is illustrative.');process.exit(0);
  } else throw new Error('Unknown or incomplete argument: '+args[i]);
}
if(render&&!deckOutput)throw new Error('--render requires --deck-output');
const hash=value=>createHash('sha256').update(value).digest('hex');
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const design=structuredClone(DEFAULT_DESIGN);
Object.assign(design.system,{header:'plain',titleSize:32,panelTitleSize:28,bodySize:24,captionSize:18});
design.projection={bodyMin:24,labelMin:20,noteMin:18};
design.chrome={header:'plain',showBrand:false,showSection:false,showTopRule:false,showPageNumber:true,showSources:false};
design.palette={...design.palette,accent:'#244761',secondary:'#186C68',line:'#B8C7D0',tint:'#F2F6F8',paper:'#FFFFFF',background:'#FFFFFF'};
const width=560, frames=new Map(), slides=[];
for(let offset=0;offset<CARD_PRESETS.length;offset+=2){
  const pair=CARD_PRESETS.slice(offset,offset+2),cards=[],regions=[];
  for(const [column,preset] of pair.entries()){
    const card=structuredClone(preset.example);
    const measured=measureCardSurface(card,width,{design,system:design.system,wrapText,measureTextWidth});
    const box={x:column?664:56,y:148,w:width,h:Math.ceil(measured.minimumH)+4};
    if(box.y+box.h>660)throw new Error(`Card ${preset.id} needs ${box.h}px; redesign the example or the atlas composition without shrinking text.`);
    frames.set(preset.id,box);cards.push(card);
    regions.push({id:`region-${column+1}`,title:'',heading:'hidden',padding:0,surface:'plain',cardIds:[card.id],box});
  }
  const family=CARD_FAMILIES.find(f=>f.id===pair[0].family);
  slides.push({id:`cards-${String(offset/2+1).padStart(2,'0')}`,layout:'academic',
    title:`${String(offset+1).padStart(2,'0')}–${String(offset+pair.length).padStart(2,'0')}  ${pair.map(p=>p.name).join(' / ')}`,
    heading:{box:{x:56,y:34,w:1168,h:52},fontSize:32},
    cards,composition:{regions},paperIds:[],claimIds:[],figureIds:[],seconds:0,
    notes:`${family.name}。本页为原创卡片组件图册，不是研究报告，所有内容和读数仅用于展示结构。\n`+pair.map(p=>`${p.id}: ${p.purpose}\n${p.useWhen}\n避免：${p.avoid}`).join('\n\n'),
  });
}
const project={title:'36种学术信息卡 · 原生可编辑设计图册',design,brief:{audience:'学术汇报作者'},papers:[],claims:[],assets:[],slides};
const generated=await renderProject(project);
const errors=generated.issues.filter(issue=>issue.severity==='error');
if(errors.length)throw new Error('Card atlas geometry failed: '+JSON.stringify(errors));
await mkdir(join(output,'cards'),{recursive:true});
const manifest={schemaVersion:1,count:CARD_PRESETS.length,families:CARD_FAMILIES.map(f=>f.id),
  note:'Original native card recipes. Example content is illustrative and must be replaced with verified report content.',cards:[]};
const previews=new Map();
for(const preset of CARD_PRESETS){
  const page=generated.scenes.pages.find(page=>page.nodes.some(n=>n.cardId===preset.id));
  const box=frames.get(preset.id),margin=8;
  const view={x:box.x-margin,y:box.y-margin,w:box.w+margin*2,h:box.h+margin*2};
  let svg=sceneToSvg({...page,title:preset.name,nodes:page.nodes.filter(n=>n.cardId===preset.id)});
  svg=svg.replace('viewBox="0 0 1280 720"',`viewBox="${view.x} ${view.y} ${view.w} ${view.h}"`)
    .replace('width="1280" height="720"',`width="${view.w}" height="${view.h}"`);
  const filename=`cards/${preset.id}.svg`;
  await writeFile(join(output,filename),svg+'\n');previews.set(preset.id,svg);
  manifest.cards.push({id:preset.id,name:preset.name,family:preset.family,svg:filename,width:view.w,height:view.h,sha256:hash(svg+'\n')});
}
await writeFile(join(output,'catalog.json'),JSON.stringify(CARD_PRESETS,null,2)+'\n');
await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const entries=CARD_PRESETS.map((p,index)=>`<article data-family="${p.family}" data-search="${esc([p.id,p.name,p.purpose,p.useWhen].join(' '))}"><header><span class="number">${String(index+1).padStart(2,'0')}</span><div><h2>${esc(p.name)}</h2><code>${p.id}</code></div></header><div class="preview">${previews.get(p.id)}</div><p class="purpose">${esc(p.purpose)}</p><p class="dimensions">建议宽 ${p.dimensions.preferredWidth}px · 最低 ${p.dimensions.minimumWidth}px · 高度随内容测量</p><details><summary>内容槽位和示例</summary><p>${esc(p.contentContract.note)}</p><p>${esc(p.avoid)}</p><pre>${esc(JSON.stringify(p.example,null,2))}</pre></details></article>`).join('\n');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>36种学术信息卡</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f6f7;color:#18324b;font-family:'Noto Sans CJK SC','Microsoft YaHei',sans-serif;line-height:1.65}main{max-width:1500px;margin:auto;padding:42px 30px 70px}h1{font-size:38px;line-height:1.3;margin:0 0 14px}h1 span{font-weight:400;font-size:18px;color:#5f707a}.intro{max-width:980px;font-size:17px}nav{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:26px 0 12px}button,input{font:inherit;border:1px solid #a9bdc9;border-radius:4px;background:#fff;padding:8px 13px;color:#244761}button{cursor:pointer}button[aria-pressed=true]{background:#244761;color:#fff}input{flex:1;min-width:220px}#count{font-size:14px;color:#60717c;margin-bottom:20px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;align-items:start}article{background:white;border:1px solid #d1dce2;padding:20px;break-inside:avoid}article[hidden]{display:none}article header{display:flex;gap:12px;align-items:center;margin-bottom:20px}.number{color:#6c878d;font-size:25px;font-weight:600}h2{font-size:20px;line-height:1.4;margin:0}code{font-size:12px;color:#647780}.preview{padding:8px 0;min-height:190px;display:flex;align-items:flex-start}.preview svg{width:100%;height:auto}.purpose{font-size:15px;margin:16px 0 6px}.dimensions{font-size:12px;color:#6b7982;margin:0 0 12px}details{border-top:1px solid #e0e6e9;padding-top:10px;font-size:13px}summary{cursor:pointer;color:#176963}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f8f9;padding:12px;font-size:12px;color:#263b4a}.workflow{border-left:3px solid #176963;padding-left:16px;color:#435b67}.footer{margin-top:32px;color:#62737c;font-size:14px}@media(max-width:1080px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){main{padding:25px 14px}.grid{grid-template-columns:1fr}h1{font-size:29px}}@media print{body{background:#fff}nav,#count,details{display:none}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}article{page-break-inside:avoid}.preview{min-height:0}main{padding:0}h1{font-size:28px}}
</style></head><body><main><h1>36种学术信息卡 <span>可选的局部内容组件</span></h1><p class="intro">从问题、方法、证据、指标、条件和进展中选择合适的表达方式。每张卡片都有独立的内容组织与可编辑原生结构，可与图表、表格和开放文字组合。示例文字与读数只用于展示设计，不是研究结论。</p><p class="workflow">按内容查询 <code>academic_ppt_cards</code>，把选中 ID 写入 <code>card.preset</code>，再填写自己的内容。已有模板时先研究其组织原则；有生图工具时可先按本次内容生成参考，再用原生对象重建。</p><nav aria-label="筛选卡片"><button data-filter="all" aria-pressed="true">全部 36 款</button>${CARD_FAMILIES.map(f=>`<button data-filter="${f.id}" aria-pressed="false">${esc(f.name)}</button>`).join('')}<input id="search" aria-label="搜索卡片用途" placeholder="搜索名称、用途或 ID"></nav><div id="count" aria-live="polite">显示 36 / 36 款</div><section class="grid">${entries}</section><p class="footer">36 款是候选库容量，不是每份报告需要使用的数量。同一任务可保持一致的卡片语言，结构变化应服务内容。图册采用统一学术配色；字体、颜色、尺寸仍可依据本稿调整。</p></main><script>
let selected='all';const cards=[...document.querySelectorAll('article')],query=document.getElementById('search');function filter(){const text=query.value.trim().toLocaleLowerCase();let count=0;for(const card of cards){const visible=(selected==='all'||card.dataset.family===selected)&&card.dataset.search.toLocaleLowerCase().includes(text);card.hidden=!visible;if(visible)count++;}document.getElementById('count').textContent='显示 '+count+' / 36 款';}for(const button of document.querySelectorAll('[data-filter]'))button.addEventListener('click',()=>{selected=button.dataset.filter;for(const b of document.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(b===button));filter();});query.addEventListener('input',filter);
</script></body></html>`;
await writeFile(join(output,'index.html'),html);
if(deckOutput){
  await mkdir(deckOutput,{recursive:true});
  await writeFile(join(deckOutput,'academic-card-library-36.pptx'),generated.pptx);
  await writeFile(join(deckOutput,'academic-card-library-36.html'),html);
  await writeFile(join(deckOutput,'atlas-project.json'),JSON.stringify(project,null,2)+'\n');
  await writeFile(join(deckOutput,'geometry-review.json'),JSON.stringify({scope:'native card atlas geometry, not scientific or aesthetic approval',issues:generated.issues},null,2)+'\n');
  if(render){
    const {renderDeck}=await import('../src/vendor/dsh-ppt-render.mjs');
    const result=await renderDeck({pptxPath:join(deckOutput,'academic-card-library-36.pptx'),outputDir:join(deckOutput,'render'),format:'both',fontDirectories,width:1600});
    await writeFile(join(deckOutput,'render-result.json'),JSON.stringify(result,null,2)+'\n');
    if(result.status!=='rendered')throw new Error('Native atlas render unavailable: '+JSON.stringify(result));
  }
}
console.log(JSON.stringify({ok:true,count:CARD_PRESETS.length,gallery:join(output,'index.html'),deckOutput:deckOutput??null,nativePages:slides.length,geometryErrors:errors.length},null,2));
