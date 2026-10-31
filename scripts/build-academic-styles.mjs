#!/usr/bin/env node
/** Rebuild authored, editable style studies through this plugin's renderer.
 * All observations below are constructed teaching data, never research results.
 * This is a renderer fixture, not an end-to-end DSH/model evaluation.
 */
import {mkdir, writeFile, readFile, rename} from 'node:fs/promises';
import {dirname, join, resolve, relative} from 'node:path';
import {createHash} from 'node:crypto';
import {renderProject} from '../src/render.mjs';
import {buildScenes, wrapText} from '../src/scene.mjs';
import {ACADEMIC_STYLES} from '../src/academic-styles.mjs';
import {renderDeck} from '../src/vendor/dsh-ppt-render.mjs';
import {createContactSheets} from '../src/montage.mjs';

let output, render=false;
const fontDirectories=[];
const args=process.argv.slice(2);
for(let i=0;i<args.length;i++){
  if(args[i]==='--output'&&args[i+1])output=args[++i];
  else if(args[i]==='--render')render=true;
  else if(args[i]==='--font-dir'&&args[i+1])fontDirectories.push(resolve(args[++i]));
  else if(args[i]==='--help'){
    console.log('node scripts/build-academic-styles.mjs --output NEW_DIRECTORY [--render] [--font-dir FONT_DIRECTORY]\nBuild six two-page editable academic studies using identical constructed observations. --render produces actual PPTX PNG/PDF renders and a contact sheet. It never records visual approval or overwrites an existing directory. Install Noto Sans CJK SC and Noto Serif CJK SC, both Regular and Bold, locally or supply a font directory. A missingFonts=[] result does not certify the requested weight or glyph coverage. No network or model request is made.');
    process.exit(0);
  }else throw new Error('Unknown or incomplete argument: '+args[i]);
}
if(!output)throw new Error('Supply --output NEW_DIRECTORY');
if(fontDirectories.length>4)throw new Error('Use at most four font directories');
const root=resolve(output);
await mkdir(dirname(root),{recursive:true});
await mkdir(root);

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const mean=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;
const sd=xs=>Math.sqrt(xs.reduce((s,x)=>s+(x-mean(xs))**2,0)/(xs.length-1));
const fmt=x=>(Math.abs(x)<.0000001?'0.000':x.toFixed(3)).replace('-','−');
const round=x=>Number(x.toFixed(6));
const tCritical=3.182446305284263; // two-sided 95% Student t, df=3
const offsets=[-.15,-.09,-.03,.03,.09,.15];
const siteNames=['A','B','C','D'];
const settings=[
  {id:'random',label:'随机划分',base:[.8,1,.9,.7],method:[.5,.75,.55,.4]},
  {id:'heldout',label:'整站留出',base:[1,1.1,1.2,.9],method:[1.1,1,1.3,1]},
];
const observations=settings.flatMap(protocol=>siteNames.flatMap((site,s)=>offsets.map((offset,i)=>({
  protocol:protocol.id,site,sample:i+1,sampleId:`${site}-${i+1}`,
  absoluteErrorBaseline:round(protocol.base[s]+offset),
  absoluteErrorMethod:round(protocol.method[s]+offset),
  unit:'t/ha',
}))));
const summaries=settings.map(protocol=>{
  const sites=siteNames.map(site=>{
    const rows=observations.filter(row=>row.protocol===protocol.id&&row.site===site);
    const baseline=mean(rows.map(r=>r.absoluteErrorBaseline)),method=mean(rows.map(r=>r.absoluteErrorMethod));
    return {site,nObservations:rows.length,baseline:round(baseline),method:round(method),delta:round(method-baseline)};
  });
  const deltas=sites.map(s=>s.delta),estimate=mean(deltas),standardError=sd(deltas)/Math.sqrt(deltas.length);
  return {protocol:protocol.id,label:protocol.label,sites,nSites:sites.length,nObservations:24,
    baseline:round(mean(sites.map(s=>s.baseline))),method:round(mean(sites.map(s=>s.method))),
    estimate:round(estimate),standardError,lower:estimate-tCritical*standardError,upper:estimate+tCritical*standardError};
});
if(summaries.some(s=>s.nSites!==4||s.sites.some(site=>site.nObservations!==6)))throw new Error('Broken teaching-data grouping');
if(Math.abs(summaries[0].estimate+.3)>1e-8||Math.abs(summaries[1].estimate-.05)>1e-8)throw new Error('Unexpected teaching-data calculation');
const dataset={identity:'constructed-teaching-data-not-research-results',unit:'t/ha',
  construction:'For each protocol, site and method, add the six shared offsets to the stated site mean absolute error. The same 24 hypothetical sample IDs have two protocol-specific evaluations each (48 records, not 48 independent samples). No model was trained or evaluated. Protocol names describe an imaginary comparison.',
  offsets,siteNames,settings,observations,summaries,
  calculation:{delta:'site mean absolute error of method minus site mean absolute error of baseline',estimate:'arithmetic mean of four paired site deltas',standardError:'sample standard deviation of four site deltas / sqrt(4)',interval:'estimate +/- tCritical * standardError',tCritical,df:3,level:.95},
  limitations:['24 constructed observations are nested within 4 sites per protocol; they are not 24 independent sites.','The interval demonstrates a conventional t interval with site-level independence and normality assumptions. Four sites cannot validate those assumptions.','No actual train/test split, model fitting or field experiment was conducted. These numbers cannot support real agronomic or model-performance claims.']};
await writeFile(join(root,'teaching-data.json'),JSON.stringify(dataset,null,2)+'\n');

const C={ink:'#202A35',muted:'#526170',line:'#B9C4CE',random:'#245E86',heldout:'#A35332',base:'#667887',method:'#18766B',soft:'#F0F4F5',paper:'#FFFFFF'};
const intervalText=s=>`${fmt(s.estimate)} [${fmt(s.lower)}, ${fmt(s.upper)}]`;
const qualification='共 24 个构造观测，聚合为 4 个站点差值；95% t 区间以站点为统计单位';
const boundary='仅演示统计与排版；未训练模型，不能推断真实跨站点泛化';
const methodTitle='从观测误差到站点层面的比较';
const resultTitle='随机划分误差较低，跨站点差异不确定';

function painter(width,height){
  const elements=[];
  const add=value=>{elements.push({id:`e${elements.length+1}`,...value});return value;};
  const text=(value,x,y,w=width-x,size=28,{bold=false,color=C.ink,role='body',align='left'}={})=>{
    size=Math.max(size,role==='body'?28:role==='label'?24:18);
    const h=wrapText(value,w,size,{bold}).length*size*1.26+2;
    if(x<0||y<0||x+w>width+.2||y+h>height+.2)throw new Error(`Study text outside drawing: ${value} ${JSON.stringify({width,height,x,y,w,h})}`);
    add({kind:'text',text:value,x,y,w,h,fontSize:size,bold,color,role,align,lineHeight:1.24});
    return h;
  };
  const line=(x1,y1,x2,y2,{color=C.line,width:strokeWidth=1.5,role='data',dash,arrow=false}={})=>add({kind:'line',points:[{x:x1,y:y1},{x:x2,y:y2}],stroke:color,strokeWidth,role,...(dash?{dash}:{}),...(arrow?{endArrow:true}:{})});
  const rect=(x,y,w,h,fill=C.soft,stroke='none',role='group')=>add({kind:'rect',x,y,w,h,fill,stroke,strokeWidth:1.2,role});
  const dot=(x,y,r=5,color=C.random)=>add({kind:'ellipse',x:x-r,y:y-r,w:r*2,h:r*2,fill:color,stroke:'none',role:'data'});
  return {w:width,h:height,elements,text,line,rect,dot};
}

function makeComposer(slide,area){
  const regions=[],drawings=[];
  const draw=(id,box,fn)=>{
    const p=painter(box.w,box.h);fn(p);
    drawings.push({id,width:box.w,height:box.h,elements:p.elements});
    regions.push({id,title:'',heading:'hidden',surface:'plain',padding:0,box,drawingIds:[id]});
  };
  const table=(box,data)=>{slide.table=data;regions.push({id:'table',title:'',heading:'hidden',surface:'plain',padding:0,box,table:true});};
  const at=(x,y,w,h)=>({x:area.x+x,y:area.y+y,w,h});
  const footHeight=56,mainHeight=area.h-footHeight-18;
  draw('study-qualification',at(0,area.h-footHeight,area.w,footHeight),p=>{
    p.text(qualification,0,0,p.w,18,{role:'note',color:C.muted});
    p.text(boundary,0,28,p.w,18,{role:'note',color:C.muted});
  });
  return {draw,table,at,w:area.w,h:mainHeight,finish:()=>{slide.drawings=drawings;slide.composition={regions};return slide;}};
}

function forest(p,{title=true,compact=false}={}){
  if(title)p.text('ΔMAE = 方法 − 基线（t/ha）',0,0,p.w,26,{bold:true,role:'label'});
  const left=compact?118:146,right=20,plotW=p.w-left-right,min=-.5,max=.3;
  const map=value=>left+(value-min)/(max-min)*plotW;
  const top=title?66:28,axis=p.h-53,rowGap=(axis-top-46)/2;
  p.line(map(0),top-12,map(0),axis,{color:C.muted,dash:'dash',width:1.5});
  for(const [i,s]of summaries.entries()){
    const y=top+18+i*(rowGap+23),color=i?C.heldout:C.random;
    p.text(s.label,0,y-16,left-10,24,{role:'label',bold:true});
    p.line(map(s.lower),y,map(s.upper),y,{color,width:3});
    p.line(map(s.lower),y-7,map(s.lower),y+7,{color,width:2});
    p.line(map(s.upper),y-7,map(s.upper),y+7,{color,width:2});
    p.dot(map(s.estimate),y,6,color);
    p.text(intervalText(s),left,y+18,plotW,24,{role:'label',color});
  }
  p.line(left,axis,p.w-right,axis,{color:C.muted});
  for(const value of [-.4,-.2,0,.2]){
    const x=map(value);p.line(x,axis,x,axis+6,{color:C.muted});
    p.text(value===0?'0':value.toFixed(1).replace('-','−'),x-35,axis+13,70,24,{role:'label',align:'center',color:C.muted});
  }
}

function interpretation(p,{numbered=false}={}){
  let y=0;
  const entries=[['随机划分','均值 −0.300 t/ha\n区间完全低于零',C.random],['整站留出','均值 +0.050 t/ha\n区间跨零',C.heldout]];
  entries.forEach(([label,body,color],i)=>{
    y+=p.text((numbered?`${i+1}. `:'')+label,0,y,p.w,26,{role:'label',bold:true,color})+10;
    y+=p.text(body,0,y,p.w,28)+26;
  });
  p.text('跨站点优势仍不确定',0,y,p.w,28,{bold:true});
}

const siteTable=()=>({columns:['站点','随机 Δ','留站 Δ'],columnWeights:[.7,1.2,1.2],
  rows:siteNames.map((site,i)=>[site,fmt(summaries[0].sites[i].delta),fmt(summaries[1].sites[i].delta)]),
  caption:'Δ = 方法 − 基线，单位 t/ha；每格来自同站 6 个观测',sourceClaimIds:[]});
const summaryTable=()=>({columns:['评价协议','基线 MAE','方法 MAE','ΔMAE','95% t 区间'],columnWeights:[1.2,1,1,1,1.9],
  rows:summaries.map(s=>[s.label,fmt(s.baseline),fmt(s.method),fmt(s.estimate),`[${fmt(s.lower)}, ${fmt(s.upper)}]`]),
  caption:'Δ = 方法 − 基线，单位 t/ha。区间以 4 个站点差值计算。',sourceClaimIds:[]});

function equations(p,{large=false}={}){
  const size=large?30:28;
  let y=0;
  y+=p.text('先在站点内求 MAE',0,y,p.w,26,{bold:true,role:'label'})+12;
  y+=p.text('d(s) = MAE方法(s) − MAE基线(s)',0,y,p.w,size)+18;
  y+=p.text('再对 4 个站点差值等权平均',0,y,p.w,26,{bold:true,role:'label'})+12;
  y+=p.text('平均差值 = Σd(s) / 4',0,y,p.w,34)+18;
  y+=p.text('95% t 区间：\n平均差值 ± 3.182 × SD(d) / 2',0,y,p.w,28)+18;
  p.text('s 表示站点；仅有 4 个站点。\n本例无法验证独立性与分布假设。',0,y,p.w,24,{role:'label',color:C.muted});
}

function buildStudy(profile,pageNumber){
  const base={id:`${profile}-${pageNumber}`,layout:'academic',title:pageNumber===1?resultTitle:methodTitle,
    kicker:'教学构造数据，非真实科研结果',paperIds:[],claimIds:[],figureIds:[],cards:[],seconds:90,
    section:{number:pageNumber===1?'02':'03',title:pageNumber===1?'评价结果':'分析单位与边界'},
    notes:`本页为插件的原创、可编辑设计研究，不是实际模型或田间试验结果。\n数据见 teaching-data.json，可由 scripts/build-academic-styles.mjs 重算。\n${qualification}。\n${boundary}。\n随机划分：${intervalText(summaries[0])} t/ha；整站留出：${intervalText(summaries[1])} t/ha。\n先说明比较和零线，再读点估计与区间，最后解释外推边界。`};
  const design={styleProfile:profile,density:'balanced',chrome:{showSources:false,showBrand:false}};
  const seed={title:'站点评估教学样例',design,papers:[],claims:[],assets:[],slides:[base]};
  const area=buildScenes(seed).pages[0].contentBox;
  const c=makeComposer(base,area),{draw,table,at,w,h}=c;

  if(profile==='research-seminar'){
    if(pageNumber===1){
      draw('main-evidence',at(0,0,800,h),p=>forest(p));
      draw('close-reading',at(842,8,w-842,h-8),p=>interpretation(p));
    }else{
      table(at(0,4,550,h),siteTable());
      draw('analysis-steps',at(602,4,w-602,h),p=>equations(p));
    }
  }else if(profile==='thesis-defense'){
    if(pageNumber===1){
      draw('question',at(0,0,w,48),p=>p.text('验证问题：随机划分的误差优势能否延伸到未见站点？',0,0,p.w,28,{bold:true}));
      draw('effect-comparison',at(0,58,w,h-119),p=>forest(p));
      draw('numbered-findings',at(0,h-45,w,45),p=>{
        p.text('1. 随机划分：误差较低',0,0,560,28,{bold:true,color:C.random});
        p.text('2. 整站留出：差异不确定',620,0,p.w-620,28,{bold:true,color:C.heldout});
      });
    }else{
      table(at(0,0,580,h-72),siteTable());
      draw('defense-conditions',at(630,0,w-630,h-72),p=>{
        let y=p.text('评委可追问的条件',0,0,p.w,28,{bold:true})+22;
        for(const text of ['同一协议内，方法与基线比较同一组观测。','先按站点聚合，再计算四个配对差值。','区间依赖站点独立性与差值分布假设。'])y+=p.text(text,0,y,p.w,26)+18;
      });
      draw('scope-answer',at(0,h-54,w,54),p=>p.text('外推范围：本例没有真实训练与测试，结论只描述这套构造数值。',0,0,p.w,28,{bold:true}));
    }
  }else if(profile==='methods-whiteboard'){
    if(pageNumber===1){
      draw('definition',at(0,0,440,h),p=>{
        let y=p.text('比较量',0,0,p.w,26,{bold:true})+15;
        y+=p.text('d(s) = MAE方法(s)\n       − MAE基线(s)',0,y,p.w,32)+25;
        y+=p.text('d(s) < 0：方法误差更低',0,y,p.w,28)+18;
        y+=p.text('d(s) > 0：基线误差更低',0,y,p.w,28)+28;
        p.text('点表示站点差值的均值；线表示 95% t 区间。',0,y,p.w,26);
      });
      draw('estimated-effect',at(490,0,w-490,h),p=>forest(p,{compact:true}));
    }else{
      draw('derivation',at(0,0,610,h),p=>equations(p,{large:true}));
      table(at(662,0,w-662,h),siteTable());
    }
  }else if(profile==='paper-club'){
    if(pageNumber===1){
      draw('figure-plate',at(0,0,818,h),p=>{
        p.text('图 T1  配对误差差值（t/ha）',0,0,p.w,26,{bold:true});
        const q=painter(p.w,h-55);forest(q,{title:false});
        q.elements.forEach(e=>p.elements.push({...e,id:`fig-${e.id}`,...(e.kind==='line'?{points:e.points.map(v=>({...v,y:v.y+52}))}:{y:e.y+52})}));
      });
      draw('reader-margin',at(864,0,w-864,h),p=>{
        let y=p.text('读图批注',0,0,p.w,26,{bold:true,color:C.heldout})+20;
        y+=p.text('两行比较的是同一误差差值，单位一致。',0,y,p.w,26)+25;
        y+=p.text('整站留出区间跨零。\n“有泛化优势”的说法\n超出了这份证据。',0,y,p.w,28)+25;
        p.text('问：只有 4 个站点时，结果对站点组成有多敏感？',0,y,p.w,26,{bold:true});
      });
    }else{
      table(at(0,0,540,h),siteTable());
      draw('claim-audit',at(594,0,w-594,h),p=>{
        let y=p.text('原始信息与讲者判断分开',0,0,p.w,28,{bold:true})+25;
        y+=p.text('记录：每站 6 个观测。先求站点 MAE，\n再计算方法与基线的差值。',0,y,p.w,28)+25;
        y+=p.text('判断：随机划分差值低于零；\n整站留出的方向仍不确定。',0,y,p.w,28)+25;
        p.text('边界：统计单位是站点。24 个观测\n不能替代更多独立站点。',0,y,p.w,28,{bold:true});
      });
    }
  }else if(profile==='evidence-synthesis'){
    if(pageNumber===1){
      table(at(0,0,w,230),summaryTable());
      draw('comparison-verdict',at(0,258,w,h-258),p=>{
        const gap=60,cw=(p.w-gap)/2;
        p.text('随机划分',0,0,cw,26,{bold:true,color:C.random});
        p.text('差值为负，区间未跨零。\n支持本套数值下误差较低。',0,48,cw,28);
        p.text('整站留出',cw+gap,0,cw,26,{bold:true,color:C.heldout});
        p.text('差值略正，区间跨零。\n不能确认跨站点优势。',cw+gap,48,cw,28);
      });
    }else{
      table(at(0,0,620,h),{columns:['比较前核对','本例约定'],columnWeights:[1.1,2.2],rows:[['比较对象','方法与同协议基线'],['指标与单位','绝对误差，t/ha'],['统计单位','4 个站点差值'],['站点内观测','每站 6 个，共 24 个']],caption:'协议之间可比的是误差定义；划分方式不同不能混为同一验证。',sourceClaimIds:[]});
      draw('synthesis-rule',at(672,0,w-672,h),p=>{
        let y=p.text('综合结论保留协议条件',0,0,p.w,28,{bold:true})+22;
        y+=p.text('随机划分：\n'+intervalText(summaries[0])+' t/ha',0,y,p.w,26)+22;
        y+=p.text('整站留出：\n'+intervalText(summaries[1])+' t/ha',0,y,p.w,26)+22;
        p.text('跨站点差异不确定。进一步的真实外部验证仍缺失。',0,y,p.w,28,{bold:true});
      });
    }
  }else if(profile==='field-report'){
    if(pageNumber===1){
      draw('site-effects',at(0,0,785,h),p=>{
        p.text('每个站点都保留一对差值',0,0,p.w,26,{bold:true});
        const left=80,right=25,top=66,bottom=p.h-62,map=value=>left+(value+.45)/.7*(p.w-left-right);
        p.line(map(0),top-15,map(0),bottom,{color:C.muted,dash:'dash'});
        for(let i=0;i<4;i++){
          const y=top+i*(bottom-top-25)/3;
          p.text(siteNames[i],0,y-16,55,26,{role:'label',bold:true});
          for(let j=0;j<2;j++){const v=summaries[j].sites[i].delta,yy=y+(j?7:-7),color=j?C.heldout:C.random;p.dot(map(v),yy,5,color);}
        }
        p.line(left,bottom,p.w-right,bottom,{color:C.muted});
        for(const v of [-.4,-.2,0,.2])p.text(v===0?'0':v.toFixed(1).replace('-','−'),map(v)-35,bottom+15,70,24,{role:'label',align:'center'});
      });
      draw('site-legend-and-mean',at(830,0,w-830,h),p=>{
        let y=p.text('ΔMAE（t/ha）',0,0,p.w,26,{bold:true})+10;
        y+=p.text('方法 − 基线',0,y,p.w,24,{role:'label',color:C.muted})+22;
        for(let i=0;i<2;i++){
          const s=summaries[i],color=i?C.heldout:C.random;
          y+=p.text(s.label,0,y,p.w,26,{bold:true,color})+10;
          y+=p.text(intervalText(s),0,y,p.w,26)+20;
        }
        p.text('左图每点为一个站点差值；右侧为均值与 95% t 区间。',0,y,p.w,24,{role:'label'});
      });
    }else{
      draw('sampling-units',at(0,0,500,h),p=>{
        p.text('观测嵌套在站点之内',0,0,p.w,28,{bold:true});
        for(let i=0;i<4;i++){
          const y=62+i*66;
          p.text('站点 '+siteNames[i],0,y,112,26,{role:'label'});
          for(let j=0;j<6;j++)p.dot(150+j*40,y+17,6,C.method);
        }
        p.text('每行 6 个构造观测；行是统计单位。',0,345,p.w,24,{role:'label',color:C.muted});
      });
      table(at(554,0,w-554,h),siteTable());
    }
  }
  return c.finish();
}

const studyProfiles=['research-seminar','thesis-defense','methods-whiteboard','paper-club','evidence-synthesis','field-report'];
const catalog=[],pngPaths=[],quality=[];
for(const id of studyProfiles){
  const profile=ACADEMIC_STYLES[id];
  if(!profile)throw new Error('Missing academic style: '+id);
  const dir=join(root,id);await mkdir(dir);await mkdir(join(dir,'svg'));
  const project={title:`${profile.label}：站点评估教学样例`,design:{styleProfile:id,density:'balanced',chrome:{showSources:false,showBrand:false}},papers:[],claims:[],assets:[],slides:[buildStudy(id,1),buildStudy(id,2)]};
  const result=await renderProject(project);
  const errors=result.issues.filter(issue=>issue.severity==='error');
  quality.push({profile:id,sceneErrors:errors,sceneWarnings:result.issues.filter(issue=>issue.severity!=='error')});
  await writeFile(join(dir,'deck.json'),JSON.stringify(project,null,2)+'\n');
  await writeFile(join(dir,'scene-issues.json'),JSON.stringify(result.issues,null,2)+'\n');
  if(errors.length)throw new Error(id+' scene errors: '+JSON.stringify(errors.slice(0,8)));
  const pptxPath=join(dir,id+'.pptx');
  await writeFile(pptxPath,result.pptx);
  await writeFile(join(dir,'index.html'),result.html);
  for(const page of result.svgPages)await writeFile(join(dir,'svg',page.id+'.svg'),page.svg);
  let rendered;
  if(render){
    rendered=await renderDeck({pptxPath,outputDir:join(dir,'render'),format:'both',width:1600,timeoutMs:120000,...(fontDirectories.length?{fontDirectories}:{})});
    if(!rendered.ok)throw new Error(id+' rendering unavailable: '+JSON.stringify(rendered));
    if(rendered.missingFonts.length)throw new Error(id+' missing fonts: '+rendered.missingFonts.join(', '));
    pngPaths.push(...rendered.pngPaths);
  }
  catalog.push({id,label:profile.label,description:profile.description,useWhen:profile.useWhen,avoidWhen:profile.avoidWhen,
    scientificContent:'Identical constructed data, site-level paired mean differences and 95% t intervals. Two pages per profile; no cover-only variants.',
    pptx:relative(root,pptxPath),pptxSha256:hash(result.pptx),html:`${id}/index.html`,deck:`${id}/deck.json`,
    pages:project.slides.map((slide,i)=>({id:slide.id,title:slide.title,svg:`${id}/svg/${slide.id}.svg`,...(rendered?{png:relative(root,rendered.pngPaths[i]),pngSha256:null}:{})})),
    ...(rendered?{renderReceipt:relative(root,rendered.receiptPath),pdf:relative(root,rendered.pdfPath),renderer:{package:'@deepseek-ai/libreoffice-kit',version:rendered.rendererVersion,backend:rendered.backend,missingFonts:rendered.missingFonts}}:{})});
  for(const page of catalog.at(-1).pages)if(page.png)page.pngSha256=hash(await readFile(join(root,page.png)));
  console.log(JSON.stringify({profile:id,slides:2,geometryErrors:0,rendered:Boolean(rendered)}));
}
if(pngPaths.length){const [sheet]=await createContactSheets(pngPaths,root);await rename(sheet,join(root,'montage.png'));}
await writeFile(join(root,'catalog.json'),JSON.stringify({identity:dataset.identity,fixtureType:'authored-plugin-renderer-study-not-model-evaluation',profiles:catalog},null,2)+'\n');
await writeFile(join(root,'build-quality.json'),JSON.stringify({identity:dataset.identity,renderedPptx:render,visualReview:'not-reviewed',fontFamilies:['Noto Sans CJK SC','Noto Serif CJK SC'],requiredFontWeights:['Regular','Bold'],profiles:quality,limitations:['This script does not visually inspect images.','These authored records exercise the plugin renderer, not the DSH model authoring loop.','SVG/HTML previews do not establish PowerPoint/WPS fidelity.','A missingFonts=[] result does not certify font-weight selection or glyph coverage; inspect the actual render.','A regenerated bundle needs a new image review; prior approval is not inherited.']},null,2)+'\n');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const gallery=catalog.map(entry=>`<section id="${entry.id}"><h2>${esc(entry.label)}</h2><p>${esc(entry.description)}</p><div class="pages">${entry.pages.map((page,i)=>`<figure><a href="${esc(page.png||page.svg)}"><img src="${esc(page.png||page.svg)}" alt="${esc(page.title)}"></a><figcaption>${i+1}. ${esc(page.title)}${page.png?'（实际 PPTX 渲染）':'（SVG 预览，尚非 PPTX 渲染）'}</figcaption></figure>`).join('')}</div><p><a href="${esc(entry.pptx)}">可编辑 PPTX</a> · <a href="${esc(entry.html)}">HTML 预览</a> · <a href="${esc(entry.deck)}">可重建记录</a></p></section>`).join('\n');
await writeFile(join(root,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>六种学术阅读方式，同一份证据</title><style>body{max-width:1400px;margin:auto;padding:36px 28px;color:#202a35;background:#fafafa;font:17px/1.65 "Noto Sans CJK SC",sans-serif}h1{font-size:34px;line-height:1.3}h2{font-size:25px;margin-bottom:8px}section{margin:56px 0 70px}a{color:#245e86}.intro{max-width:1000px}.pages{display:grid;grid-template-columns:1fr 1fr;gap:22px}figure{margin:0}img{width:100%;height:auto;border:1px solid #d7dce0;display:block}figcaption{font-size:14px;margin-top:8px}.notice{padding:15px 0;border-top:1px solid #bac6d2;border-bottom:1px solid #bac6d2}nav{display:flex;flex-wrap:wrap;gap:12px 25px}@media(max-width:850px){.pages{grid-template-columns:1fr}}@media print{section{break-inside:avoid}}</style><header><h1>六种学术阅读方式，同一份证据</h1><p class="intro">同样的四站点教学数据，以研究研讨、正式答辩、理论与方法、论文精读、证据综合、田间观测六种方式展开。每组都有结果页与方法或边界页，比较的是阅读路径、图表组织与论证重点。</p><p class="notice">全部数值为可重算的教学构造，未训练模型，也未实施田间试验。此展示验证插件的原生渲染与设计表达，不代表 DSH Agent 端到端生成质量。</p><nav>${catalog.map(e=>`<a href="#${e.id}">${esc(e.label)}</a>`).join('')}</nav><p><a href="teaching-data.json">输入数据与计算</a> · <a href="catalog.json">样张目录</a>${render?' · <a href="montage.png">实际 PPTX 全稿概览</a>':''}</p></header>${gallery}</html>\n`);
console.log(JSON.stringify({output:root,profiles:catalog.length,slides:12,renderedPptx:render,visualReview:'not-reviewed'}));
