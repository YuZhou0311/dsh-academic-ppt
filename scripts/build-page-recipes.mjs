#!/usr/bin/env node
/** Build an original editable atlas. No commercial templates or remote assets. */
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {PAGE_RECIPES,compilePageRecipe} from '../src/page-recipes.mjs';
import {renderProject} from '../src/render.mjs';
import {wrapText} from '../src/scene.mjs';
import {DEFAULT_DESIGN} from '../src/core.mjs';

let output,font='微软雅黑';
const args=process.argv.slice(2);
for(let i=0;i<args.length;i++){
 if(args[i]==='--output'&&args[i+1])output=args[++i];
 else if(args[i]==='--font'&&args[i+1])font=args[++i];
 else if(args[i]==='--help'){console.log('node scripts/build-page-recipes.mjs --output NEW_DIRECTORY [--font FONT_FAMILY]\nBuilds 32 original native editable page studies, SVG/HTML previews, catalogue and records. All visuals are conceptual or explicitly synthetic, with no research findings. Existing output directories are never overwritten.');process.exit(0);}
 else throw new Error('Unknown or incomplete argument: '+args[i]);
}
if(!output)throw new Error('Supply --output NEW_DIRECTORY');
const root=resolve(output);await mkdir(dirname(root),{recursive:true});await mkdir(root);await mkdir(join(root,'slides'));
const C={ink:'#18344C',blue:'#235F89',teal:'#327C72',rust:'#B6684C',muted:'#657887',line:'#CFDCE5',soft:'#EEF4F8',mint:'#EEF5F0',paper:'#FFFFFF'};
const contentBox={x:48,y:176,w:1184,h:460};
function painter(w,h){
 const elements=[];let serial=0;
 const add=element=>{elements.push({id:'e'+(++serial),...element});return element;};
 const text=(value,x,y,width,size=28,opts={})=>{
  const lines=wrapText(value,width,size,{bold:opts.bold??false}),height=lines.length*size*1.2+2;
  if(x<0||y<0||width<1||x+width>w+.1||y+height>h+.1)throw new Error('Atlas text does not fit: '+value+' @ '+[w,h,x,y,width,height]);
  return add({kind:'text',x,y,w:width,h:height,text:value,fontSize:size,role:opts.role??'body',color:opts.color??C.ink,bold:opts.bold??false,align:opts.align??'left',lineHeight:1.2});
 };
 const rect=(x,y,width,height,fill=C.soft,stroke='none',role='group')=>add({kind:'rect',x,y,w:width,h:height,fill,stroke,strokeWidth:1.5,role});
 const ellipse=(x,y,width,height,fill=C.teal)=>add({kind:'ellipse',x,y,w:width,h:height,fill,stroke:'none',role:'data'});
 const line=(points,opts={})=>{
  const clean=points.filter((point,index)=>index===0||Math.hypot(point[0]-points[index-1][0],point[1]-points[index-1][1])>=.01);
  if(clean.length<2)return;
  return add({kind:'line',points:clean.map(([x,y])=>({x,y})),stroke:opts.color??C.blue,strokeWidth:opts.width??2,role:opts.role??'decoration',...(opts.arrow?{endArrow:true}:{}),...(opts.dash?{dash:'dash'}:{})});
 };
 const heading=(value,color=C.blue)=>text(value,0,0,w,24,{bold:true,color,role:'label'});
 const node=(value,x,y,width,height=60,color=C.blue)=>{
  rect(x,y,width,height,C.paper,C.line);
  rect(x,y,5,height,color);
  const th=wrapText(value,width-26,24,{bold:true}).length*28.8+2;
  text(value,x+14,y+(height-th)/2,width-26,24,{bold:true,role:'label',color});
  return {x,y,w:width,h:height,cx:x+width/2,cy:y+height/2};
 };
 const arrow=(a,b)=>line([a,b],{role:'relationship',arrow:true,color:C.teal});
 return {elements,add,text,rect,ellipse,line,heading,node,arrow,w,h};
}
function place(p,child,dx,dy){for(const element of child.elements){const {id,...value}=element;p.add(value.kind==='line'?{...value,points:value.points.map(point=>({x:point.x+dx,y:point.y+dy}))}:{...value,x:value.x+dx,y:value.y+dy});}}
function note(p,label,body,accent=C.teal){
 if(p.h<94){p.rect(0,0,5,p.h,accent);p.text(label+'：'+body,18,Math.max(0,(p.h-36)/2),p.w-28,28);return;}
 p.line([[0,1],[Math.min(p.w,70),1]],{color:accent,width:3});
 const title=p.text(label,0,14,p.w,24,{bold:true,color:accent,role:'label'});
 p.text(body,0,18+title.h,p.w,28);
}
function trend(p,label='合成趋势形态',variant=0){
 p.heading(label);
 const x=56,y=62,w=p.w-82,h=p.h-113;
 if(h<52){p.text('共享尺度与完整单位',0,40,p.w,24,{role:'label'});return;}
 for(let i=0;i<4;i++)p.line([[x,y+i*h/3],[x+w,y+i*h/3]],{color:C.line,width:1});
 p.line([[x,y],[x,y+h],[x+w,y+h]],{color:C.muted,width:1.5});
 const values=[[.18,.3,.47,.56,.76],[.28,.40,.39,.60,.68],[.60,.5,.53,.38,.45],[.18,.52,.42,.76,.66]];
 [0,1].forEach(s=>{
  const v=values[(variant+s)%values.length],pts=v.map((v,i)=>[x+w*i/4,y+h*(1-v)]);
  p.line(pts,{color:s?C.teal:C.blue,width:3,role:'data'});
  for(const [xx,yy]of pts)p.ellipse(xx-4,yy-4,8,8,s?C.teal:C.blue);
 });
 p.text('共同观测窗口',x,y+h+14,w,24,{role:'label',color:C.muted,align:'center'});
}
function scatter(p,label='个体观测分布'){
 p.heading(label);const left=55,top=60,hh=p.h-118,ww=p.w-88;
 p.line([[left,top],[left,top+hh],[left+ww,top+hh]],{color:C.muted});
 const vals=[[.23,.34,.39,.52,.57,.64,.72,.81],[.29,.41,.45,.58,.64,.69,.79,.84]];
 vals.forEach((v,j)=>{const x=left+ww*(.28+j*.44);for(let i=0;i<v.length;i++)p.ellipse(x+(i%3-1)*14-4,top+hh*(1-v[i])-4,8,8,j?C.teal:C.blue);p.text('条件 '+(j?'B':'A'),x-65,top+hh+15,130,24,{role:'label',align:'center'});});
}
function bars(p){
 p.heading('合成消融数据，仅演示排列');const x=132,y=62,w=p.w-x-30,h=p.h-y-55,rh=h/3;
 p.line([[x,y],[x,y+h],[x+w,y+h]],{color:C.muted});
 for(let j=0;j<4;j++){const xx=x+w*j/3;p.line([[xx,y],[xx,y+h]],{color:C.line,width:1});p.text(String(j),xx-12,y+h+10,32,24,{role:'label',color:C.muted});}
 ['完整方法','去掉 A','去掉 B'].forEach((v,i)=>{const yy=y+i*rh+rh*.28;p.text(v,0,yy,120,24,{role:'label'});p.rect(x+2,yy+2,w*[.76,.52,.61][i],28,i===0?C.blue:C.teal,'none','data');});
}
function compositeEvidence(p){
 const left=painter(p.w*.64,p.h);scatter(left,'A  合成观测分布');place(p,left,0,0);
 const upper=painter(p.w*.31,p.h*.47);map(upper,'B  局部结构',true);place(p,upper,p.w*.69,0);
 const lower=painter(p.w*.31,p.h*.43);note(lower,'共同条件','不同面板回答同一个问题，并共享对象与评价口径。');place(p,lower,p.w*.69,p.h*.57);
}
function intervals(p){
 p.heading('合成估计区间');const x=35,y=80,w=p.w-62,h=p.h-135;
 p.line([[x,y+h],[x+w,y+h]],{color:C.muted});
 for(let i=0;i<3;i++){const yy=y+h*(.2+i*.27),a=x+w*(.12+i*.12),z=x+w*(.55+i*.10);p.line([[a,yy],[z,yy]],{color:i===1?C.teal:C.blue,width:4,role:'data'});p.ellipse((a+z)/2-5,yy-5,10,10,i===1?C.teal:C.blue);}
 p.text('区间定义须明确',0,y+h+14,p.w,24,{role:'label',align:'center',color:C.muted});
}
function table(p,label,columns,rows){
 p.heading(label);const top=45,height=p.h-top-8,rowH=height/(rows.length+1),cw=p.w/columns.length;
 const all=[columns,...rows];
 for(let i=0;i<all.length;i++){
  p.rect(0,top+i*rowH,p.w,rowH,i===0?C.blue:(i%2?C.soft:C.paper));
  all[i].forEach((value,j)=>{
   const size=24,hh=wrapText(value,cw-20,size,{bold:i===0}).length*28.8+2;
   if(hh>rowH-8)throw new Error('Atlas table cell too tall: '+value+' @ '+label);
   p.text(value,j*cw+10,top+i*rowH+(rowH-hh)/2,cw-20,size,{role:'label',bold:i===0,color:i===0?C.paper:C.ink});
  });
  p.line([[0,top+(i+1)*rowH],[p.w,top+(i+1)*rowH]],{color:C.line,width:1});
 }
}
function pipeline(p,label='真实操作与数据流'){
 p.heading(label);const names=['输入数据','模型推断','独立验证'],gap=34,nodeW=(p.w-gap*2)/3,cy=Math.max(80,(p.h-76)/2),height=Math.min(86,p.h-cy-15);
 const ns=names.map((t,i)=>p.node(t,i*(nodeW+gap),cy,nodeW,height,i===1?C.teal:C.blue));
 for(let i=0;i<2;i++)p.arrow([ns[i].x+ns[i].w+5,ns[i].cy],[ns[i+1].x-7,ns[i+1].cy]);
 if(cy>125){p.text('输入',ns[0].x,cy-45,nodeW,24,{role:'label',color:C.muted});p.text('变换',ns[1].x,cy-45,nodeW,24,{role:'label',color:C.muted});p.text('检验',ns[2].x,cy-45,nodeW,24,{role:'label',color:C.muted});}
}
function split(p,label='处理分配与共同评估'){
 p.heading(label);const nh=64,nw=Math.min(210,p.w*.28),center=p.w/2;
 const a=p.node('共同样本',center-nw/2,55,nw,nh),b=p.node('处理 A',30,p.h*.45,nw,nh),c=p.node('处理 B',p.w-30-nw,p.h*.45,nw,nh),d=p.node('共同评估',center-nw/2,p.h-72,nw,nh,C.teal);
 const joinY=a.y+a.h+18;p.line([[a.cx,a.y+a.h],[a.cx,joinY],[b.cx,joinY],[b.cx,b.y-6]],{role:'relationship',arrow:true});p.line([[a.cx,joinY],[c.cx,joinY],[c.cx,c.y-6]],{role:'relationship',arrow:true});
 const y=d.y-16;p.line([[b.cx,b.y+b.h],[b.cx,y],[d.cx,y],[d.cx,d.y-5]],{role:'relationship',arrow:true,color:C.teal});p.line([[c.cx,c.y+c.h],[c.cx,y],[d.cx,y]],{role:'relationship',color:C.teal});
}
function cycle(p){
 p.heading('预测、观测与状态更新');const nw=Math.min(220,p.w*.32),nh=72,left=10,right=p.w-nw-10,y1=65,y2=p.h-95;
 const a=p.node('预测状态',left,y1,nw,nh),b=p.node('创新量',right,y1,nw,nh,C.teal),c=p.node('观测信息',right,y2,nw,nh,C.rust),d=p.node('更新状态',left,y2,nw,nh,C.teal);
 p.arrow([a.x+a.w+7,a.cy],[b.x-8,b.cy]);p.arrow([c.cx,c.y-7],[b.cx,b.y+b.h+7]);p.arrow([d.cx,d.y-7],[a.cx,a.y+a.h+7]);
 p.line([[b.x+b.w+5,b.cy],[p.w-1,b.cy],[p.w-1,p.h-7],[d.cx,p.h-7],[d.cx,d.y+d.h+5]],{role:'relationship',arrow:true,color:C.teal});
 p.text('时间步推进',nw+25,p.h/2-15,p.w-nw*2-50,24,{role:'label',color:C.muted,align:'center'});
}
function swimlane(p){
 p.heading('并行数据源在同一阶段汇合');const y0=72,nh=64,gap=42,rail=112,nw=(p.w-rail-2*gap)/3;const labels=['采集','处理','分析'];
 for(let j=0;j<2;j++){
  const y=y0+j*180;p.rect(0,y-15,p.w,130,j?C.mint:C.soft);p.text(j?'数据源 B':'数据源 A',15,y+15,90,24,{role:'label',bold:true});
  const ns=labels.map((t,i)=>p.node(t,rail+i*(nw+gap),y,nw,nh,j?C.teal:C.blue));for(let i=0;i<2;i++)p.arrow([ns[i].x+nw+5,ns[i].cy],[ns[i+1].x-6,ns[i+1].cy]);
 }
 const xx=rail+nw+gap+nw/2;p.arrow([xx,y0+nh+8],[xx,y0+180-7]);
 p.text('共享信息',xx+12,y0+nh+24,160,24,{role:'label',color:C.teal});
}
function tree(p,label='研究任务与真实依赖',resource=false){
 p.heading(label);const nw=Math.min(250,p.w*.25),nh=68,x=p.w/2-nw/2,y1=58,y2=p.h*.43,y3=p.h-78;
 const a=p.node(resource?'资源总量':'共同问题',x,y1,nw,nh),bs=[p.node(resource?'设备资源':'观测任务',15,y2,nw,nh),p.node(resource?'测量资源':'方法任务',x,y2,nw,nh,C.teal),p.node(resource?'验证资源':'验证任务',p.w-15-nw,y2,nw,nh)],z=p.node(resource?'总量核对':'可核验交付物',x,y3,nw,nh,C.teal);
 for(const b of bs){const mid=y1+nh+20;p.line([[a.cx,a.y+a.h],[a.cx,mid],[b.cx,mid],[b.cx,b.y-6]],{role:'relationship',arrow:true});const mid2=y3-18;p.line([[b.cx,b.y+b.h],[b.cx,mid2],[z.cx,mid2],[z.cx,z.y-6]],{role:'relationship',arrow:true,color:C.teal});}
}
function evidenceMap(p){
 p.heading('来源与综合判断逐一对应');const nw=(p.w-50)/3,nh=92,y=80;
 const ns=['研究 A\n观察支持','研究 B\n机制补充','研究 C\n边界约束'].map((v,i)=>p.node(v,i*(nw+25),y,nw,nh,i===2?C.rust:i===1?C.teal:C.blue));
 const bottom=p.node('有条件的综合判断',p.w*.23,p.h-115,p.w*.54,80,C.teal),mid=p.h-145;
 for(const n of ns)p.line([[n.cx,n.y+n.h+5],[n.cx,mid],[bottom.cx,mid],[bottom.cx,bottom.y-6]],{role:'relationship',arrow:true,color:C.teal});
}
function map(p,label='空间网格示意',detail=false){
 p.heading(label);const top=50,ww=p.w-15,hh=p.h-top-15,nx=detail?5:9,ny=detail?3:6,cw=ww/nx,ch=hh/ny;
 const pal=['#DDEBD9','#BDD3B2','#8FB49C','#6E9C97','#C8DDE0'];
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)p.rect(x*cw,top+y*ch,cw-2,ch-2,pal[(x*3+y*2)%pal.length],'none','data');
 if(!detail){p.rect(cw,top+ch,cw*2,ch*2,'none',C.blue);p.rect(cw*6,top+ch*3,cw*2,ch*2,'none',C.rust);p.text('A',cw+6,top+ch+6,40,24,{role:'label',bold:true});p.text('B',cw*6+6,top+ch*3+6,40,24,{role:'label',bold:true});}
}
function heatmap(p){
 p.heading('条件空间示意');const x=90,y=54,w=p.w-110,h=p.h-105,nx=6,ny=3,cw=w/nx,ch=h/ny,pal=['#DEE9EF','#BBD1DA','#8EB5C1','#5591A2','#27667E','#20495E'];
 for(let r=0;r<ny;r++){p.text(['范围 A','范围 B','范围 C'][r],0,y+r*ch+(ch-30)/2,82,24,{role:'label'});for(let c=0;c<nx;c++)p.rect(x+c*cw,y+r*ch,cw-3,ch-3,pal[(r*2+c)%6],'none','data');}
 p.text('条件变化',x,y+h+12,w,24,{role:'label',align:'center',color:C.muted});
}
function timeline(p){
 p.heading('任务持续时间与交付节点');const x=180,y=58,w=p.w-x-10,h=p.h-y-8,steps=5,cw=w/steps,rh=h/4;
 for(let i=0;i<steps;i++){p.text('阶段 '+(i+1),x+i*cw,y-5,cw,24,{role:'label',align:'center'});p.line([[x+i*cw,y+35],[x+i*cw,p.h-5]],{color:C.line,width:1});}
 [['数据准备',0,2],['方法构建',1,3],['独立验证',3,2]].forEach(([label,start,len],i)=>{const yy=y+48+i*rh;p.text(label,0,yy,168,24,{role:'label'});p.rect(x+start*cw+6,yy+3,len*cw-14,26,i===2?C.teal:C.blue,'none','data');});
}
function decision(p){
 p.heading('预设判定保留两种结果');const nw=Math.min(230,p.w*.32),nh=70,cy=p.h/2-32;
 const a=p.node('独立检验',0,cy,nw,nh),b=p.node('支持假设',p.w-nw,72,nw,nh,C.teal),c=p.node('不支持假设',p.w-nw,p.h-95,nw,nh,C.rust);
 const xx=nw+(p.w-2*nw)/2;p.line([[a.x+a.w+6,a.cy],[xx,a.cy],[xx,b.cy],[b.x-6,b.cy]],{role:'relationship',arrow:true,color:C.teal});p.line([[xx,a.cy],[xx,c.cy],[c.x-6,c.cy]],{role:'relationship',arrow:true,color:C.rust});
 p.text('预定判断',xx+12,a.cy+16,150,24,{role:'label',color:C.muted});
}
function responseRows(p){
 p.heading('影响哪项判断，如何进一步检验');const top=60,rh=(p.h-top)/3,cols=[.27,.30,.31],gap=p.w*.06;
 [['样本范围','外推受限','新增独立验证'],['测量误差','估计不确定','检验误差传播'],['假设条件','解释有边界','预设反例检验']].forEach((values,i)=>{
  const y=top+i*rh+14,ws=cols.map(k=>p.w*k),xs=[0,ws[0]+gap,ws[0]+gap+ws[1]+gap];
  const ns=values.map((v,j)=>p.node(v,xs[j],y,ws[j],Math.min(78,rh-24),j===0?C.rust:j===2?C.teal:C.blue));for(let j=0;j<2;j++)p.arrow([ns[j].x+ns[j].w+5,ns[j].cy],[ns[j+1].x-6,ns[j+1].cy]);
 });
}
function equation(p){
 p.heading('概念表达式示意');p.text('更新状态 = 预测状态 + 校正项',0,Math.max(48,(p.h-58)/2),p.w,42,{bold:true,align:'center',color:C.blue});
}
function scales(p){
 p.heading('跨尺度映射保留支持范围');const labels=['观测尺度','过程尺度','决策尺度'],nodeW=p.w*.27,nh=74,gap=p.w*.09;
 const ys=[55,115,175].map(y=>Math.min(y,p.h-nh-8));const ns=labels.map((v,i)=>p.node(v,i*(nodeW+gap),ys[i],nodeW,nh,i===1?C.teal:C.blue));
 for(let i=0;i<2;i++){const xx=(ns[i].x+nodeW+ns[i+1].x)/2;p.line([[ns[i].x+nodeW+5,ns[i].cy],[xx,ns[i].cy],[xx,ns[i+1].cy],[ns[i+1].x-6,ns[i+1].cy]],{role:'relationship',arrow:true});}
}
const noteText={
 context:'测量对象、时间与环境决定现象的含义。',question:'哪些观测能够约束当前研究问题？',interpretation:'先描述观察，再解释支持的判断。',boundary:'证据之外的条件仍需独立检验。',conditions:'同一指标、样本定义与评价窗口。',sample:'报告 n、单位及区间定义。',assumptions:'保留假设、单位和适用范围。',scope:'不同研究的缺测与不可比项需保留。',gap:'把不足写成能够检验的关系。',inputs:'输入信息与使用条件明确。',validation:'验证集与训练信息保持区分。',states:'预测、观测与更新对象逐项对应。',controls:'实验单位、重复与对照保持可核查。',limits:'相关性支持与因果解释分别陈述。',supported:'在已检验条件内解释结果。',failure:'未测量条件不自动视为有效。',synthesis:'共同条件下的证据支持有边界的回答。',unresolved:'哪些条件仍缺少证据？',hypothesis:'将假设写成可以被支持或否定的关系。',acceptance:'每一里程碑对应可核验的产出。',answer:'回到开场问题，回答证据支持了什么。',
};
function drawSlot(recipe,slot,box,index){
 const p=painter(box.w,box.h),key=slot.id,id=recipe.id;
 if(key==='statistics'){table(p,slot.label,['统计量','单位','样本','区间'],[['预定义','完整保留','独立重复','明确类型']]);return p.elements;}
 if(key==='accounting'){
  if(id==='resource-allocation')table(p,slot.label,['类别','来源','核查'],[['设备','预算表','分类'],['测量','任务表','对应'],['总量','原始表','加总']]);
  else table(p,slot.label,['步骤','排除依据'],[['初筛','纳排标准'],['随访','失访记录'],['分析','缺测处理']]);
  return p.elements;
 }
 if(key==='factors'){table(p,slot.label,['因子 1','因子 2','组别'],[['低','低','A'],['低','高','B'],['高','低','C'],['高','高','D']]);return p.elements;}
 if(key==='interventions'){table(p,slot.label,['设置','变化'],[['基线','完整方法'],['消融 A','去掉 A'],['消融 B','去掉 B']]);return p.elements;}
 if(slot.role==='conditions'||slot.role==='explanation'||(slot.role==='synthesis'&&['question','gap','synthesis','answer','unresolved'].includes(key))){
  if(['statistics','accounting','factors','interventions'].includes(key)&&box.h>210)table(p,slot.label,['条件','核查项'],[['对象','分析单位'],['比较','共同尺度'],['边界','适用范围']]);
  else if(key==='symbols')table(p,slot.label,['符号','解释'],[['预测','模型输出'],['校正','观测约束']]);
  else if(key==='sources')table(p,'真实来源与定位',['来源','身份'],[['研究 A','支持'],['研究 B','补充'],['研究 C','冲突']]);
  else note(p,slot.label,noteText[key]??'保留与本页判断直接有关的条件。');
  return p.elements;
 }
 if(key==='pipeline')pipeline(p);
 else if(key==='swimlanes')swimlane(p);
 else if(key==='cycle')cycle(p);
 else if(key==='design')split(p);
 else if(key==='flow'){
  p.heading('样本流转');const nw=p.w*.74,x=(p.w-nw)/2,nh=70;const ns=['纳入样本','完成测量','分析样本'].map((v,i)=>p.node(v,x,60+i*130,nw,nh));for(let i=0;i<2;i++)p.arrow([ns[i].cx,ns[i].y+nh+6],[ns[i+1].cx,ns[i+1].y-7]);
 }
 else if(key==='allocation'&&id==='factorial-design')split(p,'处理分配与分析');
 else if(key==='mechanism')pipeline(p,'输入、作用与结果');
 else if(key==='equation')equation(p);
 else if(key==='scales')scales(p);
 else if(key==='test')decision(p);
 else if(key==='dependencies'||key==='allocation')tree(p,slot.label,id==='resource-allocation');
 else if(key==='timeline')timeline(p);
 else if(key==='responses')responseRows(p);
 else if(key==='overview')map(p,'总体空间与局部定位');
 else if(key.startsWith('detail-'))map(p,slot.label+'（结构示意）',true);
 else if(key==='landscape')heatmap(p);
 else if(key==='distribution')scatter(p);
 else if(key==='uncertainty')intervals(p);
 else if(key==='matrix'||key==='evidence-map')table(p,slot.label,['来源','对象','条件','证据'],[['研究 A','对象 A','窗口 A','支持'],['研究 B','对象 B','窗口 B','补充'],['研究 C','对象 A','窗口 C','有差异']]);
 else if(key==='argument-map')evidenceMap(p);
 else if(key==='delta'||key==='explanation')note(p,slot.label,'在相同评价口径下解释差异，保留替代解释。');
 else if(key==='support')pipeline(p,'已呈现证据的相互关系');
 else if(key==='known')trend(p,'已检验条件下的证据');
 else if(id==='hero-evidence')compositeEvidence(p);
 else if(key==='observation')map(p,'观察对象与空间关系示意');
 else if(id==='paired-comparison'||(id==='evidence-ledger'&&key==='evidence'))scatter(p,slot.label+'（合成观测）');
 else if(id==='before-after-delta'&&['before','after'].includes(key))map(p,slot.label+'（结构示意）',true);
 else if(key==='effects')bars(p);
 else trend(p,slot.label+'（形态示意）',index);
 return p.elements;
}
const slides=PAGE_RECIPES.map((recipe,i)=>{
 const bindings=Object.fromEntries(recipe.slots.map(slot=>[slot.id,{drawingIds:['art-'+slot.id]}]));
 const {slidePatch}=compilePageRecipe(recipe.id,{bindings,contentBox,rationale:recipe.grammar});
 const regions=slidePatch.composition.regions;
 const drawings=recipe.slots.map((slot,j)=>{const box=regions[j].box;return {id:'art-'+slot.id,width:box.w,height:box.h,elements:drawSlot(recipe,slot,box,j)};});
 return {id:recipe.id,title:String(i+1).padStart(2,'0')+'  '+recipe.name,kicker:'原创结构示意；不含真实研究结论或实验数据',paperIds:[],claimIds:[],figureIds:[],cards:[],notes:['适用：'+recipe.choose,'避免：'+recipe.avoid,'证据需要：'+recipe.evidenceNeed,'构图关系：'+recipe.grammar,'候选替代：'+recipe.alternatives.join(', '),'所有示意图均原创；图形形态用于显示信息关系，不能作为论文图或实际研究结果使用。'].join('\n\n'),seconds:30,heading:{box:{x:48,y:48,w:1184,h:57},fontSize:42,color:C.ink},...slidePatch,drawings};
});
const design={...structuredClone(DEFAULT_DESIGN),fontFamily:font,palette:{...DEFAULT_DESIGN.palette,ink:C.ink,accent:C.blue,secondary:C.teal,muted:C.muted,line:C.line,soft:C.soft,tint:C.soft,paper:C.paper,background:C.paper},chrome:{header:'plain',showBrand:false,showSection:false,showSources:false,showFooter:true,showPageNumber:true,showTopRule:false}};
const project={title:'DSH Academic PPT 0.9.0 原创学术页面语法',design,papers:[],claims:[],assets:[],slides};
const rendered=await renderProject(project);
const errors=rendered.issues.filter(issue=>issue.severity==='error');
await writeFile(join(root,'quality.json'),JSON.stringify({identity:'original-composition-studies-not-research-results',nativeSceneErrors:errors,visualApproval:'not-reviewed',notes:'A native PPTX render and visual review are still required. SVG previews are not proof of PowerPoint fidelity.'},null,2)+'\n');
if(errors.length)throw new Error('Atlas geometry failed: '+JSON.stringify(errors.slice(0,10)));
await writeFile(join(root,'academic-page-recipes-32.pptx'),rendered.pptx);
await writeFile(join(root,'index.html'),rendered.html);
await writeFile(join(root,'deck.json'),JSON.stringify(project,null,2)+'\n');
await writeFile(join(root,'catalog.json'),JSON.stringify(PAGE_RECIPES,null,2)+'\n');
for(const page of rendered.svgPages)await writeFile(join(root,'slides',page.id+'.svg'),page.svg);
console.log(JSON.stringify({output:root,slideCount:slides.length,pptx:join(root,'academic-page-recipes-32.pptx'),html:join(root,'index.html'),geometryErrors:errors.length,visualApproval:'not-reviewed',identity:'original-composition-studies-not-research-results'},null,2));
