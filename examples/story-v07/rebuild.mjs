#!/usr/bin/env node
/** Rebuild through the plugin's public core. No source edits, external services,
 * or automatically forged visual reviews. All output remains under this example. */
import {readFile, writeFile, mkdir, copyFile, stat} from 'node:fs/promises';
import {resolve, dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createProject, updateRecords, studyProject, checkProject, buildProject,
  renderProjectArtifact, editProject} from '../../src/core.mjs';
import {toolContract} from '../../src/tool-contract.mjs';

const TASK=dirname(fileURLToPath(import.meta.url));
const REPO=resolve(TASK,'../..');
const WORKSPACE=resolve(process.env.DSH_WORKSPACE_ROOT||dirname(REPO));
const phase=process.argv[2]||'all';
const OUT=resolve(process.argv[3]||join(TASK,'report'));
if(!['prepare','study','complete','all'].includes(phase))throw new Error('Use prepare|study|complete|all [output-directory]');
if(!OUT.startsWith(TASK+'/'))throw new Error('All output must remain inside this example directory');
const TMP=join(REPO,'.test-output/tmp');
process.env.TMPDIR=TMP;
const FONTS=process.env.DSH_FONT_DIRS?JSON.parse(process.env.DSH_FONT_DIRS):[join(WORKSPACE,'visual-qa/fonts')];
const INPUT=resolve(process.env.DSH_INPUT_DIR||join(TASK,'sources'));
const json=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const readJSON=async p=>JSON.parse(await readFile(p,'utf8'));
const sameRecords=(a,b)=>JSON.stringify([...a].sort((x,y)=>x.id.localeCompare(y.id)))===JSON.stringify([...b].sort((x,y)=>x.id.localeCompare(y.id)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const sim='教学模拟数据';
const title='改性工艺的疲劳寿命差异：现有证据与下一步验证';
const C={ink:'#202A35',accent:'#254B6E',modified:'#86673F',muted:'#526170',line:'#BAC6D2',soft:'#F1F4F7',paper:'#FFFFFF',secondary:'#6D5868'};
const P=['protocol','fatigue'];
const sid=id=>id.replace(/[^A-Za-z0-9_-]/gu,c=>'_u'+c.codePointAt(0).toString(16));
const t=(id,text,x,y,w,h,fontSize=28,role='body',opts={})=>({id:sid(id),kind:'text',text,x,y,w,h,fontSize,role,lineHeight:1.2,color:C.ink,...opts});
const r=(id,x,y,w,h,opts={})=>({id:sid(id),kind:'rect',x,y,w,h,role:'group',fill:'none',stroke:C.line,strokeWidth:1.2,radius:4,...opts});
const e=(id,x,y,w,h,opts={})=>({id:sid(id),kind:'ellipse',x,y,w,h,role:'data',fill:C.accent,stroke:'none',...opts});
const l=(id,x1,y1,x2,y2,opts={})=>({id:sid(id),kind:'line',points:[{x:x1,y:y1},{x:x2,y:y2}],role:'decoration',stroke:C.line,strokeWidth:1.2,...opts});
const drawing=(id,width,height,elements,claimIds=[])=>({id,width,height,elements,claimIds});
const panel=(id,box,drawingIds,title='')=>({id,title,box,drawingIds,surface:'plain',heading:'hidden',padding:0});
const arg=(role,question,contribution,boundary)=>({role,question,contribution,boundary});
const base=(id,title,sectionId,seconds,claimIds,argument,notes)=>({id,layout:'academic',title,sectionId,paperIds:P,claimIds,argument,notes,seconds,figureIds:[],cards:[]});
const plan=(relationship,primaryPanelId,readingOrder,rationale)=>({relationship,primaryPanelId,readingOrder,rationale});
const checks=values=>values.map((text,i)=>({id:'required-'+(i+1),text}));

await mkdir(TMP,{recursive:true});
const csvPath=join(INPUT,'fatigue.csv');
const protocolPath=join(INPUT,'protocol.md');
const rawCsv=await readFile(csvPath),rawProtocol=await readFile(protocolPath);
if(sha(rawCsv)!=='a31ee0b6094b69b080499cb00f524223eb15e902ff581a8c644e4a205b73de06'||sha(rawProtocol)!=='791f46c143bfa272986a39d1cec6ed22829ee7891c24f57073740c045e67cec9')throw new Error('The fixed report requires the supplied version-1 inputs. Re-author claims and slides before using changed data.');
const csvLines=rawCsv.toString('utf8').trim().split(/\r?\n/),headers=csvLines.shift().split(',');
const data=csvLines.map(line=>Object.fromEntries(line.split(',').map((v,i)=>[headers[i],['cycles_observed','stress_MPa'].includes(headers[i])?Number(v):v])));
if(data.length!==48||new Set(data.map(d=>d.specimen_id)).size!==48)throw new Error('Input record count or identity changed');
const stats=await readJSON(join(TASK,'analysis-independent/fatigue_summary.json'));
if(stats.sources.csv_sha256!==sha(rawCsv)||stats.sources.protocol_sha256!==sha(rawProtocol))throw new Error('Audit input hashes differ');
const get=(batch,process)=>data.filter(d=>d.batch===batch&&d.process===process);
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
const Bc=get('B','conventional'),Bm=get('B','modified');
const interval=stats.B_200_MPa_Welch_mean_difference_interval;
if(Math.abs(mean(Bm.map(d=>d.cycles_observed))-mean(Bc.map(d=>d.cycles_observed))-interval.mean_difference_cycles)>1e-7)throw new Error('Independent contrast check failed');
const groupSummaries=stats.group_summaries;
const sources=[
  {id:'protocol',title:'金属构件疲劳试验记录（教学模拟材料）',authors:['未署名（原资料未提供）'],year:2026,journal:'用户提供的教学模拟资料；非期刊',doi:'',url:'sources/protocol.md',version:'版本1，2026-10-20',sourceType:'protocol',studyType:'simulation',
    reading:{status:'full-text',sections:['来源与目的','试件与条件','终点与数据字典','研究进度'],source:protocolPath,notes:'已逐段读完本资料包说明；全文是教学模拟协议，不是实际实验论文。'},
    methodSummary:'每行一件独立试件；按批内可用加工顺序取样；A与B为200 MPa，C为180 MPa；50万循环为统一计划停止点。',
    limitations:['非随机跨批次分配；批内按可用加工顺序取样。','没有断口、微观组织、残余应力测量。','所有结果只属于教学模拟，不对应真实实验、机构、项目或论文。'],
    analysis:{question:'现有记录能否支持改性工艺延长疲劳寿命；下一批应如何区分工艺与条件差异？',gap:'资料未提供工艺有效性结论；只有B批有两工艺同应力记录，且未报告随机分配。',mechanism:'改性工艺具体机制未报告，不能据寿命表猜测微观组织、残余应力或断口过程。',design:'48件独立试件，A只有常规、B有两工艺、C只有改性；共同50万循环行政停止，runout表示未观察到失效。',unitOfAnalysis:'一件试件；无重复试验。',comparators:['B批200 MPa常规对改性是同批同应力比较。','A与B常规同应力，可显示批次相关分布差异。','C批180 MPa不能充当200 MPa工艺对照。'],validity:'能够界定比较条件和删失；不支持因果有效性或材料机制结论。',locators:['protocol.md：来源与目的、试件与条件','protocol.md：终点与数据字典、研究进度']}},
  {id:'fatigue',title:'fatigue.csv：48件金属构件疲劳试件记录（教学模拟数据）',authors:['未署名（原资料未提供）'],year:2026,journal:'用户提供的合成数据文件；非期刊',doi:'',url:'sources/fatigue.csv',version:'随资料版本1提供，2026-10-20',sourceType:'dataset',studyType:'simulation',
    reading:{status:'full-text',sections:['字段名','A-con-01至A-con-12','B-con-01至B-con-12','B-mod-01至B-mod-12','C-mod-01至C-mod-12'],source:csvPath,notes:'已读取全部48行并复算分组、均值、样本SD和B批Welch区间；不是原文件已报告的统计结论。'},
    methodSummary:'按batch/process/stress_MPa分组；保留每件原始cycles_observed及endpoint，B批全部failed，均值差区间采用原尺度Welch近似。',
    limitations:['48行全部是合成试件。','两条C批500000值为runout，不是已测失效寿命。','每组12件，均值区间依赖抽样与分布近似，且不包含混杂偏倚。'],
    analysis:{question:'各比较组的原始分布、删失与B批均值差有多大？',gap:'汇总工艺差异混入应力和批次；数据本身没有随机化或机制测量信息。',mechanism:'该文件只包含寿命观察、状态、批次、工艺和应力，无法判断材料机制。',design:'48个不同specimen_id；46 failed、2 runout；四个batch-process组合各12件。',unitOfAnalysis:'每个唯一specimen_id对应一件独立试件。',comparators:['B-con-01至12与B-mod-01至12，均200 MPa。','A常规200 MPa与B常规200 MPa仅作描述。'],validity:'B批描述差为25622.25循环，95%区间跨0；不能把同批同应力视作已随机化。C尾部超出观察。',locators:['fatigue.csv：第2–13行A常规；第14–25行B常规','fatigue.csv：第26–37行B改性；第38–49行C改性','fatigue.csv：C-mod-02、C-mod-08两条runout']}}
];
const metric=(label,value,unit,baseline,denominator,aggregation)=>({label,value:String(value),unit,baseline,denominator,aggregation});
const claim=(id,paperId,kind,text,locator,context,warrant,boundary,extras={})=>({id,paperId,kind,text,locator,context,reasoning:{warrant,boundary},verified:true,...extras});
const claims=[
 claim('sim-identity','protocol','reported','本资料是教学模拟合成数据，不对应真实实验、机构、项目或论文。','protocol.md：来源与目的','版本1；2026-10-20。','协议“来源与目的”明确将资料定义为学术沟通练习用合成数据，未提供真实实验归属。','所有本报告结果只用于学术沟通练习。'),
 claim('sampling-design','protocol','reported','A仅常规、B含两工艺、C仅改性；A/B为200 MPa、C为180 MPa；按批内可用加工顺序取样，未随机跨批次分配。','protocol.md：试件与条件','每行一件独立试件，无重复试验；设备环境没有另作差异记录，不等于已证实完全相同。','协议逐项列明各批次工艺和应力，并明确按加工顺序取样而非随机跨批次分配。','不能假定批内随机分配，不能把未记录差异当作不存在。'),
 claim('group-counts','fatigue','reported','48个独立试件，四个批次-工艺组合各12件；46 failed、2 runout。','fatigue.csv：第2–49行','由全部48行复算；试件是独立单位，无重复。','逐行核对48个specimen_id均不同，四个组合各12行，endpoint合计46个failed和2个runout。','计数只覆盖给定48条教学模拟记录，不能将试件数等同于随机化证据或真实实验样本。',{metrics:[metric('独立试件数',48,'件','全部原始记录','48个唯一specimen_id','逐行计数'),metric('失效数',46,'件','全部试件','48件','endpoint=failed计数'),metric('runout数',2,'件','全部试件','48件','endpoint=runout计数')]}),
 claim('endpoint-definition','protocol','reported','failed为该循环失效；runout为到500000循环尚未失效的最后观察，属于右删失。','protocol.md：终点与数据字典；fatigue.csv：C-mod-02、C-mod-08','资料未提供提前失访；两个runout均在C批180 MPa。','停止观察与失效是不同状态，runout不提供之后的失效时刻。','不能把50万循环改写成失效寿命或完整均值。'),
 claim('endpoint-observations','fatigue','reported','C-mod-12在482497循环失效；C-mod-02和C-mod-08在500000循环runout。','fatigue.csv：C-mod-12、C-mod-02、C-mod-08','三件均属C批180 MPa；用于说明终点状态，非工艺对照。','逐行保留cycles_observed与endpoint配对，分别表示已发生失效和最后观察时刻。','两个runout没有之后的失败时刻，不能视为恰好500000循环失效。',{metrics:[metric('C-mod-12失效时刻',482497,'循环','endpoint=failed','1件独立试件','原始单件观察，非组均值'),metric('C-mod-02最后观察',500000,'循环','endpoint=runout','1件独立试件','原始行政停止时刻，非失败寿命'),metric('C-mod-08最后观察',500000,'循环','endpoint=runout','1件独立试件','原始行政停止时刻，非失败寿命')]}),
 claim('all-observations','fatigue','reported','四组原始观察与均值已按CSV复算：A常规236265.92、B常规303682.83、B改性329305.08、C改性434824.33循环；C均值含两条runout。','fatigue.csv：第2–49行；随附fatigue-summary.json逐组复算','每组n=12；A/B均failed，C有10 failed和2 runout；C为180 MPa。','所有观察点均保留，不删极端值或连成时间序列。','C的数字是观察时间均值；不能称完整平均失效寿命。',{metrics:groupSummaries.map(g=>metric(`${g.batch}-${g.process}观察时间均值`,g.mean_observed_cycles,'循环','同组全部原始观察',`${g.n}件独立试件`,`cycles_observed算术平均；${g.failed}失效/${g.runout}runout`))}),
 claim('b-descriptive','fatigue','reported','B批200 MPa：常规均值303682.83、样本SD30977.28；改性均值329305.08、样本SD56622.71；每组12件且全部失效。','fatigue.csv：B-con-01至12、B-mod-01至12；原尺度复算','两组独立试件；SD为n−1分母。','B批两组应力和批次一致且无删失，允许比较观察到的失败寿命分布。','资料只记录按加工顺序取样，未报告工艺的随机分配；同批同应力的均值差仍不能直接作因果解释。',{metrics:[metric('常规均值',303682.8333333333,'循环','B批常规200 MPa','12件','算术平均'),metric('改性均值',329305.0833333333,'循环','B批常规作为对比基线','12件','算术平均'),metric('常规样本SD',30977.28122301402,'循环','B批常规均值','12件','n−1样本标准差'),metric('改性样本SD',56622.71262160431,'循环','B批改性均值','12件','n−1样本标准差')]}),
 claim('b-interval','fatigue','inference','B批样本均值差（改性−常规）为25622.25循环；原尺度Welch 95%区间为[-13679.80,64924.30]循环。','fatigue.csv：B两组24行；independent_fatigue_analysis.py的Welch计算','近似均值区间：SE=18631.79079，df=17.04322630，t*=2.109408027；两组n=12、全部failed。','独立试件的样本方差合成差值标准误，使用Welch自由度与双侧95%临界值。','区间依赖分布和抽样近似，不含选择/混杂偏倚；跨0不等于等效。',{dependsOn:['b-descriptive','sampling-design'],reasoning:{warrant:'相同应力和批次内比较减少已知条件差异；Welch近似量化均值差的抽样不确定性。',boundary:'未报告随机分配；区间不能证明因果，也不能说明两工艺相等。',alternatives:'改性工艺差异、加工顺序或选择差异、样本波动均仍可能。'},metrics:[metric('样本均值差',interval.mean_difference_cycles,'循环','改性−常规','各12件，共24件','原尺度两组算术均值相减'),metric('95%区间下限',interval.confidence_interval_cycles[0],'循环','差值0','各12件，共24件','Welch双侧95%区间'),metric('95%区间上限',interval.confidence_interval_cycles[1],'循环','差值0','各12件，共24件','Welch双侧95%区间')]}),
 claim('comparability-limit','protocol','inference','全样本按工艺汇总会混入批次与应力；即使只限200 MPa，A+B常规对B改性也不是同批对照。','protocol.md：试件与条件；fatigue.csv：四组构成','A与B常规同200 MPa均值相差67416.92循环，仅为描述。','工艺与条件分布不平衡，组间汇总不能分解各因素贡献。','B批是本资料最接近同条件的比较，也没有完成随机归因。',{dependsOn:['sampling-design','all-observations'],reasoning:{warrant:'比较组在批次和应力上不同，数据构成改变会改变汇总差。',boundary:'不能把A/B差直接称为批次因果效应。',alternatives:'原料/加工顺序差异、应力条件与随机波动均可贡献分布差异。'}}),
 claim('evidence-boundary','protocol','inference','当前只有B批正向点估计的线索；改性因果效应、50万循环之后的寿命尾部及材料机制均未确立。','protocol.md：终点与数据字典；B批区间分析','未提供断口、微观组织、残余应力测量。','区间跨零、未报告随机分配、尾部右删失以及机制测量缺失分别限制不同结论。','资料不足不等于工艺无效；也不允许机制补写。',{dependsOn:['b-interval','endpoint-definition','sampling-design'],reasoning:{warrant:'按问题逐项对应现有信息与缺项，避免从寿命差推导未测机制。',boundary:'结论仅适用于当前教学模拟记录。',alternatives:'真实效应可能正向、反向或较小；现有记录不能区分。'}}),
 claim('next-randomized','protocol','proposal','尚未开展：下一批固定200 MPa，在同一材料批次内随机分配常规/改性工艺，按加工时段分区组并交错测试。','protocol.md：研究进度；本报告提出的待检验方案','同一批可申请新试件；具体数量、材料规格与分区组条件待事先确认。','同批同应力和随机分配有助于减少选择与顺序混杂。','单批只回答该批次该应力；跨批推广需后续复现。',{dependsOn:['sampling-design','comparability-limit','b-interval']}),
 claim('next-estimand','protocol','proposal','尚未开展：预先指定50万循环内限制平均寿命差（改性−常规）为主要效应量，完整记录失效与runout，并事先规划δ、样本量及异常停止处理。','protocol.md：终点定义和研究进度；本报告分析方案','共同50万停止点；若仅行政删失，RMST经验均值为min(T,50万)均值；若有更早失访需生存分析与删失假设。','主要估计对象容纳未失效试件，同时限定观察窗口，避免以runout当作失效。','δ尚未提供，应由工程意义确定；B批变异只作为样本量规划参考。',{dependsOn:['endpoint-definition','next-randomized','b-descriptive']}),
 claim('decision-branches','protocol','proposal','尚未开展：在有效前提下用预设区间区分正向、反向和跨零不确定；若随机实施或删失前提失效则先核查偏倚。','本报告预先判定方案；依赖protocol.md的未实施研究进度','L、U为主要差值的预设95%区间；正值代表改性较长。δ为另行事先确定的最小重要差值。','先检验比较有效性，再解释方向与区间；统计方向和工程价值分开。','区间跨0不等于等效；有方向也不自动达到工程价值。',{dependsOn:['next-randomized','next-estimand','evidence-boundary']})
];

const designContract=await toolContract({topic:'design'});
const palette=designContract.academicPalettes.find(p=>p.id==='blue-slate').palette;
const design={mode:'content-led',density:'compact',fontFamily:'Noto Sans CJK SC',palette,
 cardDefaults:{surface:'outline',radius:4,padding:16,accent:'none',elevation:false},
 projection:{bodyMin:28,labelMin:24,noteMin:18},
 system:{preset:'academic-report',header:'rule',cover:'minimal',panel:'line',titleSize:42,coverTitleSize:64,bodySize:28,panelTitleSize:30,captionSize:18,sectionSize:26},
 chrome:{header:'rule',showBrand:true,brandLabel:sim,showSection:true,showPageNumber:true,showFooter:true,showSources:true,showTopRule:false},
 direction:{premise:'8页、8分钟的材料工程课题组进展报告；唯一材料是协议和48件教学模拟记录。通过比较矩阵、原始分布、区间和拟议随机化设计建立论证。',visualGrammar:'白底深蓝标题与石墨正文；常规工艺用深蓝实心圆，改性用低饱和棕色实心圆；runout用同组空心圆和右箭头。数据、条件与边界邻接，正文28px、标签24px、辅助来源18px。',referenceLearning:'无参考模板；未使用48页教学模板库。',avoid:['不加入机构徽标、作者署名或未知日期。','不使用机制示意图填补缺失测量。','不用大数字替代试件分布与不确定区间。']},
 colorRoles:[{role:'页面主色',color:C.accent,meaning:'标题、章节定位和关键关系，非效应强度编码'},{role:'常规工艺',color:C.accent,meaning:'常规工艺的数据点，同时有文字标签'},{role:'改性工艺',color:C.modified,meaning:'改性工艺的数据点，同时有文字标签'},{role:'组边界',color:C.line,meaning:'克制细线区分信息归属，不表示统计显著性'}]};
const brief={centralQuestion:'现有记录能否支持改性工艺延长疲劳寿命，下一批怎样更可靠地验证？',audience:'材料工程课题组',talkMinutes:8,targetPaperCount:0,requireFullText:true,genre:'research-progress',qualityProfile:'academic',requirePaperIntro:false,
 narrative:{throughline:'先识别记录的可比条件，再用B批原始分布与区间界定证据，最后把未解决的归因和删失问题转成随机化检验。',sections:[{id:'scope',title:'记录与比较',question:'48件记录允许哪些比较？'},{id:'evidence',title:'证据与边界',question:'同批同应力的寿命差支持到哪里？'},{id:'validation',title:'下一步验证',question:'怎样区分工艺效应、波动与设计缺陷？'}]}};

function cover(variant){
 const s={id:'s1',layout:'cover',title,paperIds:P,claimIds:['sim-identity'],notes:'本次汇报讨论改性工艺与常规工艺的疲劳寿命差异。全部资料均为教学模拟，不对应真实实验或机构。我们已完成48件记录的核对与复算，目标不是预设改性有效，而是判断现有记录能说明什么，以及下一批怎样验证。报告围绕比较条件、同批证据和验证方案三个问题展开。',seconds:30,figureIds:[],cards:[],subtitle:'48件记录的比较边界与待检验方案',cover:{variant:'custom',align:variant==='left'?'left':'center',titleLines:['改性工艺的疲劳寿命差异：','现有证据与下一步验证'],occasion:'材料工程课题组 · 学术进展报告',date:'教学模拟数据｜资料版本1 · 2026-10-20',boxes:variant==='left'?{occasion:{x:76,y:74,w:1100,h:40},title:{x:76,y:184,w:1128,h:165},subtitle:{x:76,y:394,w:1120,h:48},metadata:{x:76,y:566,w:1100,h:48}}:{occasion:{x:90,y:62,w:1100,h:40},title:{x:72,y:220,w:1136,h:165},subtitle:{x:90,y:425,w:1100,h:48},metadata:{x:90,y:610,w:1100,h:45}}},chrome:{showFooter:false,showSources:false,showPageNumber:false,showBrand:false},transition:'先看48件试件如何分布在批次、工艺和应力之间。'};
 return s;
}

function rawBHorizontal(){
 const el=[t('condition','B批 · 200 MPa · 每组12件 · 全部失效',0,0,1184,40,28,'body',{bold:true})];
 const x0=230,x1=1118,scale=v=>x0+(v/10000-20)/30*(x1-x0);
 [20,25,30,35,40,45,50].forEach(v=>{let x=scale(v*10000);el.push(l('grid-'+v,x,56,x,174,{stroke:'#DCE3E9'}));el.push(t('tick-'+v,String(v),x-25,178,50,30,24,'label',{align:'center'}));});
 const slots=[-20,-10,0,10,20,-15,-5,5,15,-20,0,20];
 [['常规',Bc,C.accent,92],['改性',Bm,C.modified,151]].forEach(([name,g,color,y])=>{
   el.push(t('label-'+name,name,0,y-17,110,38,28,'body',{bold:true,color}));
   el.push(t('n-'+name,'n = 12',111,y-15,100,34,24,'label'));
   g.forEach((d,i)=>el.push(e('dot-'+d.specimen_id,scale(d.cycles_observed)-5,y+slots[i]*.65-5,10,10,{fill:color,claimIds:['b-descriptive']})));
   const m=mean(g.map(d=>d.cycles_observed));el.push(l('mean-'+name,scale(m),y-25,scale(m),y+25,{stroke:color,strokeWidth:3,role:'data',claimIds:['b-descriptive']}));
 });
 el.push(t('axis','失效寿命（万循环）',740,214,380,34,24,'label',{align:'right'}));
 el.push(t('legend','圆点：独立试件；短竖线：组均值',0,214,710,34,24,'label'));
 return drawing('b-raw-horizontal',1184,250,el,['b-descriptive']);
}

function ciDrawing(width=700,height=194){
 const el=[];const x0=66,x1=width-38,sc=v=>x0+(v+2)/9*(x1-x0);
 el.push(t('ci-title','均值差：改性 − 常规',0,0,width,38,28,'body',{bold:true}));
 el.push(l('ci-zero',sc(0),44,sc(0),116,{stroke:C.muted,dash:'dash',role:'data',claimIds:['b-interval']}));
 const low=interval.confidence_interval_cycles[0]/10000,high=interval.confidence_interval_cycles[1]/10000,mid=interval.mean_difference_cycles/10000;
 el.push(l('ci-range',sc(low),77,sc(high),77,{stroke:C.accent,strokeWidth:3,role:'data',claimIds:['b-interval']}));
 el.push(l('ci-cap-low',sc(low),67,sc(low),87,{stroke:C.accent,strokeWidth:2,role:'data',claimIds:['b-interval']}));
 el.push(l('ci-cap-high',sc(high),67,sc(high),87,{stroke:C.accent,strokeWidth:2,role:'data',claimIds:['b-interval']}));
 el.push(e('ci-estimate',sc(mid)-7,70,14,14,{fill:C.accent,claimIds:['b-interval']}));
 for(const v of [-2,0,2,4,6]){el.push(l('ci-tick-'+v,sc(v),117,sc(v),122));el.push(t('ci-label-'+v,String(v),sc(v)-22,126,44,30,24,'label',{align:'center'}));}
 el.push(t('ci-axis','万循环；线段为Welch 95%区间',0,161,width,32,24,'label'));
 return drawing('b-ci',width,height,el,['b-interval']);
}

function bEvidence(horizontal=true){
 const s=base('s4','B批均值偏高，区间仍跨越零差异','evidence',95,['b-descriptive','b-interval','sampling-design'],arg('evidence','同批同应力差值有多大，其不确定性如何？','显示24个原始观测、组均值及差值Welch区间。','独立试件、原尺度近似、未报告随机分配；区间不能校正混杂。'),'将比较限制在B批，常规和改性各12件，均为200 MPa且全部已失效。上方保留每件试件，不仅展示均值。常规均值30.37万循环、样本标准差3.10万；改性均值32.93万、标准差5.66万，改性组的离散更大。样本均值差为2.56万循环。按原尺度Welch方法，95%区间为负1.37到正6.49万循环，区间跨越零，既容许负差异，也容许较大的正差异。它依赖独立样本与分布近似，没有包含加工顺序和非随机选择的偏倚。正的点估计不是因果证据，跨零也不代表两工艺等效。');
 s.transition='即便把B批作为主要比较，观察终点与未测机制仍决定结论不能越过哪些边界。';
 if(horizontal){
   const summary=drawing('b-summary',456,194,[t('means','常规：30.37 ± 3.10万\n改性：32.93 ± 5.66万',0,0,456,76,28,'body'),t('sd','以上为均值 ± 样本SD',0,83,456,34,24,'label'),t('difference','差值 +2.56万\n95%区间 [−1.37, 6.49]万',0,124,456,68,28,'body',{bold:true,color:C.accent})],['b-descriptive','b-interval']);
   const boundary=drawing('b-boundary',1184,44,[t('b-boundary-text','近似均值推断，未报告随机分配；跨零不等于等效。',0,0,1184,40,28,'body',{color:C.secondary})],['b-interval']);
   s.drawings=[rawBHorizontal(),ciDrawing(),summary,boundary];
   s.composition={regions:[panel('raw',{x:48,y:140,w:1184,h:250},['b-raw-horizontal']),panel('interval',{x:48,y:396,w:700,h:194},['b-ci']),panel('summary',{x:776,y:396,w:456,h:194},['b-summary']),panel('boundary',{x:48,y:596,w:1184,h:44},['b-boundary'])]};
   s.visualPlan=plan('evidence-explanation','raw',['raw','interval','summary','boundary'],'全宽原始分布先建立比较，再将差值区间与精确统计并置；近似和非随机边界在底部紧邻。');
 }else{
   const el=[t('v-condition','B批 · 200 MPa · 各12件',0,0,700,40,28,'body',{bold:true})];
   const y0=70,y1=390,scale=v=>y1-(v/10000-20)/30*(y1-y0);
   for(const v of [20,25,30,35,40,45,50]){const y=scale(v*10000);el.push(l('v-grid-'+v,100,y,630,y,{stroke:'#DCE3E9'}));el.push(t('v-tick-'+v,String(v),30,y-15,55,32,24,'label',{align:'right'}));}
   [['常规',Bc,C.accent,260],['改性',Bm,C.modified,500]].forEach(([name,g,color,x])=>{g.forEach((d,i)=>el.push(e('v-'+d.specimen_id,x+[-24,-12,0,12,24,-18,-6,6,18,-24,0,24][i]-5,scale(d.cycles_observed)-5,10,10,{fill:color,claimIds:['b-descriptive']})));const m=mean(g.map(d=>d.cycles_observed));el.push(l('v-mean-'+name,x-52,scale(m),x+52,scale(m),{stroke:color,strokeWidth:3,role:'data',claimIds:['b-descriptive']}));el.push(t('v-name-'+name,name,x-70,406,140,36,28,'body',{align:'center',bold:true,color}));});
   el.push(t('v-unit','失效寿命（万循环）',0,453,700,34,24,'label'));
   const right=drawing('v-summary',456,260,[t('v-means','常规 30.37 ± 3.10万\n改性 32.93 ± 5.66万',0,0,456,76,28,'body'),t('v-sd','均值 ± 样本SD；全部失效',0,83,456,34,24,'label'),t('v-diff','差值 +2.56万\n95%区间 [−1.37, 6.49]万',0,132,456,74,28,'body',{bold:true,color:C.accent}),t('v-lim','未报告随机分配；跨零不等效',0,220,456,38,28,'body',{color:C.secondary})],['b-descriptive','b-interval']);
   s.drawings=[drawing('b-raw-vertical',700,490,el,['b-descriptive']),right,ciDrawing(456,194)];
   s.composition={regions:[panel('raw',{x:48,y:140,w:700,h:490},['b-raw-vertical']),panel('summary',{x:776,y:140,w:456,h:260},['v-summary']),panel('interval',{x:776,y:421,w:456,h:194},['b-ci'])]};
   s.visualPlan=plan('comparison','raw',['raw','summary','interval'],'竖向两组分布占左侧，右侧先读汇总再读差值区间；与横向全宽方案形成实际不同构图。');
 }
 s.contentChecks=checks(['B批','200 MPa','全部失效','95%区间','未报告随机分配']);
 return s;
}

function recordMap(){
 const s=base('s2','48件记录：只有B批含同应力工艺对照','scope',60,['group-counts','sampling-design','endpoint-definition'],arg('design','哪些试件能够在相同条件下比较？','以样本矩阵显示工艺与批次、应力的不平衡；同时给出三节路线。','矩阵不代表随机设计；设备和环境未另作差异记录。'),'48条记录对应48件独立试件，没有重复试验。A批为200 MPa常规工艺12件；B批在200 MPa下有常规和改性各12件；C批为180 MPa改性12件。所有组按可用加工顺序取样，没有随机跨批次分配，不能默认批内随机。C批的两件runout是到50万循环仍未失效的停止观察。只有B批同时具备同批次、同应力的两工艺记录，因此它是本报告主要比较。路线是先界定比较条件，再审查寿命差的证据，最后给出下一批的验证方案。');
 const el=[t('unit','每行一件独立试件；无重复试验',0,0,770,40,28,'body',{bold:true})];
 const cols=[0,120,274,475,640],heads=['批次','应力','常规','改性','终点'];
 heads.forEach((v,i)=>el.push(t('head-'+i,v,cols[i]+8,62,[110,145,190,155,130][i],36,24,'label',{bold:true,color:C.accent})));
 const rows=[['A','200 MPa','12件','—','12失效'],['B','200 MPa','12件','12件','24失效'],['C','180 MPa','—','12件','10失效\n2 runout']];
 rows.forEach((row,i)=>{let y=113+i*85;if(i===1)el.push(r('b-highlight',0,y-9,780,78,{fill:C.soft,stroke:C.line}));row.forEach((v,j)=>el.push(t('cell-'+i+'-'+j,v,cols[j]+8,y,[110,145,190,155,130][j],i===2?70:40,j===4?24:28,j===4?'label':'body',{bold:i===1})));if(i<2)el.push(l('row-'+i,0,y+64,780,y+64));});
 el.push(t('selection','按可用加工顺序取样；未报告随机分配',0,383,780,70,28,'body',{color:C.secondary}));
 const route=[t('route-title','本次汇报的三个问题',0,0,376,40,28,'body',{bold:true,color:C.accent}),t('q1','01  记录与比较\n哪些比较条件一致？',0,66,376,78,28,'body'),t('q2','02  证据与边界\n寿命差支持到哪里？',0,191,376,78,28,'body'),t('q3','03  下一步验证\n怎样区分效应与偏倚？',0,316,376,78,28,'body')];
 s.drawings=[drawing('record-matrix',780,466,el,['group-counts','sampling-design']),drawing('route',376,466,route,['sampling-design'])];
 s.layout='roadmap';
 s.composition={regions:[panel('matrix',{x:48,y:146,w:780,h:466},['record-matrix']),panel('route',{x:856,y:146,w:376,h:466},['route'])]};
 s.visualPlan=plan('matrix','matrix',['matrix','route'],'样本矩阵为主，右侧简明路线保留8分钟短报告导航，避免再占一页独立目录。');
 s.contentChecks=checks(['每行一件独立试件','无重复试验','200 MPa','180 MPa','未报告随机分配']);
 s.transition='比较组的构成已经不平衡；接下来把48件原始观察放在同一尺度，看看这种不平衡如何影响解读。';return s;
}

function allDistribution(){
 const s=base('s3','跨批合并会混入应力与批次差异','evidence',65,['all-observations','comparability-limit','sampling-design'],arg('evidence','为何不直接把所有改性与常规记录合并比较？','同尺度显示48件观察与两条runout，保留工艺、批次和应力标签。','A/B差仅为批次相关描述，不能据此分解批次或应力因果贡献。'),'图中每个点代表一件试件，横轴是观察到的循环次数，空心点加右箭头表示runout。A、B两批常规工艺同为200 MPa，但样本均值分别为23.63万和30.37万循环，相差6.74万，说明批次相关的样本差异不能忽略。这个差异本身也不是已识别的批次因果效应。C批改性的观察更靠右，但它用的是180 MPa，并有两件在50万停止；不能把这种位置差直接归给工艺。即使只保留200 MPa，A加B常规对B改性仍然混入批次构成。最可比的主分析应先收缩到B批内部。');
 const el=[t('plot-head','48件原始观察：横向位置对应循环数',0,0,794,38,28,'body',{bold:true})];
 const x0=205,x1=754,sc=v=>x0+v/550000*(x1-x0);const positions=[92,180,268,356];
 [0,10,20,30,40,50].forEach(v=>{const x=sc(v*10000);el.push(l('g-'+v,x,55,x,400,{stroke:'#DCE3E9'}));el.push(t('gt-'+v,String(v),x-20,408,40,30,24,'label',{align:'center'}));});
 [['A','conventional','A 常规\n200 MPa',C.accent],['B','conventional','B 常规\n200 MPa',C.accent],['B','modified','B 改性\n200 MPa',C.modified],['C','modified','C 改性\n180 MPa',C.modified]].forEach(([batch,process,label,color],gi)=>{
   const y=positions[gi];el.push(t('group-'+gi,label,0,y-23,193,68,24,'label',{bold:true,color}));
   const jit=[-19,-9,1,11,21,-14,-4,6,16,-19,1,21];
   get(batch,process).forEach((d,i)=>{const x=sc(d.cycles_observed),dy=y+jit[i];el.push(e('p-'+d.specimen_id,x-4.5,dy-4.5,9,9,{fill:d.endpoint==='runout'?C.paper:color,stroke:color,strokeWidth:1.4,claimIds:['all-observations']}));if(d.endpoint==='runout')el.push(l('runout-'+i,x+7,dy,x+31,dy,{stroke:color,strokeWidth:1.6,endArrow:true,role:'data',claimIds:['endpoint-definition']}));});
 });
 el.push(t('xunit','观察时间（万循环）；每组n=12',0,454,794,34,24,'label'));
 const side=[r('same-condition',0,0,360,252),t('same-h','同工艺、同应力',18,17,324,38,28,'body',{bold:true,color:C.accent}),t('means','A常规：23.63万\nB常规：30.37万',18,70,324,76,28,'body'),t('same-c','均值差6.74万循环\n仍是描述，未能归因',18,162,324,76,28,'body'),t('c-h','C批的比较条件不同',0,288,360,38,28,'body',{bold:true,color:C.modified}),t('c-c','180 MPa；2件runout\n50万时仍未失效\n不能并作工艺收益',0,338,360,112,28,'body')];
 s.drawings=[drawing('all-points',794,490,el,['all-observations']),drawing('all-reading',360,490,side,['comparability-limit','endpoint-definition'])];
 s.composition={regions:[panel('points',{x:48,y:142,w:794,h:490},['all-points']),panel('reading',{x:872,y:142,w:360,h:490},['all-reading'])]};s.visualPlan=plan('comparison','points',['points','reading'],'四个实际比较条件保留共同横轴，以原始分布对照右侧的条件解释；不把跨应力的点位差命名为工艺效应。');
 s.contentChecks=checks(['200 MPa','180 MPa','runout','观察时间（万循环）','未能归因']);s.transition='因此把主要估计限于B批，保留其24件分布，并同时报告差值的不确定性。';return s;
}

function censorBoundary(){
 const s=base('s5','删失与机制缺项限定了结论范围','evidence',60,['endpoint-definition','endpoint-observations','evidence-boundary','b-interval'],arg('limitation','为什么50万值不能当作完整失效寿命，机制为何不能补写？','用两条真实C批记录解释失效与停止观察，并逐项收束可支持和不可支持的判断。','示例来自同一C批180 MPa，只用于终点定义，不用于工艺对比。'),'以C批两件记录为例：C-mod-12在48.25万循环发生失效，这个寿命已观察到；C-mod-02到50万循环仍未失效，因此只能说其寿命超过50万，不能把50万写成失效寿命。另一件runout是C-mod-08。在只有共同50万行政停止、没有提前失访时，观察时间的平均值可以描述50万窗口内的限制平均寿命，但不能说明之后的尾部。当前能支持的只是B批正向点估计的线索；因果效应未确立，尾部尚未观察，也没有断口、微观组织或残余应力数据来解释机制。下一步首先要补齐可归因的比较设计。');
 const el=[t('scope','C批 · 180 MPa：两条实际记录示意',0,0,600,38,28,'body',{bold:true})];
 const sc=v=>60+v/550000*490;
 el.push(t('failure-id','C-mod-12',0,61,580,32,24,'label'));
 el.push(l('failure-line',60,116,sc(482497),116,{stroke:C.modified,strokeWidth:2,role:'data',claimIds:['endpoint-definition']}));el.push(e('failure-dot',sc(482497)-6,110,12,12,{fill:C.modified,claimIds:['endpoint-definition']}));
 el.push(t('failure-explain','48.25万循环：失效已观察',0,142,600,40,28,'body'));
 el.push(t('runout-id','C-mod-02（另一件：C-mod-08）',0,205,600,32,24,'label'));
 el.push(l('runout-line',60,259,sc(500000),259,{stroke:C.modified,strokeWidth:2,role:'data',claimIds:['endpoint-definition']}));el.push(e('runout-dot',sc(500000)-6,253,12,12,{fill:C.paper,stroke:C.modified,strokeWidth:2,claimIds:['endpoint-definition']}));el.push(l('runout-arrow',sc(500000)+9,259,566,259,{stroke:C.modified,strokeWidth:2,endArrow:true,role:'data',claimIds:['endpoint-definition']}));
 el.push(t('runout-explain','50万循环：未失效，寿命 > 50万',0,285,600,40,28,'body',{bold:true,color:C.modified}));
 el.push(l('time-axis',60,352,550,352));
 for(const v of [0,25,50]){el.push(l('time-tick-'+v,sc(v*10000),346,sc(v*10000),358));el.push(t('time-label-'+v,String(v),sc(v*10000)-22,365,44,32,24,'label',{align:'center'}));}
 el.push(t('time-unit','循环数（万）；两条记录采用同一尺度',0,405,600,34,24,'label'));
 el.push(t('window','两件runout保留为右删失',0,452,600,38,28,'body',{color:C.secondary}));
 const bounds=[t('bounds-h','当前记录支持到哪里',0,0,548,40,28,'body',{bold:true,color:C.accent}),t('bound1','工艺效应\nB批正差值是线索；因果未确立',0,72,548,78,28,'body'),l('sep1',0,169,548,169),t('bound2','观察窗口\n50万后寿命尾部仍未知',0,195,548,78,28,'body'),l('sep2',0,294,548,294),t('bound3','材料机制\n未提供断口、组织或残余应力测量',0,322,548,113,28,'body'),t('no-mechanism','不以寿命差补写机制解释',0,451,548,34,24,'label',{color:C.secondary})];
 s.drawings=[drawing('endpoint-examples',600,490,el,['endpoint-definition','endpoint-observations']),drawing('boundaries',548,490,bounds,['evidence-boundary'])];
 s.composition={regions:[panel('endpoint',{x:48,y:142,w:600,h:490},['endpoint-examples']),panel('bounds',{x:684,y:142,w:548,h:490},['boundaries'])]};s.visualPlan=plan('definition','endpoint',['endpoint','bounds'],'左侧用有来源的真实记录区分终点状态，右侧分别对应效应、尾部和机制边界，避免把三类未知混成一句局限。');
 s.contentChecks=checks(['寿命 > 50万','右删失','因果未确立','未提供断口、组织或残余应力测量']);s.transition='这些边界决定了新一批首先要检验工艺归因，并事先定义共同观察窗口和判定规则。';return s;
}

function nextDesign(){
 const s=base('s6','下一批：固定应力并随机分配工艺','validation',85,['next-randomized','next-estimand'],arg('proposal','下一批怎样改善可归因性并正确处理runout？','提出同批同应力随机分配、共同终点、主要效应量与事前样本量规划。','方案尚未开展；δ与样本量待确定；单批结果仍需后续跨批复现。'),'下阶段只提出尚未开展的方案。先固定200 MPa和50万循环停止点，统一试件规范、失效判据和测量记录。在同一材料批次内按可用加工时段分区组，区组内一比一随机分配常规或改性工艺；两组交错或随机安排测试顺序，并记录机台、环境和异常停止。主要效应量建议预先指定为50万循环内限制平均寿命差，也就是改性减常规。在只有共同截止且无提前失访时，它等价于每件min(T,50万)的组均值差；若出现更早失访，需要生存分析处理和相应删失假设，不能当作正常50万runout。实际重要差值δ应按工程价值与成本确定，随后依据目标精度、变异和预计删失规划样本量，不能从这次2.56万差值倒推门槛。B批离散度只是先导参考。单批首先回答该批次、该应力和该窗口内的问题。');
 const el=[t('not-done','待检验方案｜尚未开展',0,0,1184,40,28,'body',{bold:true,color:C.secondary})];
 const boxes=[['batch',0,82,250,118,'同一材料批次\n固定200 MPa'],['random',306,82,260,118,'区组内随机分配\n1 : 1'],['con',638,62,220,75,'常规工艺'],['mod',638,159,220,75,'改性工艺'],['end',930,82,254,134,'失效则记录时刻\n50万未失效\n登记runout']];
 boxes.forEach(([id,x,y,w,h,txt])=>{el.push(r('node-'+id,x,y,w,h,{fill:id==='end'?C.soft:C.paper}));el.push(t('text-'+id,txt,x+16,y+17,w-32,h-26,id==='end'?26:28,id==='end'?'label':'body',{bold:id==='random',color:id==='mod'?C.modified:C.ink}));});
 el.push(l('a1',252,141,300,141,{role:'relationship',endArrow:true,stroke:C.accent,strokeWidth:2}));
 el.push({id:'a2',kind:'line',points:[{x:568,y:125},{x:599,y:125},{x:599,y:99},{x:632,y:99}],role:'relationship',endArrow:true,stroke:C.accent,strokeWidth:2});
 el.push({id:'a3',kind:'line',points:[{x:568,y:159},{x:599,y:159},{x:599,y:197},{x:632,y:197}],role:'relationship',endArrow:true,stroke:C.accent,strokeWidth:2});
 el.push({id:'a4',kind:'line',points:[{x:860,y:99},{x:895,y:99},{x:895,y:126},{x:924,y:126}],role:'relationship',endArrow:true,stroke:C.accent,strokeWidth:2});
 el.push({id:'a5',kind:'line',points:[{x:860,y:197},{x:895,y:197},{x:895,y:178},{x:924,y:178}],role:'relationship',endArrow:true,stroke:C.accent,strokeWidth:2});
 el.push(t('order','交错/随机测试顺序；记录机台、环境、加工时段与异常停止',0,264,1184,40,28,'body'));
 el.push(l('section-line',0,323,1184,323));
 el.push(t('estimate-h','主要效应量（事先指定）',0,345,650,36,28,'body',{bold:true,color:C.accent}));
 el.push(t('estimate','50万循环内限制平均寿命差\nΔ = RMST改性 − RMST常规',0,393,650,80,28,'body'));
 el.push(t('size-h','样本量与实际意义',704,345,480,36,28,'body',{bold:true,color:C.accent}));
 el.push(t('size','先定最小重要差值δ与目标精度\n再用先导变异和删失率规划',704,393,480,80,28,'body'));
 s.drawings=[drawing('new-study',1184,486,el,['next-randomized','next-estimand'])];s.composition={regions:[panel('design',{x:48,y:142,w:1184,h:486},['new-study'])]};s.visualPlan=plan('sequence','design',['design'],'上半部将分配与共同观察终点连接，底部并列主要估计对象和实施前必须确定的精度决策；不填造试件数量或结果。');s.contentChecks=checks(['尚未开展','固定200 MPa','区组内随机分配','50万循环内限制平均寿命差','先定最小重要差值δ']);s.transition='设计之外，还要预先写清什么结果支持方向、什么结果仍不确定，以及何时不能解释区间。';return s;
}

function decisions(){
 const s=base('s7','预先写明判据，区分四种可能结果','validation',60,['decision-branches','evidence-boundary'],arg('synthesis','下一批何种结果改变判断，如何避免把未显著写成无效？','明确有效前提、三个区间方向分支和前提失效分支，并回应中心问题。','阈值δ未提供；这里只预设逻辑，不宣称实施过试验或标准等效性检验。'),'以下判据属于下一批的预设方案。L和U是改性减常规这一主要差值的95%区间。先确认随机分配执行、终点记录和失访或删失机制可接受。前提成立时，若下限大于零，支持正向差异，但还须对照事前确定的工程门槛δ，不能把统计方向当作值得采用。若上限小于零，支持反向差异，应检查工艺并调整方案。若区间包含零，正负效应仍被容许，不能判等效；只有事先定义等效范围和相应方法，才讨论等效。第四种情况是随机实施或删失前提失效，此时先核查偏倚，不能硬套前三项。一个反例是区间虽全为正、却低于工程重要程度，这仍不足以宣布有用收益。回到开场：现有教学模拟记录给出了方向性线索，但效应未确立；下一步是同应力随机化并预设估计对象和判据。');
 const el=[t('definition','L、U：主要差值Δ的预设95%区间；Δ > 0表示改性较长',0,0,1184,40,28,'body'),t('valid','先确认：随机实施、终点记录与删失/失访机制可接受',0,52,1184,40,28,'body',{bold:true,color:C.accent})];
 const cols=[0,236,704],widths=[220,448,480];
 const heads=['区间结果','可作判断','行动与限定'];heads.forEach((x,i)=>el.push(t('d-head-'+i,x,cols[i]+12,119,widths[i]-24,36,24,'label',{bold:true,color:C.accent})));
 const rows=[['L > 0','支持正向差异','再对照工程门槛δ'],['U < 0','支持反向差异','核查工艺并调整方案'],['L ≤ 0 ≤ U','方向仍不确定','不能据此判等效']];
 rows.forEach((row,i)=>{let y=170+i*66;el.push(l('d-line-'+i,0,y-10,1184,y-10));row.forEach((v,j)=>el.push(t('d-cell-'+i+'-'+j,v,cols[j]+12,y,widths[j]-24,42,28,'body',{bold:j===0})));});
 el.push(r('invalid',0,372,1184,64,{stroke:C.line,fill:C.soft}));el.push(t('invalid-text','前提不成立 → 先核查偏倚与方案；不直接解释上述区间',18,387,1148,38,28,'body',{color:C.secondary}));
 el.push(t('answer','当前：方向性线索，效应未确立；下一步：随机同应力验证。',0,457,1184,40,28,'body',{bold:true,color:C.accent}));
 s.layout='closing';s.drawings=[drawing('decisions',1184,500,el,['decision-branches','evidence-boundary'])];s.composition={regions:[panel('decision-table',{x:48,y:140,w:1184,h:500},['decisions'])]};s.visualPlan=plan('synthesis','decision-table',['decision-table'],'先交代估计对象和有效前提，再用三行区间判据与独立的前提失效分支闭合逻辑，末行直接回答开场。');s.contentChecks=checks(['L > 0','U < 0','L ≤ 0 ≤ U','前提不成立','不能据此判等效','效应未确立']);s.transition='最后列出唯一使用的原始资料与统计口径，便于会后复核。';return s;
}

function sourceSlide(){
 const s={...base('s8','来源与分析口径',undefined,25,['sim-identity','b-interval','endpoint-definition'],arg('synthesis','结果能够追溯到哪些原始材料和分析口径？','保留完整本地来源题名、版本与统计口径。','没有外部文献和材料机制证据；模拟身份不改变。'),'本报告只依据这两份原始资料。协议版本1，日期2026年10月20日；CSV包含48个独立试件。全部数值由逐行记录复算，B批区间是原尺度Welch双侧95%区间，样本标准差使用n减一分母。runout保留右删失身份，不记为失效。本报告中的下一批设计全部尚未开展，资料不对应真实实验、机构、项目或论文。'),layout:'references',referenceIds:P};
 delete s.sectionId;
 const methods=drawing('source-methods',1184,200,[t('method-h','分析口径',0,0,1184,36,28,'body',{bold:true,color:C.accent}),t('method-1','逐试件复算；SD采用n−1分母；B批采用原尺度Welch 95%区间',0,48,1184,40,28,'body'),t('method-2','runout保留右删失；下一批设计为尚未实施的方案',0,101,1184,40,28,'body'),t('identity','全部为教学模拟数据，不对应真实实验、机构、项目或论文。',0,154,1184,40,28,'body',{bold:true,color:C.secondary})],['sim-identity','b-interval','endpoint-definition']);
 methods.box={x:48,y:432,w:1184,h:200};s.drawings=[methods];
 s.contentChecks=checks(['教学模拟数据','原尺度Welch 95%区间','右删失','尚未实施']);return s;
}

const slides=[cover('left'),recordMap(),allDistribution(),bEvidence(true),censorBoundary(),nextDesign(),decisions(),sourceSlide()];
if(slides.length!==8||slides.reduce((n,s)=>n+s.seconds,0)!==480)throw new Error('The requested 8 pages / 480 seconds must be preserved');
const candidates=[{id:'cover-left',label:'封面A：左对齐题名，独立下方元信息',slide:cover('left')},{id:'cover-center',label:'封面B：居中题名，底部居中元信息',slide:cover('center')},{id:'evidence-horizontal',label:'证据A：全宽横向分布，下方差值区间',slide:bEvidence(true)},{id:'evidence-vertical',label:'证据B：左侧纵向分布，右侧解释和区间',slide:bEvidence(false)}];

async function prepare(){
 try {await stat(OUT);throw new Error('Prepare requires a new output directory');}catch(err){if(err.code!=='ENOENT')throw err;}
 await mkdir(OUT,{recursive:true});await mkdir(join(OUT,'sources'));
 await copyFile(csvPath,join(OUT,'sources/fatigue.csv'));await copyFile(protocolPath,join(OUT,'sources/protocol.md'));
 await json(join(OUT,'fatigue-summary.json'),stats);await json(join(OUT,'slide-records.json'),slides);await json(join(OUT,'candidates.json'),candidates);
 await json(join(OUT,'brief-design.json'),{title,brief,design});
 const init=await createProject({cwd:WORKSPACE,projectDir:join(OUT,'project'),title,brief,design,capabilities:{imageInput:'unknown',source:'Actual candidate render has not yet been viewed in this authoring session.'}});
 const evidencePath=join(OUT,'evidence-records.json');await json(evidencePath,{papers:sources,claims});
 const records=await updateRecords({cwd:WORKSPACE,projectPath:init.projectPath,expectedRevision:init.revision,recordsPath:evidencePath});
 await json(join(OUT,'session.json'),{projectPath:init.projectPath,revision:records.revision});
 await json(join(OUT,'input-manifest.json'),{identity:sim,sourceFiles:[{path:protocolPath,sha256:sha(rawProtocol)},{path:csvPath,sha256:sha(rawCsv)}],allowedReads:'指定原始输入、插件src/bin/skills、运行依赖、本目录自己生成的记录与产物；不读取examples/docs、其他工作区报告或测试文件',pageCount:8,timeBudgetSeconds:480});
 const study=await studyProject({cwd:WORKSPACE,projectPath:init.projectPath,expectedRevision:records.revision,candidatesPath:join(OUT,'candidates.json'),outputDir:join(OUT,'study'),render:true,fontDirectories:FONTS});
 await json(join(OUT,'study-response.json'),study);
 console.log(JSON.stringify({phase:'prepare',out:OUT,study},null,2));
 if(!study.ok)process.exitCode=1;
}

async function complete(){
 const choice=await readJSON(join(TASK,'candidate-selection.json'));
 if(choice.cover!=='cover-left'||choice.evidence!=='evidence-horizontal')throw new Error('This script implements the visually selected candidates; change authored selections explicitly if needed');
 const session=await readJSON(join(OUT,'session.json'));
 const project=await readJSON(session.projectPath);
 let revision=project.revision;
 if(!sameRecords(project.claims,claims)||!sameRecords(project.papers,sources)){
   const deps=join(OUT,'evidence-records.json');await json(deps,{papers:sources,claims});
   const upd=await updateRecords({cwd:WORKSPACE,projectPath:session.projectPath,expectedRevision:revision,recordsPath:deps});revision=upd.revision;
 }
 await json(join(OUT,'slide-records.json'),slides);
 const cap={imageInput:'supported',source:choice.imageInputEvidence,verifiedAt:choice.observedAt};
 if(project.builtOnce){
   const changed=slides.filter(s=>JSON.stringify(s)!==JSON.stringify(project.slides.find(p=>p.id===s.id)));
   if(changed.length){const edits=changed.map(({id,...patch})=>({slideId:id,patch}));const edit=await editProject({cwd:WORKSPACE,projectPath:session.projectPath,expectedRevision:revision,scope:'slide-content',changes:edits});revision=edit.revision;await json(join(OUT,`edit-r${revision}.json`),{changes:edits,response:edit});}
 }else{
   const recordsPath=join(OUT,'final-records.json');await json(recordsPath,{slides,slideOrder:slides.map(s=>s.id),capabilities:cap});
   const result=await updateRecords({cwd:WORKSPACE,projectPath:session.projectPath,expectedRevision:revision,recordsPath});revision=result.revision;
 }
 await json(join(OUT,'session.json'),{projectPath:session.projectPath,revision});
 const checked=await checkProject({cwd:WORKSPACE,projectPath:session.projectPath});await json(join(OUT,'preflight.json'),checked);
 if(!checked.ok){console.log(JSON.stringify({phase:'check',out:OUT,summary:checked.summary,issues:checked.issues},null,2));process.exitCode=1;return;}
 const built=await buildProject({cwd:WORKSPACE,projectPath:session.projectPath,expectedRevision:revision,mode:'review'});await json(join(OUT,'build-response.json'),built);
 if(!built.ok){console.log(JSON.stringify(built,null,2));process.exitCode=1;return;}
 const rendered=await renderProjectArtifact({cwd:WORKSPACE,projectPath:session.projectPath,expectedRevision:revision,fontDirectories:FONTS});await json(join(OUT,'render-response.json'),rendered);
 await json(join(OUT,'delivery-paths.json'),{projectPath:session.projectPath,revision,pptxSha256:built.pptxSha256,files:built.files,rendered,visualReview:'Not automatically performed by this script. Inspect every current PPTX page and record review through the public core or CLI.'});
 console.log(JSON.stringify({phase:'complete',out:OUT,revision,files:built.files,pptxSha256:built.pptxSha256,rendered},null,2));
}
if(phase==='prepare'||phase==='all')await prepare();
if(phase==='study'){
 const session=await readJSON(join(OUT,'session.json'));
 await json(join(OUT,'candidates.json'),candidates);
 const study=await studyProject({cwd:WORKSPACE,projectPath:session.projectPath,expectedRevision:session.revision,candidatesPath:join(OUT,'candidates.json'),outputDir:join(OUT,'study'),render:true,fontDirectories:FONTS});
 await json(join(OUT,'study-response.json'),study);console.log(JSON.stringify(study,null,2));if(!study.ok)process.exitCode=1;
}
if(!process.exitCode&&(phase==='complete'||phase==='all'))await complete();
