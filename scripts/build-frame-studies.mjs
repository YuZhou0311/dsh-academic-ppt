#!/usr/bin/env node
/** Original, editable studies of academic frame language. No template media. */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {DEFAULT_DESIGN} from '../src/core.mjs';
import {renderProject} from '../src/render.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
let output=join(root,'skills/dsh-academic-ppt/references/frame-studies'),renderDir,fontFamily='Droid Sans Fallback';
const fontDirectories=[];
for(let i=2;i<process.argv.length;i++){
  const arg=process.argv[i];
  if(arg==='--output')output=resolve(process.argv[++i]);
  else if(arg==='--render-dir')renderDir=resolve(process.argv[++i]);
  else if(arg==='--font-dir')fontDirectories.push(resolve(process.argv[++i]));
  else if(arg==='--font-family')fontFamily=process.argv[++i];
  else if(arg==='--help'){
    console.log('node scripts/build-frame-studies.mjs [--output DIR] [--render-dir DIR] [--font-dir DIR] [--font-family NAME]\nFour original editable pages: transparent boundaries, paper depth, title treatments, nested groups. All text describes design, never research findings.');process.exit(0);
  }else throw new Error('Unknown argument: '+arg);
}
const C={blue:'#003E87',deep:'#023160',ink:'#17243A',muted:'#606A77',line:'#AAB8C9',soft:'#F3F5F8',red:'#8F1111',white:'#FFFFFF'};
const depth={color:C.ink,opacity:.14,blur:4,offset:2,angle:90};
const text=(id,value,x,y,w,h,size=26,more={})=>({id,kind:'text',text:value,x,y,w,h,fontSize:size,role:'body',color:C.ink,lineHeight:1.2,...more});
const rect=(id,x,y,w,h,fill='none',stroke=C.line,more={})=>({id,kind:'rect',x,y,w,h,fill,stroke,strokeWidth:1.4,role:'group',...more});
const line=(id,x,y,x2,y2,more={})=>({id,kind:'line',points:[{x,y},{x:x2,y:y2}],stroke:C.line,strokeWidth:1.2,role:'decoration',...more});
const subTitle=(id,value,x,y,w)=>text(id,value,x,y,w,42,29,{bold:true,color:C.blue});
const tab=(id,title,x,y,w,fill=C.blue)=>[
  rect(id+'-paper',x,y,w,42,fill,'none'),
  text(id+'-text',title,x+14,y+3,w-28,36,28,{color:C.white,bold:true})
];
const gapTitle=(id,title,x,y,w)=>[
  rect(id+'-paper',x,y,w,38,C.white,'none'),
  text(id+'-text',title,x+10,y+3,w-20,33,27,{bold:true,color:C.deep})
];
const note=(id,value,x,y,w)=>text(id,value,x,y,w,88,24,{color:C.muted});
const specs=[];
const slides=[];
function page(id,title,elements,summary){
  slides.push({id,layout:'academic',title,heading:{box:{x:48,y:44,w:1184,h:58},fontSize:38},
    cards:[],paperIds:[],claimIds:[],figureIds:[],seconds:0,
    drawings:[{id:id+'-content',width:1184,height:526,elements}],
    composition:{regions:[{id:id+'-region',title:'',heading:'hidden',surface:'plain',padding:0,box:{x:48,y:136,w:1184,h:526},drawingIds:[id+'-content']}]},
    notes:'原创组件视觉教学页。页面文字描述设计用途，不包含研究数据、论文结论或用户模板资产。\n'+summary});
  specs.push({id,title,summary,svg:id+'.svg'});
}

page('frame-boundaries','01  范围边界：实线与无填充虚线',[
  subTitle('solid-label','同一实验的完整证据组',0,0,556),
  subTitle('dash-label','多子图的共同评价范围',628,0,556),
  rect('solid-frame',2,81,550,281,'none',C.deep,{radius:5}),
  ...gapTitle('solid-title','实验条件',24,63,148),
  text('solid-body','边界标出共同归属。\n内部文字、图例与来源各自对齐，\n不把每一句话都单独套框。',24,124,506,111,28),
  line('solid-sep',24,267,530,267),
  text('solid-tail','完整原图与解释保持相邻',24,286,500,40,27,{bold:true,color:C.blue}),
  rect('dash-frame',630,81,550,281,'none',C.deep,{dash:'dash',strokeWidth:1.8,radius:5,shadow:false}),
  ...gapTitle('dash-title','共同评价范围',650,63,204),
  text('a-label','条件 A',652,126,210,40,28,{bold:true,color:C.blue}),
  text('b-label','条件 B',934,126,210,40,28,{bold:true,color:C.blue}),
  text('a-body','同一观测窗口\n完整的变量定义',652,184,220,80,26),
  text('b-body','同一评价口径\n对应的比较对象',934,184,220,80,26),
  line('pair-divider',909,129,909,278),
  text('dash-tail','虚线本身不代表结果尚未验证',652,300,500,38,25,{color:C.muted}),
  note('solid-note','透明实线框：线重清楚，正文距边界留足空隙。',0,396,556),
  note('dash-note','透明虚线框：聚合范围。需要表达方案或假设时，另写清身份。',628,396,556),
],'两个完整边界采用相同语义层级。右侧真正 noFill；标题用独立白色对象打断上边线，无阴影。');

page('frame-depth','02  纸面层次：细实线与无边线阴影',[
  subTitle('outline-label','白底、细实线、轻阴影',0,0,556),
  subTitle('paper-label','白底、无可见边线、轻阴影',628,0,556),
  rect('backdrop-left',0,68,556,304,C.soft,'none'),
  rect('backdrop-right',628,68,556,304,C.soft,'none'),
  rect('outline-paper',16,84,524,264,C.white,C.line,{radius:4,shadow:depth}),
  rect('shadow-paper',644,84,524,264,C.white,'none',{radius:1,shadow:depth}),
  text('outline-heading','证据面板',40,108,470,44,31,{bold:true,color:C.blue}),
  text('outline-body','原图、图例与解释属于同一证据组。\n白色纸面承托内容，细线限定范围，\n轻阴影使它与背景略有分离。',40,173,470,108,27),
  text('outline-tail','阴影不表示证据更可靠',40,293,470,34,24,{color:C.muted}),
  text('shadow-heading','图旁说明',668,108,470,44,31,{bold:true,color:C.blue}),
  text('shadow-body','说明放在所解释的图旁。\n省去可见边线，保留纸面层次。\n关键条件仍用可读的正文表达。',668,173,470,108,27),
  text('shadow-tail','不要给每一层都加阴影',668,293,470,34,24,{color:C.muted}),
  note('outline-note','灰蓝 1.2px 边线，阴影 opacity 0.14、blur 4px、offset 2px。',0,403,556),
  note('shadow-note','同一阴影参数；stroke:none。组间留白防止阴影连成脏边。',628,403,556),
],'两个白色纸面有相同大小与轻阴影，左侧额外细线，右侧无可见边线。浅灰背景只用于清楚演示纸面差异。');

page('frame-titles','03  阅读入口：覆边题签与侧签',[
  subTitle('floating-label','短题签跨过上边框',0,0,556),
  subTitle('rail-label','条件名与内容逐行对应',628,0,556),
  rect('floating-frame',2,98,550,267,C.white,C.line,{radius:4,shadow:depth}),
  ...tab('floating-tab','研究问题',24,75,176),
  text('floating-body','题签命名当前证据组，\n正文从题签下方另起，\n避免边线穿过文字。',26,156,500,111,29),
  line('floating-sep',26,292,528,292),
  text('floating-bottom','较长题名改用开放标题',26,311,500,36,26,{color:C.muted}),
  rect('rail-frame',630,98,550,267,C.white,C.line,{radius:0}),
  rect('rail-paper',630,98,112,267,C.blue,'none'),
  text('rail-heading','比较\n条件',647,171,78,94,30,{bold:true,color:C.white,align:'center'}),
  text('condition-1','对象',766,124,90,36,27,{bold:true,color:C.blue}),
  text('condition-1-value','同一研究范围',884,124,270,38,27),
  line('rail-sep-1',766,176,1154,176),
  text('condition-2','窗口',766,199,90,36,27,{bold:true,color:C.blue}),
  text('condition-2-value','同一观察时段',884,199,270,38,27),
  line('rail-sep-2',766,251,1154,251),
  text('condition-3','口径',766,274,90,36,27,{bold:true,color:C.blue}),
  text('condition-3-value','明确单位与分母',884,274,270,38,27),
  note('floating-note','题签下面的边线被覆盖；文字、题签与外框都是可编辑对象。',0,403,556),
  note('rail-note','侧签只放短组名。行高由内容决定，不把长中文逐字竖排。',628,403,556),
],'浮签使用独立深蓝底与白字，覆盖上边线；侧签明确命名共享条件，内部按行对齐。');

page('frame-nesting','04  外层范围、内部模块与开放注释',[
  subTitle('nesting-label','共同范围中的方法模块',0,0,728),
  subTitle('open-label','证据旁的开放解释',792,0,392),
  rect('outer-scope',2,83,734,293,'none',C.deep,{radius:5,dash:'dash',strokeWidth:1.8}),
  ...gapTitle('outer-title','验证方案 · 结构示意',22,65,305),
  rect('input',28,143,260,147,C.white,C.line,{radius:3}),
  ...tab('input-title','输入与定义',28,143,260),
  text('input-body','研究对象\n观测窗口与变量',48,207,220,72,26),
  rect('output',444,143,260,147,C.white,C.line,{radius:3}),
  ...tab('output-title','独立评价',444,143,260),
  text('output-body','评价指标\n单位与比较口径',464,207,220,72,26),
  line('method-link',308,217,423,217,{stroke:C.blue,strokeWidth:2,endArrow:true,role:'relationship'}),
  text('outer-condition','外层定义范围，内部说明任务与连接',28,320,676,35,26,{color:C.muted}),
  line('open-top',794,86,1180,86,{stroke:C.blue,strokeWidth:1.8}),
  text('open-title','读图时先看什么',794,112,386,42,29,{bold:true,color:C.blue}),
  text('open-body','让解释靠近对应的图。\n用基线、间距和字重组织，\n无需每段都补完整边框。',794,185,386,111,27),
  line('open-bottom',794,342,1180,342,{stroke:C.blue,strokeWidth:1.8}),
  note('nesting-note','只有新增真实包含关系才多加一层。外层不加阴影，内部同级模块采用同一语言。',0,412,736),
  note('open-note','开放结构仍有清楚入口和归属，不等于随意散落文字。',792,412,392),
],'外层透明虚线，内部白底实线和深蓝标题带；独立开放注释说明不同职责可以使用不同边界。图中箭头仅展示版式结构，不代表任何研究结果。');

const design=structuredClone(DEFAULT_DESIGN);
design.fontFamily=fontFamily;
Object.assign(design.palette,{ink:C.ink,accent:C.blue,secondary:C.red,muted:C.muted,line:C.line,paper:C.white,background:C.white,tint:C.soft,soft:C.soft});
Object.assign(design.system,{header:'plain',titleSize:38,panelTitleSize:29,bodySize:27,captionSize:20});
design.chrome={header:'plain',showBrand:false,showSection:false,showTopRule:false,showPageNumber:true,showSources:false};
design.projection={bodyMin:24,labelMin:20,noteMin:18};
const project={title:'学术框线、纸面与题签 · 原创视觉细读',brief:{audience:'学术报告作者'},design,papers:[],claims:[],assets:[],slides};
const built=await renderProject(project);
const errors=built.issues.filter(issue=>issue.severity==='error');
if(errors.length)throw new Error('Frame studies geometry failed: '+JSON.stringify(errors));
await mkdir(output,{recursive:true});
await writeFile(join(output,'academic-frame-studies.pptx'),built.pptx);
await writeFile(join(output,'index.html'),built.html);
const hashes=[];
for(const [i,svg] of built.svgPages.entries()){
  const value=typeof svg==='string'?svg:svg.svg;
  const path=specs[i].svg;
  await writeFile(join(output,path),value+'\n');
  hashes.push({...specs[i],sha256:createHash('sha256').update(value+'\n').digest('hex')});
}
await writeFile(join(output,'catalog.json'),JSON.stringify({schemaVersion:1,scope:'original design instruction; no research findings or user template assets',fontFamily,pages:hashes,
  pptx:{path:'academic-frame-studies.pptx',sha256:createHash('sha256').update(built.pptx).digest('hex'),slideCount:4}},null,2)+'\n');
if(renderDir){
  const {renderDeck}=await import('../src/vendor/dsh-ppt-render.mjs');
  const result=await renderDeck({pptxPath:join(output,'academic-frame-studies.pptx'),outputDir:renderDir,format:'both',fontDirectories,width:1800});
  await writeFile(join(renderDir,'render-result.json'),JSON.stringify(result,null,2)+'\n');
  if(result.status!=='rendered')throw new Error('Real PPTX render failed: '+JSON.stringify(result));
}
console.log(JSON.stringify({ok:true,pages:4,output,renderDir:renderDir||null,geometryErrors:errors.length},null,2));
