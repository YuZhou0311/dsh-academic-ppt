#!/usr/bin/env node
/** Rebuild the original academic reference pack. All placeholder values are synthetic. */
import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {join,dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {REFERENCE_TEMPLATES,REFERENCE_CATEGORIES} from '../src/reference-catalog.mjs';
import {renderProject} from '../src/render.mjs';
import {wrapText} from '../src/scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const bundled=join(root,'skills/dsh-academic-ppt/references/templates');
const args=process.argv.slice(2);let output=bundled;
for(let i=0;i<args.length;i++){
  if(args[i]==='--output'&&args[i+1])output=resolve(args[++i]);
  else if(args[i]==='--help'){console.log('node scripts/build-references.mjs [--output DIRECTORY]\nRebuilds known reference-pack filenames only; scientific values are synthetic teaching examples.');process.exit(0);}
  else throw new Error('Unknown argument: '+args[i]);
}
await mkdir(join(output,'previews'),{recursive:true});await mkdir(join(output,'assets'),{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

const TEXT={
  '研究问题':['明确研究对象与问题边界。','给出当前方法尚未解释的关系。'],
  '方法改变了什么':['说明输入、处理与输出。','指出新增方法实际介入的环节。'],
  '结果及适用范围':['报告效果、分母与比较对象。','保留作者实际测试的场景。'],
  '已有认识':['列出已有研究共同支持的结论。','说明该结论依赖的数据条件。'],
  '尚存缺口':['指出尚未验证的机制或条件。','将缺口定位到具体决策接口。'],
  '可检验假说':['明确干预变量与预期结果。','给出能够区分替代解释的观测。'],
  '预期观测与反证':['预先规定支持或否定的条件。','同时说明无效或负效应如何解释。'],
  '论点一的依据':['对应面板 A 的变量与趋势。','引用图号、实验设置和评价口径。'],
  '论点二的依据':['对应面板 B 的效应与区间。','保持相同样本与比较尺度。'],
  '研究对象':['填写物种、样本来源和实验单位。','区分个体数与重复观测次数。'],
  '分析任务':['列出任务输入和预期输出。','说明是否承担实际管理决策。'],
  '实验身份':['标明仿真、实验室或真实田间。','报告环境范围与观测周期。'],
  '实际验证内容':['把作者已测量的能力逐项列出。','将系统可执行与结果正确分开。'],
  '外推范围':['指出未包含的场景与人群。','避免把短期结果扩展为长期收益。'],
  '关键改变':['区分新增信息与算法结构变化。','保持对应基线的输入条件一致。'],
  '比较条件':['对齐样本、时间窗和评价方法。','说明额外调参或计算预算。'],
  '本次讨论问题':['用一个具体科学问题组织精读。','方法、实验和局限围绕该问题展开。'],
  '方法审查':['输入假设和关键算子是否明确？','机制图与实际实现是否一致？','额外模块提供了什么新信息？'],
  '实验审查':['基线、划分与重复是否合适？','误差、失败与外推是否充分报告？','结果支持到哪个层级的结论？'],
  '系统接口':['标出各步骤输入、输出和记录。','区分模型决策与确定性工具计算。','用箭头说明状态由谁更新。'],
  '核验与失败处理':['列出错误触发与返回机制。','保存工具输出、引用和重试记录。','核验模块的成本也需要评价。'],
  '状态 s_t':['观测变量、历史和缺失值。','记录单位、采样频率与可得时间。'],
  '动作 a_t':['管理对象、离散或连续范围。','说明执行频率和现实约束。'],
  '奖励 r_t':['写出奖励组成与归一化方法。','区分即时奖励和最终目标。'],
  '安全约束':['硬边界、软惩罚与终止条件。','单独报告约束违反情况。'],
  '路由依据':['任务类型如何匹配工具能力？','工具选择是否使用相同的信息？','缺少工具时应明确退出或求助。'],
  '工具覆盖范围':['列出工具能处理的对象和输入。','标注分布外样本与失败类别。','解释工具更新后需重做哪些验证。'],
  '输入与单位':['列出观测与管理输入。','核对物理量单位与时间步。','保留缺失或预测数据的来源。'],
  '校准与验证':['区分参数校准与独立验证。','报告校准范围与留出环境。','与观测比较误差而非只看拟合。'],
  '模型失配':['列出结构误差与参数不确定性。','说明误差如何影响优化或策略。','补充越界状态的处理规则。'],
  '关键运算':['写清关键更新或目标计算。','保留输入维度、输出与复杂度。','避免只写算法名而省略机制。'],
  '更新规则':['说明批次、频率与停止条件。','区分训练更新和测试时的行为。'],
  '假设与计算条件':['列出独立性、可观测性与稳定性假设。','报告超参数、随机种子和预算。'],
  '优化目标':['示例：min L = Ldata + λ Lregularizer。','替换为原论文公式并解释每一项。','确认优化目标与评价指标的关系。'],
  '约束集合':['示例：g(x) ≤ 0，a_t ∈ A。','说明约束作用对象与违反代价。'],
  '求解与评价':['求解器负责怎样的搜索或更新？','独立测试怎样估计结果与不确定性？'],
  '符号与单位':['统一状态、动作、参数与损失符号。','所有数值项保留量纲与归一化。','避免同一符号代表不同物理量。'],
  '可识别性假设':['解释哪些参数能由观测识别。','列出需要固定或外部提供的条件。','用消融或敏感性分析检查解释。'],
  '独立样本单位':['填写真正接受独立处理的个体。','随机种子、图像和轨迹分别计数。','用实验设计判断统计独立性。'],
  '重复测量结构':['填写每个个体的时间点与采样频率。','说明分层或相关观测的处理方法。','缺失测量不应扩大独立样本数。'],
  '纳入排除与缺失值':['预先写明纳入、排除和质量控制规则。','报告各阶段样本量与缺失原因。'],
  '随机化与重复':['说明处理分配与区组。','写清每组独立重复数。','将技术重复与生物重复区分。'],
  '效应解释':['分别解释主效应与交互作用。','比较应固定其他因素的条件。','多次比较的处理需在页上交代。'],
  '划分单位与留出条件':['按个体、站点或年份划分。','明确训练、验证与独立测试的职责。','测试集不能参与特征或阈值选择。'],
  '信息泄漏检查':['同一对象的重复观测不得跨集合泄漏。','标准化、缺失填补应只拟合训练集。','报告时序数据可见的信息范围。'],
  '共同预算':['观测、工具与训练预算保持一致。','固定调参和人工干预次数。','报告运行时间与失败成本。'],
  '额外信息':['列出每种方法获得的新增信息。','通过单独对照区分信息优势。','不能只据结果提升归因于结构。'],
  '校准与误差':['报告仪器校准与测量不确定性。','记录异常检测和人工复核规则。','检查误差是否随处理条件变化。'],
  '分析单位':['区分记录行、图像、样本与场次。','模型估计应符合实际分层结构。','解释聚合前后的信息损失。'],
  '训练条件':['固定数据版本、目标与停止规则。','记录种子和选择超参数的依据。'],
  '测试条件':['冻结模型后使用独立数据。','保留场景、尺度与失败记录。'],
  '复现材料':['代码、数据、参数和运行环境。','明确哪些材料公开，哪些受限。'],
  '主要效应':['报告效应大小与比较基线。','模板图中的数字仅为合成演示。'],
  '统计口径':['给出样本、聚合方法与不确定性。','误差条含义不能只写 error。'],
  '解释边界':['统计差异与实际意义分别判断。','说明未测试的条件与替代解释。'],
  '终点一的解释':['定义单位、分母与评价时间窗。','单独报告该指标的效应与误差。'],
  '终点二的解释':['明确与终点一的不同含义。','两个终点分别达标不等于同时达标。'],
  '组件作用':['把消融操作和机制假设对应。','比较时其余输入与预算保持一致。'],
  '替代解释':['消融同时改变了哪些条件？','检查调参、容量与数据的影响。','用进一步对照区分机制贡献。'],
  '不确定性与重复':['报告独立重复、区间和显著性方法。','避免仅凭单次最佳值解释组件贡献。'],
  '测试环境':['列出训练覆盖和独立留出条件。','分环境报告，不只给全局平均。'],
  '最差情形':['展示失败环境与违反约束的次数。','讨论收益下降是否有系统性来源。','同时报告离群值和缺失情况。'],
  '平均值以外的结论':['检查分位数、最差环境与个体差异。','总体均值不能替代条件层面的判断。'],
  '收益指标':['定义收益、单位与基线。','说明是否包含预测或模拟项。'],
  '风险指标':['报告违反约束的概率或幅度。','分开平均风险与极端情形。'],
  '资源代价':['计算、人工、数据与执行成本。','权衡使用相同的时间与计量单位。'],
  '评价者与尺度':['人工、程序和模型评分分别记录。','说明评分规则与是否盲评。','任务完成和答案正确应分别评价。'],
  '失败集中在哪一步':['将错误对应到数据、计划、工具或读图。','记录可复现的输入和失败输出。','避免用总分掩盖集中失效的环节。'],
  '分母与统计单位':['报告任务数、重复数与实际评价单位。','模板计数仅用于验证表格表达。'],
  '图例与处理':['解释颜色、线型与实验条件。','读图前先明确比较对象。'],
  '主要趋势':['指出具体面板和变化方向。','对照图注与原始数据核对数值。'],
  '必要限定':['保留样本、误差与实验范围。','不从示意图推导真实研究结论。'],
  '面板 A':['解释该面板的变量和处理。','对应的图注与样本条件独立保留。'],
  '面板 B':['说明它如何补充前一面板。','确认两图尺度是否可以直接比较。'],
  '证据 A':['变量、样本和关键趋势。','对应来源面板及读图规则。'],
  '证据 B':['使用不同观测检查同一解释。','保留自身单位与统计口径。'],
  '证据 C':['补充机制或边界证据。','不要把相关性作为因果结论。'],
  '主面板的读图结论':['两个条件的差异随时间展开。'],
  '补充证据与限定':['效应区间补充趋势图。','两图都保留坐标与对照。','合成示例不支持研究结论。'],
  '所选面板的范围':['本页只展开面板 A。','保留条件、坐标和误差带。'],
  '关键证据':['指出哪个面板支持具体论点。','把精确读数与正文或源数据对照。'],
  '局限与外推':['保留图中未覆盖的条件。','放大原图不改变其证据范围。'],
  '坐标与变量':['解释横纵轴、量纲与归一化。','注明对数刻度或截断范围。'],
  '颜色与处理':['颜色只编码条件或类别。','线型和符号也应能区分。'],
  '判读规则':['说明点、带和误差条代表什么。','依据实验设计解释比较关系。'],
  '比较维度':['只比较含义一致的输入与接口。','数值比较须使用相同任务和评价单位。'],
  '不可比条件':['列出数据、预算和任务范围的差异。','报告不可比原因及需要补充的对照。'],
  '方法演化':['记录新增的知识、工具或控制接口。','用具体模块变化解释方法进展。'],
  '评价演化':['区分离线指标、任务评价与现场收益。','每个阶段注明实际验证范围。'],
  '仍然缺少的验证':['指出现有证据尚未覆盖的条件。','提出升级验证需要的数据与对照。'],
  '一致发现':['汇总可被不同证据重复支持的关系。','保留各论文共享的实验条件。'],
  '冲突来源':['先检查任务、样本和测量尺度。','再分析机制解释是否相互排斥。'],
  '可区分的解释':['列出能够解释分歧的具体条件。','设计只改变该条件的公平比较。'],
  '失败条件':['填写可复现的输入、环境与触发点。','给出出现失败的任务分母。'],
  '错误发生在哪一步':['对照日志定位第一个错误环节。','区分原始错误和后续传播。'],
  '对结论的影响':['说明失败是否改变主要结果。','记录该条件是否已纳入评价。'],
  '输入条件变化':['对齐训练和测试的变量范围。','用同一尺度表示发生变化的条件。'],
  '机制失配':['指出原有假设在哪个环境失效。','检查模型、工具与执行约束的变化。'],
  '可支持的迁移结论':['结论限定在已测试的条件变化内。','独立报告未覆盖环境。'],
  '偏倚来源':['区分选择、测量和遗漏变量。','说明偏倚可能影响的方向与对象。'],
  '排查与敏感性分析':['改变可疑假设并重新估计主要效应。','比较结论是否依赖单一处理选择。'],
  '内部效度':['对照是否隔离了目标干预？','检查混杂、泄漏与测量不一致。'],
  '外部效度':['研究样本代表哪些对象和条件？','明确跨地点、年份和管理制度的限制。'],
  '风险触发条件':['把失败或不确定性写成可监测信号。','提前规定何时停止、复核或回退。'],
  '人工与计算代价':['记录复核次数、耗时与算力。','评价干预是否减少错误及其代价。'],
  '剩余风险':['列出核验后仍可能保留的错误。','据此限定自动执行的范围。'],
  '已公开材料':['逐项记录数据、代码和环境版本。','用最小实验核查能否恢复原结果。'],
  '缺失与重建条件':['定位缺失参数、数据或执行步骤。','记录重建假设及其可能影响。'],
  '样本量与采集计划':['按独立实验单位规划采集。','依据预期效应与变异说明样本量。'],
  '留出与分析计划':['在采集前明确主要终点和分析程序。','锁定独立留出条件与缺失值处理。']
};
const DEFAULT_TEXT=[
  '将论点对应到原文、图表或补充材料。',
  '保留样本、单位、对照与实验条件。',
  '写清该项支持的结论及尚未验证范围。'
];
function compactBody(title,box,style){return compactFrom(TEXT[title]||DEFAULT_TEXT,box,style);}
function compactFrom(lines,box,style){
  const d={compact:[24,6,46,1.24],plain:[24,6,53,1.24],ruled:[24,6,56,1.24],'academic-panel':[24,34,61,1.24],'academic-tab':[24,34,61,1.24],'academic-side':[24,22,56,1.24],'open-frame':[24,46,78,1.24],'dashed-note':[24,46,85,1.24],'paper-shadow':[24,46,90,1.24],ledger:[24,46,92,1.24],'split-label':[24,Math.min(132,box.w*.29)+41,39,1.24]}[style]||[24,34,62,1.24];
  const [font,pad,used,lineHeight]=d;let body='';
  for(const sentence of lines){const s=sentence.replace(/[。？]$/u,'');const next=body?body+'\n'+s:s;if(wrapText(next,box.w-pad,font).length*font*lineHeight<=Math.max(14,box.h-used)+2)body=next;else break;}
  return body||lines[0].replace(/[。？]$/u,'');
}

const FIGURES=[['response','response.png','响应曲线；合成演示值'],['distribution','distribution.png','独立观测分布；合成演示值'],['transfer','transfer.png','跨环境矩阵；合成演示值'],['effect','effect-interval.png','效应与区间；合成演示值'],['composite','four-panels.png','多面板科学图；合成演示值'],['portrait','portrait-panels.png','竖向面板示例；合成演示值'],['wide','wide-panels.png','宽幅面板示例；合成演示值']];
const assets=[];
for(const [id,name,caption] of FIGURES){
  const file=join(bundled,'assets',name),bytes=await readFile(file);
  if(output!==bundled)await copyFile(file,join(output,'assets',name));
  const compound=['composite','portrait','wide'].includes(id);
  assets.push({id:'template-'+id,paperId:'T1',data:'data:image/png;base64,'+bytes.toString('base64'),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),sha256:hash(bytes),figure:'示例图',caption,displayCaption:id==='wide'?'A/B 为条件；所有数值为合成示例':id==='response'?'A/B 为条件；合成数据':id==='effect'?'Ref. 为参考，V1–V3 为变体；合成数据':caption.replace('；合成演示值','；合成数据'),sourceUrl:'https://github.com/YuZhou0311/dsh-academic-ppt',sourceVersion:'原创排版教学示例 v0.3.0',license:'MIT; all plotted values are synthetic',usage:'figure',cropNote:'完整原图，无裁切',treatment:'paper',reading:{purpose:'evidence',contentType:compound?'dense-multipanel':'plot',task:compound?'overview':'read-values',panelCount:id==='composite'?4:compound?3:1,minLabelPx:id==='wide'?34:28,requiredElements:['面板标题','坐标与单位','条件/图例','误差定义'],verifiedBy:'vision-model',note:'已查看作者脚本生成的源图。关键坐标/图例字体为 20 pt（宽图 24 pt），140 dpi；minLabelPx按 DejaVu Sans 数字/大写字形墨迹高度保守取28/34px，排除仅用于来源披露的底部小字。需另检查最终PPTX。'}});
}
if(output!==bundled)await copyFile(join(bundled,'assets/synthetic-data.json'),join(output,'assets/synthetic-data.json'));
const detail=structuredClone(assets.find(a=>a.id==='template-composite'));detail.id='template-detail';detail.viewport={x:.015,y:.025,w:.495,h:.49};detail.caption='合成图面板 A 的局部视窗';detail.displayCaption='面板 A；A/B 为条件；合成数据';detail.cropNote='视窗 x=.015,y=.025,w=.495,h=.49；包含面板标题、坐标、图例及单位，原始图像完整保留';detail.reading={...detail.reading,contentType:'plot',task:'read-values',panelCount:1};assets.push(detail);
const portraitDetail=structuredClone(assets.find(a=>a.id==='template-portrait'));portraitDetail.id='template-portrait-detail';portraitDetail.viewport={x:.035,y:.008,w:.95,h:.315};portraitDetail.caption='竖长合成图中的面板 A';portraitDetail.displayCaption='竖图面板 A；其余面板另页；合成数据';portraitDetail.cropNote='视窗 x=.035,y=.008,w=.95,h=.315；保留顶部面板的完整标题、两条件图例、坐标及单位。未把总图缩略图当作证据。';portraitDetail.reading={...portraitDetail.reading,contentType:'plot',task:'read-values',panelCount:1};assets.push(portraitDetail);

function tableFor(id){
  const tables={
    'paper-contribution-comparison':{columns:['比较维度','既有方法','本研究方法'],rows:[['输入信息','原有观测','新增信息（填写）'],['决策接口','原有算子','改变环节（填写）'],['验证范围','已发表条件','新增场景（填写）'],['资源预算','统一记录','统一记录']]},
    'experiment-factorial':{columns:['因子','水平 1','水平 2','设计说明'],rows:[['处理强度','低','高','填写实际水平与单位'],['环境条件','E1','E2','说明独立重复'],['时间阶段','早期','后期','是否为重复测量'],['随机化','按区组','组内分配','记录分配单位']]},
    'experiment-baseline-controls':{columns:['条件','基线流程','干预流程'],rows:[['观测数据','相同数据版本','相同数据版本'],['工具与参数','预先冻结','只修改指定模块'],['计算预算','统一上限','统一上限'],['人工干预','记录每次介入','记录每次介入'],['评价方法','同一盲评程序','同一盲评程序']]},
    'experiment-parameter-protocol':{columns:['参数','设置（待替换）','依据或来源'],rows:[['时间步','填写数值与单位','实验采样频率'],['训练轮次','填写停止条件','验证集选择'],['重复数量','填写独立重复数','样本量依据'],['学习率','填写候选与最终值','仅训练/验证选取'],['测试范围','列出年份与环境','独立留出记录']]},
    'results-ablation':{columns:['设置','合成效应','合成区间','解释任务'],rows:[['参考方法','0.00','−0.08…0.08','定义共同基线'],['移除模块 A','0.22','0.11…0.33','核查机制贡献'],['移除模块 B','0.31','0.17…0.45','核查信息变化'],['完整方法','0.43','0.27…0.59','报告资源代价']]},
    'results-error-analysis':{columns:['阶段','合成任务数','合成失败数','需核查的证据'],rows:[['数据获取','10','1','原始输入与缺失'],['工具执行','10','2','参数、日志与异常'],['结果解释','10','3','答案与数据来源']]},
    'synthesis-method-comparison':{columns:['研究','输入与知识','决策接口','验证范围'],rows:[['论文 A（替换）','填写实际输入','策略更新','仿真或实体（填写）'],['论文 B（替换）','填写新增信息','奖励或约束','独立留出（填写）'],['论文 C（替换）','填写工具边界','计划与工具调用','任务评价（填写）'],['共同问题','输入是否公平','机制能否区分','结论能外推到哪里']]},
    'limitations-validity-audit':{columns:['威胁','可能影响','可核查证据'],rows:[['选择偏倚','样本代表性下降','纳入与排除记录'],['测量误差','效应估计偏移','校准与重复测量'],['信息泄漏','测试结果偏高','完整数据处理链'],['评价混淆','结论对象改变','统一分母与评价者'],['环境变化','外推失效','独立环境测试']]}
  };return {...tables[id],caption:'结构占位 / 合成数据，必须替换后才能用于学术结论',sourceClaimIds:['C-TEMPLATE']};
}
function chartFor(id){
  if(['results-robustness','limitations-domain-shift'].includes(id))return {kind:'line',categories:['E1','E2','E3','E4'],series:[{name:'条件 A（合成）',values:[82,78,70,63]},{name:'条件 B（合成）',values:[85,81,76,72]}],unit:'合成指标 / a.u.',sourceClaimId:'C-TEMPLATE'};
  if(id==='results-two-outcomes')return {kind:'column',categories:['对照','低处理','高处理'],series:[{name:'终点一（合成）',values:[24,29,35]}],unit:'合成终点一 / a.u.',sourceClaimId:'C-TEMPLATE'};
  if(id==='results-tradeoff')return {kind:'bar',categories:['参考方法','设置一','设置二'],series:[{name:'合成指标',values:[24,31,37]}],unit:'合成值 / a.u.',sourceClaimId:'C-TEMPLATE'};
  return {kind:'column',categories:['参考方法','设置一','设置二'],series:[{name:'合成效应',values:[24,31,37]}],unit:'合成值 / a.u.',sourceClaimId:'C-TEMPLATE'};
}
const longText={
  'synthesis-mechanism-map':[['比较共同输入、动作和反馈的接口。','把机制相同与实现相同分开。'],['额外知识、模型和控制权进入何处？','不同环境的数值不直接排序。']],
  'synthesis-evidence-ladder':[['明确模拟器和状态空间。'],['说明受控条件与独立重复。'],['报告年份、地点或对象留出。'],['交代部署时间与干预后果。'],['先确定评价对象是否一致。','任务完成、预测性能和农艺收益分别比较。'],['不同证据层级支持不同结论。','指出升级验证还需要什么。']],
  'synthesis-open-questions':[['汇总现有研究一致支持的发现。','保留场景与测量条件。'],['新研究需要改变哪个接口？','给出具体可测的目标。'],['记录已有失败与反例。','说明信息是否足以解释。'],['设计能区分替代解释的比较。','明确数据与预算。'],['优先检验影响核心结论且能获得证据的问题。']],
  'plan-hypothesis-test':[['填写可追溯的已有发现。','指出效应与验证范围。'],['将缺少的证据写成具体问题。','区分未知机制与未测环境。'],['改变一个明确的机制或接口。','预期哪个指标发生什么变化？','哪种观察会使假说不获支持？'],['冻结其余信息与工具预算。','设置基线、干预和必要消融。','保证同一评价和留出条件。'],['预先定义主要终点与不确定性。','同时报告失败、成本和风险。','无效或负效应也应完整保留。']],
  'plan-fair-comparison':[['双方使用同一任务、观测和工具。','固定调用次数、人工介入和预算。','明确干预只改变哪个环节。'],['定义可测的主要终点。','统一盲评与统计单位。','预先规定不支持假说的结果。']],
  'plan-work-packages':[['确认数据版本、许可与基线。','产物：可复现的基线与证据记录。'],['实施预定义干预与消融。','产物：按统一口径报告的比较结果。'],['补充留出、失败与稳健性分析。','产物：复现材料与解释边界。'],['说明各阶段所需输入与完成条件。','避免仅按日期排列任务。'],['材料不足、效果无效或成本超出时如何调整？','把停止条件与研究问题对应。']],
  'plan-conclusions':[['用一句结论连接一项核心证据。','保留样本、比较与实验身份。'],['解释与前一结论的关系。','避免重复陈述相同发现。'],['总结机制或适用范围。','将推断与原文报告区分。'],['列出论文没有测试的条件。','说明这些未知如何影响应用。'],['提出能被实验区分的下一步问题。','保留公平对照和评价尺度。']],
  'plan-reference-notes':[['记录正式稿、作者稿或预印本版本。','补充材料、代码和数据分别定位。','不要把链接存在当作已读全文。'],['保留图号、面板、作者与许可。','裁切说明不能省略关键上下文。','替换本页所有占位书目后再汇报。']]
};

const NODE_DETAILS={
 'method-agent-loop':['目标与可用数据','工具与调用顺序','输入、参数和日志','结果与来源一致','中间状态与证据','继续或退出'],
 'method-rl-interface':['传感、气象与历史','状态映射到动作','执行实际管理','奖励与约束检查'],
 'method-model-coupling':['同一时间步和物理量','参数与状态演化','效应、损失和边界','反馈到下一轮'],
 'experiment-cohort-design':['来源与纳入规则','独立接受处理','随机化与区组','时间点与采样频率'],
 'experiment-measurement-chain':['处理与生物重复','设备与采样条件','数据版本与缺失','异常与复核规则','表型与单位','效应与区间'],
 'synthesis-mechanism-map':['统一观测与单位','新增信息的来源','谁选择管理动作','如何检验输出'],
 'synthesis-timeline':['定义输入与任务','定位新模块','检查验证范围','明确仍缺的证据'],
 'limitations-measurement-bias':['目标估计对象','潜在系统性误差','实际分析单位','适用对象与范围'],
 'limitations-reproducibility':['公开记录与许可','可复现安装','固定程序和预算','原图、数据与来源'],
 'plan-fair-comparison':['独立留出与任务','原有处理机制','只改变指定模块','共同终点与盲评'],
 'plan-data-evaluation':['独立实验单位','统一测量与版本','冻结主要终点','单独留出环境']
};
const EMPHASIS=['独立实验单位','独立样本','独立重复','独立验证','独立留出','同一数据','相同数据','同一任务','同一评价','主要终点','效应大小','额外信息','新增信息','误差条','不确定性','约束违反','失败成本','比较基线','公平比较','对照','单位','输入','输出'];
const SHORT_TITLES={'失败集中在哪一步':'失败环节','假设与计算条件':'计算假设','纳入排除与缺失值':'纳入、排除与缺失','不确定性与重复':'不确定性与重复','可支持的迁移结论':'迁移结论','主面板的读图结论':'主面板结论','所选面板的范围':'面板范围','可识别性假设':'可识别性假设','输入与单位':'输入\n单位'};
const slides=REFERENCE_TEMPLATES.map((t,index)=>{
  // Teaching evidence is selected by its intended role, never by slot shape.
  const figureIds=t.slots.figures.map((b,i)=>t.id==='figure-detail-window'?(i?'template-effect':'template-detail'):t.id==='figure-portrait-reading'?'template-portrait-detail':t.id==='figure-wide-annotated'?'template-wide':t.id==='results-two-outcomes'?'template-distribution':['template-response','template-effect','template-transfer'][i%3]);
  const cards=t.prompts.map((title,i)=>{
    const style=t.cardStyles[i],lines=longText[t.id]?.[i];const body=lines?compactFrom(lines,t.slots.cards[i],style):compactBody(title,t.slots.cards[i],style);
    const emphasis=EMPHASIS.filter(text=>body.includes(text)).slice(0,2);
    return {id:'region-'+(i+1),kind:t.cardKinds[i],title:SHORT_TITLES[title]||title,body,...(emphasis.length?{emphasis}:{}),claimIds:[],style};
  });
  const nodes=(t.nodeLabels||[]).map((label,i)=>({id:'step-'+(i+1),label:label==='计划与工具选择'?'计划与工具':label,detail:t.slots.nodeBoxes[i].h>105?(NODE_DETAILS[t.id]?.[i]||''):'',kind:/核验|检验|验证|统计|输出|估计/.test(label)?'result':/终止|异常|质量|失配|约束/.test(label)?'boundary':/输入|观测|样本|实验对象|总体|数据/.test(label)?'setting':'method'}));
  const pairs=t.edgePairs||nodes.slice(1).map((_,i)=>[i,i+1]);
  const edges=pairs.map(([a,b])=>({from:nodes[a].id,to:nodes[b].id}));
  const s={id:'T'+String(index+1).padStart(2,'0'),layout:t.layout,referenceTemplateId:t.id,title:t.name,paperIds:['T1'],claimIds:[],figureIds,cards,nodes,edges,notes:`本页为原创学术版式模板，ID ${t.id}。${t.description}\n全部文本为填写指引，图表值是合成演示值，不是任何研究结果。使用前替换论文、数据、原图与来源。\n内容职责：${t.prompts.join('；')}。\n建议讲述时间只是排练起点，按实际内容调整。`,seconds:t.suggestedSeconds};
  if(t.slots.panels)s.panelTitles=t.slots.panels.map(p=>p.title);
  if(t.slots.chart){s.chart=chartFor(t.id);s.claimIds=['C-TEMPLATE'];}
  if(t.slots.table){s.table=tableFor(t.id);s.claimIds=['C-TEMPLATE'];}
  if(t.slots.takeaway)s.takeaway=t.slots.takeaway.h<34?'统计口径、样本单位和适用条件需与原文一致':'解释必须由本页证据支持，并保留样本、对照与适用条件。';
  if(t.slots.references)s.paperIds=['T1','T2','T3'];
  return s;
});
const papers=['T1','T2','T3'].map((id,i)=>({id,title:['Full article title: connecting decision models, experimental evidence and independent validation in crop cultivation','Full title of a related methods or validation study','Full title of the source for the supplementary evidence'][i],authors:['作者姓名（替换）'],year:2026,journal:'期刊与卷页（替换）',doi:'书目占位；图表均为合成示例',url:'https://example.invalid/replace-with-official-paper-url',version:'书目占位，非真实文献',studyType:'system-evaluation',reading:{status:'metadata-only',sections:[],source:'模板占位',notes:'不是已阅读全文的声明。'},methodSummary:'填写实际方法。',limitations:['填写原论文局限。']}));
const project={schemaVersion:1,id:'academic-reference-pack',revision:0,title:'48 种学术汇报版式参考',brief:{centralQuestion:'原创学术版式、结构化填充指引与合成科学图',audience:'学术汇报制作者',talkMinutes:48,targetPaperCount:0,requireFullText:false},design:{fontFamily:'Noto Sans CJK SC',palette:{background:'#FFFFFF',paper:'#FFFFFF',ink:'#1C2430',accent:'#173C70',secondary:'#355D88',gold:'#903543',muted:'#515B68',line:'#BEC8D4',soft:'#EEF3F8',tint:'#EEF3F8'}},capabilities:{imageInput:'unknown',source:'可视审查能力需由实际使用环境另行确认'},papers,claims:[{id:'C-TEMPLATE',paperId:'T1',kind:'proposal',text:'全部图表数字是合成排版示例，不是真实研究结论。',locator:'scripts/create-reference-figures.py 与 scripts/build-references.mjs',context:'仅用于教学模板；使用前替换并核查实际来源。',verified:false}],assets,slides};

const all=await renderProject(project);
await writeFile(join(output,'academic-templates-48.pptx'),all.pptx);
await writeFile(join(output,'academic-templates-48.html'),all.html);
for(const s of all.svgPages)await writeFile(join(output,'previews',s.id+'.svg'),s.svg);
const files=[];
for(const category of REFERENCE_CATEGORIES){
  const selected=slides.filter(s=>s.referenceTemplateId.startsWith(category.id+'-'));
  const rendered=await renderProject({...project,title:category.name+'学术模板',slides:selected});
  const name=category.id+'.pptx';await writeFile(join(output,name),rendered.pptx);files.push({category:category.id,name:category.name,file:name,slides:selected.length,sha256:hash(rendered.pptx)});
}
const assetRecords=assets.map(({data,...a})=>({...a,path:'assets/'+FIGURES.find(([id])=>a.id==='template-'+id||(a.id==='template-detail'&&id==='composite')||(a.id==='template-portrait-detail'&&id==='portrait'))[1]}));
await writeFile(join(output,'slide-records.json'),JSON.stringify({schemaVersion:1,synthetic:true,bibliographicPlaceholders:true,purpose:'layout-templates-not-research-evidence',notice:'All bibliographic metadata is placeholder text and all numeric data is synthetic. Replace and verify before a scientific presentation.',design:project.design,brief:project.brief,papers:project.papers,claims:project.claims,assets:assetRecords,slides},null,2)+'\n');
const manifest={schemaVersion:1,version:'0.3.0',purpose:'original-academic-layout-reference',templateCount:48,categories:REFERENCE_CATEGORIES,collection:{file:'academic-templates-48.pptx',sha256:hash(all.pptx)},categoryFiles:files,templates:REFERENCE_TEMPLATES.map((t,i)=>({...t,page:i+1,preview:`previews/T${String(i+1).padStart(2,'0')}.svg`,pptx:t.category+'.pptx',categoryPage:i%6+1})),figures:assetRecords.map(({sha256,id,path,caption,displayCaption,license,viewport,cropNote,reading})=>({id,path,sha256,caption,displayCaption,license,...(viewport?{viewport}:{}),cropNote,reading})),sources:[{title:'MIT Communication Lab: Slideshow',url:'https://mitcommlab.mit.edu/nse/commkit/slideshow/'},{title:'Penn State Assertion–Evidence',url:'https://www.assertion-evidence.com/'},{title:'Bourne: Ten Simple Rules for Making Good Oral Presentations',url:'https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.0030077'}],license:'MIT for original layouts and synthetic plot assets; no university logos or copyrighted template decks included',checks:{staticIssues:all.issues,pptxVisual:'not-yet-recorded'}};
await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const cards=manifest.templates.map(t=>{
  const guidance=t.category==='figure'?`<p class="figure-guide"><strong>图片适用条件：</strong>${esc(t.figureGuidance.description)}</p>`:'';
  return `<article data-category="${t.category}" data-search="${esc(t.id+' '+t.name+' '+t.description+' '+t.prompts.join(' ')+(t.figureGuidance?' '+t.figureGuidance.description:''))}"><a class="preview" href="previews/T${String(t.page).padStart(2,'0')}.svg"><img loading="lazy" src="previews/T${String(t.page).padStart(2,'0')}.svg" alt="${esc(t.name)}"></a><h2>${String(t.page).padStart(2,'0')} ${esc(t.name)}</h2><code>${t.id}</code><p>${esc(t.description)}</p>${guidance}<p class="roles">${t.prompts.map(esc).join(' / ')}</p><a href="${t.pptx}">下载本类 PPTX · 第 ${t.categoryPage} 页</a></article>`;
}).join('\n');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>48种学术汇报模板</title><style>*{box-sizing:border-box}body{margin:0;background:#f1f4f7;color:#1c2430;font:16px/1.65 "Noto Sans CJK SC",system-ui,sans-serif}header{background:white;padding:30px max(4vw,24px);border-bottom:3px solid #173c70}h1{margin:0;color:#173c70;font-size:28px}header p{max-width:1000px;margin:12px 0}a{color:#173c70}nav{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}input,select{font:inherit;border:1px solid #adb9c8;padding:9px 12px;background:white;min-width:190px}main{padding:28px max(4vw,24px);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}article{background:white;padding:16px;border:1px solid #d8e0e8}article[hidden]{display:none}img{display:block;width:100%;aspect-ratio:16/9;background:white}h2{font-size:20px;margin:14px 0 3px}code{font-size:13px;color:#46556a}p{margin:8px 0}.roles{font-size:14px;color:#536070}.note{color:#903543}footer{padding:20px 4vw;background:white}@media(max-width:850px){main{grid-template-columns:1fr}}@media print{nav{display:none}main{grid-template-columns:1fr}article{break-inside:avoid}}</style></head><body><header><h1>48 种学术汇报模板</h1><p>按论文任务选择可编辑结构：完整书目、方法机制、实验设计、结果与统计、原图解读、跨文献综合、局限与失败、研究计划。布局与运行时 referenceTemplateId 使用同一份几何数据。</p><p class="note">模板文字为填写指引，图表值全部为合成示例。请替换为实际论文、原图和数据后再用于科学汇报。</p><p><a href="academic-templates-48.pptx">下载48页可编辑总集</a> · <a href="academic-templates-48.html">全屏逐页查看</a> · <a href="slide-records.json">可复用记录</a> · <a href="manifest.json">模板与素材清单</a></p><nav><input id="search" type="search" placeholder="搜索任务、模板ID或内容"><select id="category"><option value="all">全部 48 个模板</option>${REFERENCE_CATEGORIES.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select><span id="count"></span></nav></header><main>${cards}</main><footer>原创模板与合成图采用 MIT 许可。参考学术沟通原则，不包含大学品牌模板、徽标或用户私有模板。</footer><script>const items=[...document.querySelectorAll('article')],search=document.querySelector('#search'),category=document.querySelector('#category');function filter(){const q=search.value.toLowerCase().trim(),c=category.value;let n=0;for(const item of items){item.hidden=!((c==='all'||item.dataset.category===c)&&item.dataset.search.toLowerCase().includes(q));if(!item.hidden)n++}document.querySelector('#count').textContent=n+' / 48'}search.addEventListener('input',filter);category.addEventListener('change',filter);filter();</script></body></html>`;
await writeFile(join(output,'gallery.html'),html);
console.log(JSON.stringify({output,templates:48,categoryDecks:8,pptx:'academic-templates-48.pptx',figures:FIGURES.length,staticErrors:all.issues.filter(x=>x.severity==='error').length,staticWarnings:all.issues.filter(x=>x.severity==='warning').length},null,2));
