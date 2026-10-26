#!/usr/bin/env node
/** v0.8.3 editorial component references. Not full-slide templates; all images are
 * deterministic synthetic placeholders. Reconstructed card furniture is native. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const pptxgen=require('pptxgenjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=process.argv[2]||path.join(root,'skills/dsh-academic-ppt/references/editorial-v083');
const W=600,H=306,ink='#20303F',muted='#64727B',light='#DDE4E8';
const themes={sage:{main:'#2F554B',line:'#BCCFC7',soft:'#EEF3EF',tint:'#DDE9E0',secondary:'#9B7056'},slate:{main:'#183955',line:'#C9D3DF',soft:'#F0F4F8',tint:'#DFE8F0',secondary:'#BC8260'},wine:{main:'#783B4B',line:'#E2CBD0',soft:'#F9F2F4',tint:'#F2E2E6',secondary:'#A86667'},teal:{main:'#146C75',line:'#BFD5D8',soft:'#EEF6F6',tint:'#DDEEEF',secondary:'#C28A50'},stone:{main:'#4D555C',line:'#D6DBDE',soft:'#F3F4F2',tint:'#E6EAE7',secondary:'#557884'}};
const specs=[
 ['C01','双图证据','pair','同化前后对照','slate','figure-pair',2,'两图共享尺度；结论紧邻图'],
 ['C02','总体与局部','overview','总览与关键局部','sage','figure-zoom',3,'放大图需有实际裁切来源'],
 ['C03','图证读数','metrics','精度与稳定性','wine','figure-metrics',1,'指标不等于结果大小'],
 ['C04','二维矩阵','matrix','尺度 × 条件','slate','figure-matrix',4,'比较前先对齐维度'],
 ['C05','观察更新检验','sequence','观测 · 更新 · 验证','teal','figure-sequence',3,'阶段必须有真实对应关系'],
 ['C06','证据边界','boundary','适用范围与缺口','sage','figure-conditions',1,'限制和判断一起出现'],
 ['C07','问题点标注','callout','聚焦关键现象','slate','figure-observation',1,'注释指向图内具体位置'],
 ['C08','双参数比较','twoplots','两组状态响应','wine','figure-pair',2,'共享样本与统计口径'],
 ['C09','方法与变量','formula','状态更新逻辑','teal','method-equation',1,'不擅自改写公式与符号'],
 ['C10','结论证据链','source','原图如何支持结论','stone','figure-caption',1,'来源紧跟原图与解释'],
 ['C11','多图放大','zoom','区域差异的两个窗口','sage','figure-overview-details',3,'局部取景必须可追溯'],
 ['C12','光谱证据','spectral','波段与响应','wine','figure-metrics',1,'数据线由原文替换'],
 ['C13','作物生长阶段','progress','时序进展','teal','figure-sequence',3,'阶段有真实时间顺序'],
 ['C14','多源观测','mosaic','光学 · 雷达 · 模型','slate','figure-sequence',3,'分别标注各源与限制'],
 ['C15','图注与条件','caption','结果成立的条件','sage','figure-conditions',1,'保留原图坐标图例'],
 ['C16','交互比较','cross','多层级验证','wine','figure-matrix',4,'不可比较的口径勿硬排'],
 ['C17','空间热度','legend','空间分布与图例','sage','figure-caption',1,'色标和空间尺度完整'],
 ['C18','模拟对照','scatter','模型与观测的核对','slate','figure-metrics',1,'独立样本与基线同列'],
 ['C19','剖面机制','soil','土层条件与响应','stone','figure-observation',1,'物理边界可见'],
 ['C20','进展与不足','scope','已支持 · 待验证','teal','boundary-scope',1,'一张图两个结论域']
].map(([id,category,layout,title,theme,preset,figureSlots,principle])=>({id,category,layout,title,theme,preset,figureSlots,principle,componentOnly:true,scaleHint:'局部组件；宽占正文内容区约35–65%，组合后仍应保持图内标签可读',provenance:'原创设计重构；含合成占位图，不是论文数据'}));
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),hex=(a)=>'#'+a.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
function art(kind,seed=1){
  const w=460,h=228,px=new Uint8Array(w*h*4),set=(x,y,c)=>{if(x<0||y<0||x>=w||y>=h)return;let off=(y*w+x)*4;px[off]=c[0];px[off+1]=c[1];px[off+2]=c[2];px[off+3]=255};
  const rect=(x,y,ww,hh,c)=>{c=Array.isArray(c)?c:rgb(c);for(let yy=Math.max(0,y|0);yy<Math.min(h,Math.ceil(y+hh));yy++)for(let xx=Math.max(0,x|0);xx<Math.min(w,Math.ceil(x+ww));xx++)set(xx,yy,c)};
  const line=(x1,y1,x2,y2,c,t=2)=>{c=Array.isArray(c)?c:rgb(c);const n=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)));for(let k=0;k<=n;k++){const x=x1+(x2-x1)*k/n,y=y1+(y2-y1)*k/n;rect(x-t/2,y-t/2,t,t,c)}};
  const dot=(cx,cy,r,c)=>{c=Array.isArray(c)?c:rgb(c);for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(x*x+y*y<=r*r)set(Math.round(cx+x),Math.round(cy+y),c)};
  let s=seed|0;const rnd=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
  rect(0,0,w,h,'#EDF2F1');
  if(['field','overview','crop'].includes(kind)){
    const p=['#527D56','#86A06D','#A6B588','#C2BB8E','#7B9D81','#B0A381','#385F56'];
    for(let y=0;y<h;y+=18+rnd()*18){let x=0;while(x<w){let ww=34+rnd()*92;rect(x+2,y+1,ww-3,19,p[(rnd()*p.length)|0]);for(let i=0;i<5;i++)line(x+5+i*ww/6,y+2,x+5+i*ww/6,y+17,'#59765C',1);x+=ww;}}
    for(let i=0;i<5;i++)line(30+i*80,0,50+i*80,h,'#D8D9CA',5);
    for(let i=0;i<80;i++)dot(rnd()*w,rnd()*h,1+rnd()*3,'#2F6753');
  }else if(['heat','matrix','remote'].includes(kind)){
    const pal=['#315D81','#478FA0','#83AAB3','#D6D9B1','#E2B979','#CF8665','#7FA596'];
    for(let y=0;y<h;y+=18)for(let x=0;x<w;x+=18){const v=Math.sin(x*.015+seed)+Math.cos(y*.024-seed)+rnd()*1.5;rect(x,y,18,18,pal[Math.max(0,Math.min(pal.length-1,Math.floor((v+3.5)/7*pal.length)))]);}
    for(let i=0;i<8;i++)line(rnd()*w,0,rnd()*w,h,'#E8ECE6',2);
  }else if(['line','trend','spectral'].includes(kind)){
    rect(0,0,w,h,'#F8FAFB');for(let i=0;i<7;i++)line(25,20+i*31,w-25,20+i*31,'#DEE6E9',1);for(let i=0;i<9;i++)line(25+i*51,20,25+i*51,h-19,'#E7ECEE',1);
    const graphs=kind==='spectral'?2:3;const colors=['#2B6684','#8A4658','#4A9788'];
    for(let c=0;c<graphs;c++){let prev=null;for(let x=20;x<w-20;x+=3){const a=x/(w-40),peak=kind==='spectral'?110*Math.exp(-(((a-(.23+c*.28))/.12)**2)):0;const y=kind==='spectral'?h-28-peak-c*8:(160-45*Math.sin(a*7+c*.6)-24*a-c*12);if(prev)line(prev[0],prev[1],x,y,colors[c],2);prev=[x,y]}}
  }else if(kind==='scatter'){
    rect(0,0,w,h,'#F8FAFB');for(let i=0;i<8;i++){line(40+i*52,15,40+i*52,h-25,'#E0E7EC',1);line(35,20+i*25,w-20,20+i*25,'#E0E7EC',1)}line(45,h-30,w-30,22,'#7D9BA7',2);for(let i=0;i<90;i++){const x=45+rnd()*(w-90),yy=h-30-(x-45)*(h-60)/(w-75)+(rnd()-.5)*65;dot(x,yy,2+rnd()*2,i%3===0?'#BB8264':'#307E91');}
  }else if(kind==='soil'){
    const bands=['#DBD1B9','#B7A184','#91785C','#685948'];for(let j=0;j<4;j++)rect(0,j*h/4,w,h/4,bands[j]);for(let i=0;i<45;i++){const x=rnd()*w,y=rnd()*h;line(x,y,x+rnd()*22,y+5+rnd()*22,'#C5B99D',1)}for(let i=0;i<9;i++)line(w/2,0,w/2+Math.sin(i*.4)*i*15,i*25,'#E9E0C6',2);
  }else{
    rect(0,0,w,h,'#F5F7F8');for(let i=0;i<5;i++){let x=30+i*90;rect(x,48,62,108,['#CBDCE2','#CDE4DF','#E6DFD6'][i%3]);rect(x+8,63,46,6,'#728B99');rect(x+8,86,31,5,'#92A6AA');rect(x+8,104,40,5,'#92A6AA');if(i<4)line(x+63,102,x+88,102,'#5D7B8C',2)}
  }
  // no axis values, geolocations, or fabricated results in placeholders
  const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let j=0;j<8;j++)c=c&1?(0xEDB88320^(c>>>1)):(c>>>1);return c>>>0});
  const crc=b=>{let c=0xffffffff;for(let i=0;i<b.length;i++)c=crcTable[(c^b[i])&255]^(c>>>8);return(c^0xffffffff)>>>0};
  const chunk=(name,b)=>{const t=Buffer.from(name),len=Buffer.alloc(4),cc=Buffer.alloc(4);len.writeUInt32BE(b.length);cc.writeUInt32BE(crc(Buffer.concat([t,b])));return Buffer.concat([len,t,b,cc])};
  const raw=Buffer.alloc(h*(1+w*4));for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;Buffer.from(px.buffer,y*w*4,w*4).copy(raw,y*(w*4+1)+1)}
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',deflateSync(raw,{level:8})),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}
const artCache=new Map(), getArt=(kind,seed=1)=>{const key=kind+seed;if(!artCache.has(key))artCache.set(key,art(kind,seed));return artCache.get(key)};
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function drawCard(s){
 const p=themes[s.theme],ops=[];
 const R=(x,y,w,h,fill='#FFFFFF',stroke='none',rad=0)=>ops.push({k:'rect',x,y,w,h,fill,stroke,rad}), L=(x1,y1,x2,y2,c=p.line,sw=1)=>ops.push({k:'line',x1,y1,x2,y2,c,sw}), T=(v,x,y,w,h,size=15,c=ink,bold=false,align='left')=>ops.push({k:'text',v,x,y,w,h,size,c,bold,align}), I=(kind,x,y,w,h,seed=1)=>ops.push({k:'image',kind,x,y,w,h,data:getArt(kind,seed)});
 const label=(v,x,y,w=110)=>{R(x,y,w,24,p.soft,'none',3);T(v,x+8,y+4,w-16,16,13,p.main,true)};
 const sub=(v,x,y,w)=>T(v,x,y,w,18,13,muted);
 R(1,1,W-2,H-2,'#FFFFFF',p.line,8);R(16,16,39,22,p.main,'none',3);T(s.id,23,19,31,16,13,'#FFFFFF',true);T(s.category,64,18,132,20,12,muted);
 T(s.title,17,47,563,34,25,p.main,true);L(17,87,583,87,p.line,1);
 const figure=(kind,x,y,w,h,seed)=>{I(kind,x,y,w,h,seed);R(x,y,w,h,'none',p.line,3);T('示意图位',x+6,y+h-21,65,15,11,'#FFFFFF',true)};
 const band=(txt,y=268)=>{R(16,y,568,24,p.soft,'none',3);R(16,y,4,24,p.secondary);T(txt,27,y+3,549,17,13,p.main,true)};
 switch(s.layout){
 case 'pair':
   figure('field',17,101,269,123,1);figure('heat',314,101,269,123,2);
   label('条件 A',17,228,84);label('条件 B',314,228,84);sub('同一评价窗口',111,230,160);sub('相同观测支持',407,230,168);band('按相同样本、变量和尺度对照',263);break;
 case 'overview':
   figure('overview',17,104,351,148,3);figure('crop',379,104,202,68,4);figure('crop',379,182,202,70,5);
   L(337,145,376,135,p.main,2);L(337,205,376,214,p.main,2);label('整体图',17,256,75);sub('上：局部 1  /  下：局部 2',112,258,340);break;
 case 'metrics':
   figure('line',17,101,567,116,6);T('RMSE',22,229,134,29,24,p.main,true);T('R²',309,229,83,28,24,p.main,true);L(287,227,287,263,p.line);sub('误差幅度',159,237,116);sub('关系强度',402,237,120);band('比较指标须来自同一验证集',268);break;
 case 'matrix':
   T('尺度 / 条件',17,99,103,18,12,muted);label('A',143,96,190);label('B',363,96,190);
   label('地块',16,135,75);label('区域',16,198,75);
   figure('field',100,126,225,64,8);figure('heat',335,126,245,64,9);figure('heat',100,198,225,57,10);figure('field',335,198,245,57,11);
   band('相同空间支持与指标，再解释差异',266);break;
 case 'sequence':
   for(let i=0;i<3;i++){const x=17+i*191;label(['观察','更新','验证'][i],x,99,150);figure(['field','flow','scatter'][i],x,128,176,113,12+i);if(i<2)T('→',x+177,175,20,25,19,p.secondary,true)}
   band('真实步骤与真实图像一一对应',263);break;
 case 'boundary':
   label('对象：已观测地块',17,98,170);label('条件：固定时间窗',200,98,175);figure('heat',17,131,565,110,15);
   T('已支持',20,247,80,17,14,p.main,true);sub('当前条件下的关系',97,248,169);T('待验证',299,247,80,17,14,p.secondary,true);sub('跨区与跨年迁移',378,248,185);break;
 case 'callout':
   figure('field',17,103,393,150,16);T('① 关键位置',424,118,150,21,16,p.main,true);sub('指出图中的区域',425,145,155);L(331,164,420,149,p.secondary,1.5);T('② 条件',424,191,142,20,16,p.main,true);sub('保留采集尺度',424,217,157);band('短注释直接对应可见证据',269);break;
 case 'twoplots':
   figure('line',17,111,274,122,17);figure('spectral',309,111,274,122,18);label('变量 A',17,240,102);label('变量 B',309,240,102);sub('共同基线',129,243,149);sub('独立测量',419,243,145);band('不把不同物理量直接排名',269);break;
 case 'formula':
   R(17,105,314,148,p.soft,'none',5);T('MODEL UPDATE',32,161,275,37,24,p.main,true);label('模型预测',347,105,217);label('观测输入',347,149,217);label('误差权重',347,193,217);band('公式、变量定义及假设须来自文献',265);break;
 case 'source':
   R(17,104,7,149,p.main);figure('heat',32,104,357,149,19);T('读图焦点',405,116,164,20,17,p.main,true);sub('先观察共同特征',405,144,154);L(403,168,578,168,p.line);sub('再说明适用范围',405,181,167);band('来源：作者、年份、图号（占位）',268);break;
 case 'zoom':
   figure('field',17,103,347,145,20);figure('crop',374,103,207,66,21);figure('soil',374,181,207,66,22);L(323,151,373,134,p.main,1.5);L(323,206,373,211,p.main,1.5);band('总览—局部 A—局部 B',266);break;
 case 'spectral':
   figure('spectral',17,102,568,124,23);label('响应窗口',17,234,152);label('噪声范围',203,234,152);label('比较条件',389,234,152);band('峰位、轴名与波长范围不能被裁切',270);break;
 case 'progress':
   for(let i=0;i<3;i++){const x=18+i*189;figure(['field','soil','crop'][i],x,105,174,120,24+i);T(['生长期','成熟期','验证期'][i],x,231,174,20,15,p.main,true,'center')}
   band('阶段先后关系来自实际试验记录',267);break;
 case 'mosaic':
   figure('field',17,103,264,115,27);figure('heat',296,103,287,115,28);figure('flow',17,229,165,36,29);T('多源观测',203,234,115,20,16,p.main,true);sub('同一时间与空间基准',328,235,246);break;
 case 'caption':
   label('采样条件',18,98,126);label('验证对象',154,98,126);label('指标口径',290,98,126);figure('scatter',17,138,564,113,30);band('图注服务判断，不用长段正文替代图像',268);break;
 case 'cross':
   label('条件 A',142,97,171);label('条件 B',335,97,171);T('I',37,145,20,23,20,p.main,true);T('II',37,221,34,23,20,p.main,true);
   figure('heat',92,124,224,66,31);figure('heat',329,124,253,66,32);figure('line',92,200,224,60,33);figure('scatter',329,200,253,60,34);break;
 case 'legend':
   figure('heat',18,104,440,154,35);R(470,104,112,154,p.soft,'none',2);T('图例',478,113,97,18,14,p.main,true);for(let i=0;i<5;i++){R(483,144+i*21,19,13,['#34739A','#64A4AF','#AFCABD','#E8D399','#B8856C'][i]);T(['范围 1','范围 2','范围 3','范围 4','范围 5'][i],511,141+i*21,70,18,11,ink)}band('色标、尺度、方向与单位均独立可编辑',268);break;
 case 'scatter':
   figure('scatter',17,104,349,145,36);R(379,103,202,145,p.soft,'none',3);T('评价口径',392,116,170,24,17,p.main,true);sub('独立样本',392,153,162);sub('同一训练测试划分',392,178,174);sub('保留 1:1 参照',392,209,176);band('数值读数从论文登记，非图像猜测',268);break;
 case 'soil':
   figure('soil',17,104,343,150,37);T('剖面水分',375,115,188,22,17,p.main,true);sub('同化变量深度',375,146,196);L(374,172,565,172,p.line);T('边界条件',375,185,188,22,17,p.main,true);sub('表层与深层区分',375,216,183);band('记录深度、时刻、土层与采样支持',269);break;
 case 'scope':
   figure('heat',17,103,565,122,38);R(17,237,269,40,p.soft,'none',3);R(296,237,285,40,p.tint,'none',3);T('已支持 · 当前地块',26,249,249,22,15,p.main,true);T('待验证 · 新环境',306,249,267,22,15,p.main,true);break;
 }
 // All provenance/safety messages live in the catalog and outside card previews,
 // no fake author/paper names, no generated data values.
 return ops;
}
function svgFromOps(ops){let body='';for(const o of ops){if(o.k==='rect')body+=`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="${o.rad||0}" fill="${o.fill}" stroke="${o.stroke==='none'?'none':o.stroke}" stroke-width="1"/>`;if(o.k==='line')body+=`<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="${o.c}" stroke-width="${o.sw}"/>`;if(o.k==='text')body+=`<text x="${o.x+(o.align==='center'?o.w/2:0)}" y="${o.y+o.size*1.03}" font-family="Noto Sans CJK SC, Microsoft YaHei, sans-serif" font-size="${o.size}" font-weight="${o.bold?700:400}" text-anchor="${o.align==='center'?'middle':'start'}" fill="${o.c}">${esc(o.v)}</text>`;if(o.k==='image')body+=`<image x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${o.data}"/>`;}
return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><title>局部信息卡参考，不是PPT整页布局</title>${body}</svg>`}
function pptDraw(slide,ops,x,y,sc){const ST=pptx.ShapeType;for(const o of ops){const c=hex=>hex?.replace(/^#/,'')||'FFFFFF';if(o.k==='rect')slide.addShape(o.rad?ST.roundRect:ST.rect,{x:x+o.x*sc,y:y+o.y*sc,w:o.w*sc,h:o.h*sc,rectRadius:0.02,line:o.stroke==='none'?{color:c(o.fill),transparency:100}:{color:c(o.stroke),width:.7},fill:o.fill==='none'?{color:'FFFFFF',transparency:100}:{color:c(o.fill)}});else if(o.k==='line')slide.addShape(ST.line,{x:x+o.x1*sc,y:y+o.y1*sc,w:(o.x2-o.x1)*sc,h:(o.y2-o.y1)*sc,line:{color:c(o.c),width:o.sw*.65}});else if(o.k==='text')slide.addText(o.v,{x:x+o.x*sc,y:y+o.y*sc,w:o.w*sc,h:o.h*sc,margin:0,fontFace:'Noto Sans CJK SC',fontSize:o.size*sc*72*.92,bold:o.bold,color:c(o.c),align:o.align||'left',breakLine:false,fit:'shrink',valign:'mid'});else if(o.k==='image')slide.addImage({data:'data:image/png;base64,'+o.data,x:x+o.x*sc,y:y+o.y*sc,w:o.w*sc,h:o.h*sc});}}
const pptx=new pptxgen();pptx.layout='LAYOUT_WIDE';pptx.author='DSH Academic PPT';pptx.subject='v0.8.3 scientific modular editorial card design references; synthetic images, editable furniture';pptx.title='Academic components, NOT full slide layouts';pptx.lang='zh-CN';
await fs.mkdir(path.join(output,'cards'),{recursive:true});let gallery='';
for(const [i,s] of specs.entries()){
 const ops=drawCard(s),svg=svgFromOps(ops);await fs.writeFile(path.join(output,'cards',s.id+'.svg'),svg);gallery+=`<article data-label="${esc([s.id,s.title,s.category,s.layout].join(' '))}"><header><b>${esc(s.id)} · ${esc(s.category)}</b><span>${esc(s.title)}</span></header><div class="figure"><img loading="lazy" src="cards/${s.id}.svg" alt="${esc(s.title)}"/></div><p><strong>内部关系：</strong>${esc(s.principle)}</p><p><strong>映射：</strong><code>${esc(s.preset)}</code> · ${s.figureSlots} 个图位</p></article>`;
 const idx=Math.floor(i/4);let slide=pptx._slides[idx];if(!slide){slide=pptx.addSlide();slide.background={color:'F4F6F6'};slide.addText('0.8.3 · ACADEMIC CARD COMPONENTS',{x:.4,y:.18,w:10,h:.25,fontFace:'Noto Sans CJK SC',fontSize:11,color:'7B8791',bold:true,margin:0});slide.addText('一页四张局部卡片 · 并非整页版式模板',{x:9.5,y:.18,w:3.45,h:.26,fontFace:'Noto Sans CJK SC',fontSize:10,color:'637481',align:'right',margin:0});}
 const cell=i%4,cx=cell%2,cy=Math.floor(cell/2),sx=.4+cx*6.45,sy=.63+cy*3.35,sc=5.98/W;
 pptDraw(slide,ops,sx,sy,sc);slide.addText(`${s.id} · ${s.category} · ${s.preset}`,{x:sx,y:sy+H*sc+.04,w:5.98,h:.18,fontFace:'Noto Sans CJK SC',fontSize:9,color:'768592',margin:0});
}
const css=`*{box-sizing:border-box}body{font:15px/1.55 system-ui, sans-serif;background:#F5F7F6;color:#243647;margin:0}.head{padding:32px min(7vw,85px) 20px;border-bottom:1px solid #DCE5E7;background:white}.head h1{font-size:30px;margin:0}.head p{max-width:750px;color:#667782}.head input{width:min(480px,95%);border:1px solid #BAC5CF;border-radius:6px;padding:10px 12px;font:inherit}.grid{max-width:1500px;padding:26px;margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(450px,1fr));gap:20px}article{border:1px solid #E2E7EB;background:white;border-radius:9px;padding:18px}article header{display:flex;gap:16px;align-items:baseline;justify-content:space-between}article b{color:#355970}article header span{font-weight:700;font-size:18px}.figure img{width:100%;height:auto;max-height:440px;object-fit:contain;display:block}article p{font-size:13px;margin:4px 0;color:#576771}code{color:#2D6573}`;
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>0.8.3 学术卡片 · 组件参考</title><style>${css}</style></head><body><section class="head"><h1>学术汇报局部卡片 · 0.8.3</h1><p>独立卡片组件，不是 PPT 整页布局。候选来自生图探索后的原创结构复刻；图像是合成演示素材，正式使用必须替换为已核对论文图。卡片结构、中文标题、线框和图注在PPTX中是可编辑对象。</p><input id="q" placeholder="搜索卡片名称、类别、布局或编号"/></section><main class="grid">${gallery}</main><script>document.querySelector('#q').addEventListener('input',e=>{let q=e.target.value.toLowerCase().trim();for(let el of document.querySelectorAll('article'))el.hidden=!el.dataset.label.toLowerCase().includes(q)});</script></body></html>`;
await fs.writeFile(path.join(output,'index.html'),html);await fs.writeFile(path.join(output,'catalog.json'),JSON.stringify({version:'0.8.3',type:'local-card-components',source:'image-generated design studies interpreted as native modular components',notes:['不是整页布局','所有合成图为视觉占位而非科研证据','正式PPT应按实际内容缩减或展开卡片内部结构','每张卡可用既有预设或原生对象重组'],cards:specs},null,2)+'\n');
await pptx.writeFile({fileName:path.join(output,'editorial-card-components-20.pptx')});
console.log(JSON.stringify({ok:true,cards:specs.length,pptx:path.join(output,'editorial-card-components-20.pptx'),html:path.join(output,'index.html')}));
